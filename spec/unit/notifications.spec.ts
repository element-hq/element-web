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

import { ReceiptType } from "../../src/@types/read_receipts";
import { Feature, ServerSupport } from "../../src/feature";
import {
    EventType,
    fixNotificationCountOnDecryption,
    MatrixClient,
    MatrixEvent,
    MsgType,
    NotificationCountType,
    RelationType,
    Room,
    RoomEvent,
} from "../../src/matrix";
import { IActionsObject } from "../../src/pushprocessor";
import { ReEmitter } from "../../src/ReEmitter";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../test-utils/client";
import { mkEvent, mock } from "../test-utils/test-utils";

let mockClient: MatrixClient;
let room: Room;
let event: MatrixEvent;
let threadEvent: MatrixEvent;

const ROOM_ID = "!roomId:example.org";
let THREAD_ID: string;

function mkPushAction(notify: boolean, highlight: boolean): IActionsObject {
    return {
        notify,
        tweaks: {
            highlight,
        },
    };
}

describe("fixNotificationCountOnDecryption", () => {
    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            isInitialSyncComplete: jest.fn().mockReturnValue(false),
            getPushActionsForEvent: jest.fn().mockReturnValue(mkPushAction(true, true)),
            getRoom: jest.fn().mockImplementation(() => room),
            decryptEventIfNeeded: jest.fn().mockResolvedValue(void 0),
            supportsThreads: jest.fn().mockReturnValue(true),
        });
        mockClient.reEmitter = mock(ReEmitter, "ReEmitter");
        mockClient.canSupport = new Map();
        Object.keys(Feature).forEach((feature) => {
            mockClient.canSupport.set(feature as Feature, ServerSupport.Stable);
        });

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "");

        const receipt = new MatrixEvent({
            type: "m.receipt",
            room_id: "!foo:bar",
            content: {
                "$event0:localhost": {
                    [ReceiptType.Read]: {
                        [mockClient.getUserId()!]: { ts: 123 },
                    },
                },
                "$event1:localhost": {
                    [ReceiptType.Read]: {
                        [mockClient.getUserId()!]: { ts: 666, thread_id: THREAD_ID },
                    },
                },
                "$otherevent:localhost": {
                    [ReceiptType.Read]: {
                        [mockClient.getUserId()!]: { ts: 999, thread_id: "$otherthread:localhost" },
                    },
                },
            },
        });
        room.addReceipt(receipt);

        room.setUnreadNotificationCount(NotificationCountType.Total, 1);
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);

        event = mkEvent(
            {
                type: EventType.RoomMessage,
                content: {
                    msgtype: MsgType.Text,
                    body: "Hello world!",
                },
                event: true,
                ts: 1234,
            },
            mockClient,
        );

        THREAD_ID = event.getId()!;
        threadEvent = mkEvent({
            type: EventType.RoomMessage,
            content: {
                "m.relates_to": {
                    rel_type: RelationType.Thread,
                    event_id: THREAD_ID,
                },
                "msgtype": MsgType.Text,
                "body": "Thread reply",
            },
            ts: 5678,
            event: true,
        });
        room.createThread(THREAD_ID, event, [threadEvent], false);

        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 1);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        event.getPushActions = jest.fn().mockReturnValue(mkPushAction(false, false));
        threadEvent.getPushActions = jest.fn().mockReturnValue(mkPushAction(false, false));
    });

    it("changes the room count to highlight on decryption", () => {
        expect(room.getUnreadNotificationCount(NotificationCountType.Total)).toBe(2);
        expect(room.getUnreadNotificationCount(NotificationCountType.Highlight)).toBe(0);

        fixNotificationCountOnDecryption(mockClient, event);

        expect(room.getUnreadNotificationCount(NotificationCountType.Total)).toBe(3);
        expect(room.getUnreadNotificationCount(NotificationCountType.Highlight)).toBe(1);
    });

    it("does not change the room count when there's no unread count", () => {
        room.setUnreadNotificationCount(NotificationCountType.Total, 0);
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);

        fixNotificationCountOnDecryption(mockClient, event);

        expect(room.getRoomUnreadNotificationCount(NotificationCountType.Total)).toBe(1);
        expect(room.getRoomUnreadNotificationCount(NotificationCountType.Highlight)).toBe(1);
    });

    it("changes the thread count to highlight on decryption", () => {
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total)).toBe(1);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight)).toBe(0);

        fixNotificationCountOnDecryption(mockClient, threadEvent);

        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total)).toBe(2);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight)).toBe(1);
    });

    it("does not change the thread count when there's no unread count", () => {
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        fixNotificationCountOnDecryption(mockClient, event);

        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total)).toBe(0);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight)).toBe(0);
    });

    it("does not calculate for threads unknown to the room", () => {
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        const unknownThreadEvent = mkEvent({
            type: EventType.RoomMessage,
            content: {
                "m.relates_to": {
                    rel_type: RelationType.Thread,
                    event_id: "$unknownthread",
                },
                "msgtype": MsgType.Text,
                "body": "Thread reply",
            },
            ts: 8901,
            event: true,
        });

        fixNotificationCountOnDecryption(mockClient, unknownThreadEvent);

        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total)).toBe(0);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight)).toBe(0);
    });

    it("does not change the total room count when an event is marked as non-notifying", () => {
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
        room.setUnreadNotificationCount(NotificationCountType.Total, 0);
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);

        event.getPushActions = jest.fn().mockReturnValue(mkPushAction(true, false));
        mockClient.getPushActionsForEvent = jest.fn().mockReturnValue(mkPushAction(false, false));

        fixNotificationCountOnDecryption(mockClient, event);
        expect(room.getUnreadNotificationCount(NotificationCountType.Total)).toBe(0);
        expect(room.getUnreadNotificationCount(NotificationCountType.Highlight)).toBe(0);
    });

    it("does not change the total room count when a threaded event is marked as non-notifying", () => {
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight, 0);

        threadEvent.getPushActions = jest.fn().mockReturnValue(mkPushAction(true, false));
        mockClient.getPushActionsForEvent = jest.fn().mockReturnValue(mkPushAction(false, false));

        fixNotificationCountOnDecryption(mockClient, event);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Total)).toBe(0);
        expect(room.getThreadUnreadNotificationCount(THREAD_ID, NotificationCountType.Highlight)).toBe(0);
    });

    it("emits events", () => {
        const cb = jest.fn();
        room.on(RoomEvent.UnreadNotifications, cb);

        room.setUnreadNotificationCount(NotificationCountType.Total, 1);
        expect(cb).toHaveBeenLastCalledWith({ highlight: 0, total: 1 });

        room.setUnreadNotificationCount(NotificationCountType.Highlight, 5);
        expect(cb).toHaveBeenLastCalledWith({ highlight: 5, total: 1 });

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 5);
        expect(cb).toHaveBeenLastCalledWith({ highlight: 5 }, "$123");
    });
});
