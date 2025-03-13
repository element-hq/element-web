/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    Room,
    MatrixEventEvent,
    PendingEventOrdering,
    EventStatus,
    NotificationCountType,
    EventType,
    MatrixEvent,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { mkEvent, muteRoom, stubClient } from "../../../test-utils";
import { RoomNotificationState } from "../../../../src/stores/notifications/RoomNotificationState";
import { NotificationStateEvents } from "../../../../src/stores/notifications/NotificationState";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";
import { createMessageEventContent } from "../../../test-utils/events";

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

    it("updates on event decryption", () => {
        const roomNotifState = new RoomNotificationState(room, true);
        const listener = jest.fn();
        roomNotifState.addListener(NotificationStateEvents.Update, listener);
        const testEvent = {
            getRoomId: () => room.roomId,
        } as unknown as MatrixEvent;
        room.getUnreadNotificationCount = jest.fn().mockReturnValue(1);
        client.emit(MatrixEventEvent.Decrypted, testEvent);
        expect(listener).toHaveBeenCalled();
    });

    it("emits an Update event on marked unread room account data", () => {
        const roomNotifState = new RoomNotificationState(room, true);
        const listener = jest.fn();
        roomNotifState.addListener(NotificationStateEvents.Update, listener);
        const accountDataEvent = {
            getType: () => "m.marked_unread",
            getContent: () => {
                return { unread: true };
            },
        } as unknown as MatrixEvent;
        room.getAccountData = jest.fn().mockReturnValue(accountDataEvent);
        room.emit(RoomEvent.AccountData, accountDataEvent, room);
        expect(listener).toHaveBeenCalled();
    });

    it("does not update on other account data", () => {
        const roomNotifState = new RoomNotificationState(room, true);
        const listener = jest.fn();
        roomNotifState.addListener(NotificationStateEvents.Update, listener);
        const accountDataEvent = {
            getType: () => "else.something",
            getContent: () => {
                return {};
            },
        } as unknown as MatrixEvent;
        room.getAccountData = jest.fn().mockReturnValue(accountDataEvent);
        room.emit(RoomEvent.AccountData, accountDataEvent, room);
        expect(listener).not.toHaveBeenCalled();
    });

    it("removes listeners", () => {
        const roomNotifState = new RoomNotificationState(room, false);
        expect(() => roomNotifState.destroy()).not.toThrow();
    });

    it("suggests an 'unread' ! if there are unsent messages", () => {
        const roomNotifState = new RoomNotificationState(room, false);

        const event = mkEvent({
            event: true,
            type: "m.message",
            user: "@user:example.org",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
        room.addPendingEvent(event, "txn");

        expect(roomNotifState.level).toBe(NotificationLevel.Unsent);
        expect(roomNotifState.symbol).toBe("!");
        expect(roomNotifState.count).toBeGreaterThan(0);
    });

    it("suggests nothing if the room is muted", () => {
        const roomNotifState = new RoomNotificationState(room, false);

        muteRoom(room);
        setUnreads(room, 1234, 0);
        room.updateMyMembership(KnownMembership.Join); // emit

        expect(roomNotifState.level).toBe(NotificationLevel.None);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(0);
    });

    it("suggests a red ! if the user has been invited to a room", () => {
        const roomNotifState = new RoomNotificationState(room, false);

        room.updateMyMembership(KnownMembership.Invite); // emit

        expect(roomNotifState.level).toBe(NotificationLevel.Highlight);
        expect(roomNotifState.symbol).toBe("!");
        expect(roomNotifState.count).toBeGreaterThan(0);
    });

    it("returns a proper count and color for regular unreads", () => {
        const roomNotifState = new RoomNotificationState(room, false);

        setUnreads(room, 4321, 0);
        room.updateMyMembership(KnownMembership.Join); // emit

        expect(roomNotifState.level).toBe(NotificationLevel.Notification);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(4321);
    });

    it("returns a proper count and color for highlights", () => {
        const roomNotifState = new RoomNotificationState(room, false);

        setUnreads(room, 0, 69);
        room.updateMyMembership(KnownMembership.Join); // emit

        expect(roomNotifState.level).toBe(NotificationLevel.Highlight);
        expect(roomNotifState.symbol).toBe(null);
        expect(roomNotifState.count).toBe(69);
    });

    it("includes threads", async () => {
        const roomNotifState = new RoomNotificationState(room, true);

        room.timeline.push(
            new MatrixEvent({
                room_id: room.roomId,
                type: EventType.RoomMessage,
                sender: "userId",
                content: createMessageEventContent("timeline event"),
            }),
        );

        addThread(room);
        room.updateMyMembership(KnownMembership.Join); // emit

        expect(roomNotifState.level).toBe(NotificationLevel.Activity);
        expect(roomNotifState.symbol).toBe(null);
    });
});
