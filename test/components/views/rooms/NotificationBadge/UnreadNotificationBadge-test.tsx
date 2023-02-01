/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import "jest-mock";
import { screen, act, render } from "@testing-library/react";
import { MatrixEvent, MsgType, RelationType } from "matrix-js-sdk/src/matrix";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import { EventStatus } from "matrix-js-sdk/src/models/event-status";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import { mkThread } from "../../../../test-utils/threads";
import { UnreadNotificationBadge } from "../../../../../src/components/views/rooms/NotificationBadge/UnreadNotificationBadge";
import { mkEvent, mkMessage, muteRoom, stubClient } from "../../../../test-utils/test-utils";
import * as RoomNotifs from "../../../../../src/RoomNotifs";

const ROOM_ID = "!roomId:example.org";
let THREAD_ID: string;

describe("UnreadNotificationBadge", () => {
    let client: MatrixClient;
    let room: Room;

    function getComponent(threadId?: string) {
        return <UnreadNotificationBadge room={room} threadId={threadId} />;
    }

    beforeEach(() => {
        client = stubClient();
        client.supportsThreads = () => true;

        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const receipt = new MatrixEvent({
            type: "m.receipt",
            room_id: room.roomId,
            content: {
                "$event0:localhost": {
                    [ReceiptType.Read]: {
                        [client.getUserId()!]: { ts: 1, thread_id: "$otherthread:localhost" },
                    },
                },
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        [client.getUserId()!]: { ts: 1 },
                    },
                },
            },
        });
        room.addReceipt(receipt);

        room.setUnreadNotificationCount(NotificationCountType.Total, 1);
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);

        const { rootEvent } = mkThread({
            room,
            client,
            authorId: client.getUserId()!,
            participantUserIds: [client.getUserId()!],
        });
        THREAD_ID = rootEvent.getId()!;

        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 1);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        jest.spyOn(RoomNotifs, "getRoomNotifsState").mockReturnValue(RoomNotifs.RoomNotifState.AllMessages);
    });

    it("renders unread notification badge", () => {
        const { container } = render(getComponent());

        expect(container.querySelector(".mx_NotificationBadge_visible")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_highlighted")).toBeFalsy();

        act(() => {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);
        });

        expect(container.querySelector(".mx_NotificationBadge_highlighted")).toBeTruthy();
    });

    it("renders unread thread notification badge", () => {
        const { container } = render(getComponent(THREAD_ID));

        expect(container.querySelector(".mx_NotificationBadge_visible")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_highlighted")).toBeFalsy();

        act(() => {
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 1);
        });

        expect(container.querySelector(".mx_NotificationBadge_highlighted")).toBeTruthy();
    });

    it("hides unread notification badge", () => {
        act(() => {
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);
            const { container } = render(getComponent(THREAD_ID));
            expect(container.querySelector(".mx_NotificationBadge_visible")).toBeFalsy();
        });
    });

    it("adds a warning for unsent messages", () => {
        const evt = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
        evt.status = EventStatus.NOT_SENT;

        room.addPendingEvent(evt, "123");

        render(getComponent());

        expect(screen.queryByText("!")).not.toBeNull();
    });

    it("adds a warning for invites", () => {
        room.updateMyMembership("invite");
        render(getComponent());
        expect(screen.queryByText("!")).not.toBeNull();
    });

    it("hides counter for muted rooms", () => {
        muteRoom(room);

        const { container } = render(getComponent());
        expect(container.querySelector(".mx_NotificationBadge")).toBeNull();
    });

    it("activity renders unread notification badge", () => {
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        // Add another event on the thread which is not sent by us.
        const event = mkEvent({
            event: true,
            type: "m.room.message",
            user: "@alice:server.org",
            room: room.roomId,
            content: {
                "msgtype": MsgType.Text,
                "body": "Hello from Bob",
                "m.relates_to": {
                    event_id: THREAD_ID,
                    rel_type: RelationType.Thread,
                },
            },
            ts: 5,
        });
        room.addLiveEvents([event]);

        const { container } = render(getComponent(THREAD_ID));
        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_visible")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_highlighted")).toBeFalsy();
    });
});
