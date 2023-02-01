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

import { Room } from "matrix-js-sdk/src/models/room";
import {
    MatrixEventEvent,
    PendingEventOrdering,
    EventStatus,
    NotificationCountType,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkEvent, muteRoom, stubClient } from "../../test-utils";
import { RoomNotificationState } from "../../../src/stores/notifications/RoomNotificationState";
import { NotificationStateEvents } from "../../../src/stores/notifications/NotificationState";
import { NotificationColor } from "../../../src/stores/notifications/NotificationColor";
import { createMessageEventContent } from "../../test-utils/events";

describe("RoomNotificationState", () => {
    let room: Room;
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
        room = new Room("!room:example.com", client, "@user:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    function addThread(room: Room): void {
        const threadId = "thread_id";
        jest.spyOn(room, "eventShouldLiveIn").mockReturnValue({
            shouldLiveInRoom: true,
            shouldLiveInThread: true,
            threadId,
        });
        const thread = room.createThread(
            threadId,
            new MatrixEvent({
                room_id: room.roomId,
                event_id: "event_root_1",
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("RootEvent"),
            }),
            [],
            true,
        );
        for (let i = 0; i < 10; i++) {
            thread.addEvent(
                new MatrixEvent({
                    room_id: room.roomId,
                    event_id: "event_reply_1" + i,
                    type: EventType.RoomMessage,
                    sender: "userId",
                    content: createMessageEventContent("ReplyEvent" + 1),
                }),
                false,
            );
        }
    }

    function setUnreads(room: Room, greys: number, reds: number): void {
        room.setUnreadNotificationCount(NotificationCountType.Highlight, reds);
        room.setUnreadNotificationCount(NotificationCountType.Total, greys);
    }

    it("Updates on event decryption", () => {
        const roomNotifState = new RoomNotificationState(room);
        const listener = jest.fn();
        roomNotifState.addListener(NotificationStateEvents.Update, listener);
        const testEvent = {
            getRoomId: () => room.roomId,
        } as unknown as MatrixEvent;
        room.getUnreadNotificationCount = jest.fn().mockReturnValue(1);
        client.emit(MatrixEventEvent.Decrypted, testEvent);
        expect(listener).toHaveBeenCalled();
    });

    it("removes listeners", () => {
        const roomNotifState = new RoomNotificationState(room);
        expect(() => roomNotifState.destroy()).not.toThrow();
    });

    it("suggests an 'unread' ! if there are unsent messages", () => {
        const roomNotifState = new RoomNotificationState(room);

        const event = mkEvent({
            event: true,
            type: "m.message",
            user: "@user:example.org",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
        room.addPendingEvent(event, "txn");

        expect(roomNotifState.color).toBe(NotificationColor.Unsent);
        expect(roomNotifState.symbol).toBe("!");
        expect(roomNotifState.count).toBeGreaterThan(0);
    });

    it("suggests nothing if the room is muted", () => {
        const roomNotifState = new RoomNotificationState(room);

        muteRoom(room);
        setUnreads(room, 1234, 0);
        room.updateMyMembership("join"); // emit

        expect(roomNotifState.color).toBe(NotificationColor.None);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(0);
    });

    it("suggests a red ! if the user has been invited to a room", () => {
        const roomNotifState = new RoomNotificationState(room);

        room.updateMyMembership("invite"); // emit

        expect(roomNotifState.color).toBe(NotificationColor.Red);
        expect(roomNotifState.symbol).toBe("!");
        expect(roomNotifState.count).toBeGreaterThan(0);
    });

    it("returns a proper count and color for regular unreads", () => {
        const roomNotifState = new RoomNotificationState(room);

        setUnreads(room, 4321, 0);
        room.updateMyMembership("join"); // emit

        expect(roomNotifState.color).toBe(NotificationColor.Grey);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(4321);
    });

    it("returns a proper count and color for highlights", () => {
        const roomNotifState = new RoomNotificationState(room);

        setUnreads(room, 0, 69);
        room.updateMyMembership("join"); // emit

        expect(roomNotifState.color).toBe(NotificationColor.Red);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(69);
    });

    it("includes threads", async () => {
        const roomNotifState = new RoomNotificationState(room);

        room.timeline.push(
            new MatrixEvent({
                room_id: room.roomId,
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("timeline event"),
            }),
        );

        addThread(room);
        room.updateMyMembership("join"); // emit

        expect(roomNotifState.color).toBe(NotificationColor.Bold);
        expect(roomNotifState.symbol).toBe(null);
    });
});
