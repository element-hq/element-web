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

import { render } from "@testing-library/react";
import { MatrixEvent, MsgType, RelationType } from "matrix-js-sdk/src/matrix";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import React from "react";

import RoomHeaderButtons from "../../../../src/components/views/right_panel/RoomHeaderButtons";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { mkEvent, stubClient } from "../../../test-utils";
import { mkThread } from "../../../test-utils/threads";

describe("RoomHeaderButtons-test.tsx", function () {
    const ROOM_ID = "!roomId:example.org";
    let room: Room;
    let client: MatrixClient;

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        client.supportsThreads = () => true;
        room = new Room(ROOM_ID, client, client.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    function getComponent(room?: Room) {
        return render(<RoomHeaderButtons room={room} excludedRightPanelPhaseButtons={[]} />);
    }

    function getThreadButton(container: HTMLElement) {
        return container.querySelector(".mx_RightPanel_threadsButton");
    }

    function isIndicatorOfType(container: HTMLElement, type: "red" | "gray" | "bold") {
        return container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")!.className.includes(type);
    }

    it("should render", () => {
        const { asFragment } = getComponent(room);
        expect(asFragment()).toMatchSnapshot();
    });

    it("shows the thread button", () => {
        const { container } = getComponent(room);
        expect(getThreadButton(container)).not.toBeNull();
    });

    it("room wide notification does not change the thread button", () => {
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);
        room.setUnreadNotificationCount(NotificationCountType.Total, 1);

        const { container } = getComponent(room);

        expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();
    });

    it("thread notification does change the thread button", () => {
        const { container } = getComponent(room);
        expect(getThreadButton(container)!.className.includes("mx_RoomHeader_button--unread")).toBeFalsy();

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 1);
        expect(getThreadButton(container)!.className.includes("mx_RoomHeader_button--unread")).toBeTruthy();
        expect(isIndicatorOfType(container, "gray")).toBe(true);

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 1);
        expect(isIndicatorOfType(container, "red")).toBe(true);

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 0);

        expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();
    });

    it("thread activity does change the thread button", async () => {
        const { container } = getComponent(room);

        // Thread activity should appear on the icon.
        const { rootEvent, events } = mkThread({
            room,
            client,
            authorId: client.getUserId()!,
            participantUserIds: ["@alice:example.org"],
        });
        expect(isIndicatorOfType(container, "bold")).toBe(true);

        // Sending the last event should clear the notification.
        let event = mkEvent({
            event: true,
            type: "m.room.message",
            user: client.getUserId()!,
            room: room.roomId,
            content: {
                "msgtype": MsgType.Text,
                "body": "Test",
                "m.relates_to": {
                    event_id: rootEvent.getId(),
                    rel_type: RelationType.Thread,
                },
            },
        });
        room.addLiveEvents([event]);
        await expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();

        // Mark it as unread again.
        event = mkEvent({
            event: true,
            type: "m.room.message",
            user: "@alice:example.org",
            room: room.roomId,
            content: {
                "msgtype": MsgType.Text,
                "body": "Test",
                "m.relates_to": {
                    event_id: rootEvent.getId(),
                    rel_type: RelationType.Thread,
                },
            },
        });
        room.addLiveEvents([event]);
        expect(isIndicatorOfType(container, "bold")).toBe(true);

        // Sending a read receipt on an earlier event shouldn't do anything.
        let receipt = new MatrixEvent({
            type: "m.receipt",
            room_id: room.roomId,
            content: {
                [events.at(-1)!.getId()!]: {
                    [ReceiptType.Read]: {
                        [client.getUserId()!]: { ts: 1, thread_id: rootEvent.getId() },
                    },
                },
            },
        });
        room.addReceipt(receipt);
        expect(isIndicatorOfType(container, "bold")).toBe(true);

        // Sending a receipt on the latest event should clear the notification.
        receipt = new MatrixEvent({
            type: "m.receipt",
            room_id: room.roomId,
            content: {
                [event.getId()!]: {
                    [ReceiptType.Read]: {
                        [client.getUserId()!]: { ts: 1, thread_id: rootEvent.getId() },
                    },
                },
            },
        });
        room.addReceipt(receipt);
        expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();
    });
});
