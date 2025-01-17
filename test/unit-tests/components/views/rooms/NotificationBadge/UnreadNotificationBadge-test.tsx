/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import "jest-mock";
import { screen, act, render } from "jest-matrix-react";
import {
    MatrixEvent,
    MsgType,
    RelationType,
    NotificationCountType,
    Room,
    EventStatus,
    PendingEventOrdering,
    ReceiptType,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkThread } from "../../../../../test-utils/threads";
import { UnreadNotificationBadge } from "../../../../../../src/components/views/rooms/NotificationBadge/UnreadNotificationBadge";
import { mkEvent, mkMessage, muteRoom, stubClient } from "../../../../../test-utils/test-utils";
import * as RoomNotifs from "../../../../../../src/RoomNotifs";

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
        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).toBeFalsy();

        act(() => {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);
        });

        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).toBeTruthy();
    });

    it("renders unread thread notification badge", () => {
        const { container } = render(getComponent(THREAD_ID));

        expect(container.querySelector(".mx_NotificationBadge_visible")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).toBeFalsy();

        act(() => {
            room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 1);
        });

        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).toBeTruthy();
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
        room.updateMyMembership(KnownMembership.Invite);
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
        room.addLiveEvents([event], { addToState: true });

        const { container } = render(getComponent(THREAD_ID));
        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_visible")).toBeTruthy();
        expect(container.querySelector(".mx_NotificationBadge_level_highlight")).toBeFalsy();
    });
});
