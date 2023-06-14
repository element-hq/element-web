/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked } from "jest-mock";
import { MatrixEvent, EventType, MsgType, Room } from "matrix-js-sdk/src/matrix";
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { logger } from "matrix-js-sdk/src/logger";

import { haveRendererForEvent } from "../src/events/EventTileFactory";
import { makeBeaconEvent, mkEvent, stubClient } from "./test-utils";
import { mkThread } from "./test-utils/threads";
import { doesRoomHaveUnreadMessages, eventTriggersUnreadCount } from "../src/Unread";
import { MatrixClientPeg } from "../src/MatrixClientPeg";

jest.mock("../src/events/EventTileFactory", () => ({
    haveRendererForEvent: jest.fn(),
}));

describe("Unread", () => {
    // A different user.
    const aliceId = "@alice:server.org";
    stubClient();
    const client = MatrixClientPeg.safeGet();

    describe("eventTriggersUnreadCount()", () => {
        // setup events
        const alicesMessage = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: aliceId,
            content: {
                msgtype: MsgType.Text,
                body: "Hello from Alice",
            },
        });

        const ourMessage = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: client.getUserId()!,
            content: {
                msgtype: MsgType.Text,
                body: "Hello from Bob",
            },
        });

        const redactedEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: aliceId,
        });
        redactedEvent.makeRedacted(redactedEvent);

        beforeEach(() => {
            jest.clearAllMocks();
            mocked(haveRendererForEvent).mockClear().mockReturnValue(false);
        });

        it("returns false when the event was sent by the current user", () => {
            expect(eventTriggersUnreadCount(client, ourMessage)).toBe(false);
            // returned early before checking renderer
            expect(haveRendererForEvent).not.toHaveBeenCalled();
        });

        it("returns false for a redacted event", () => {
            expect(eventTriggersUnreadCount(client, redactedEvent)).toBe(false);
            // returned early before checking renderer
            expect(haveRendererForEvent).not.toHaveBeenCalled();
        });

        it("returns false for an event without a renderer", () => {
            mocked(haveRendererForEvent).mockReturnValue(false);
            expect(eventTriggersUnreadCount(client, alicesMessage)).toBe(false);
            expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, false);
        });

        it("returns true for an event with a renderer", () => {
            mocked(haveRendererForEvent).mockReturnValue(true);
            expect(eventTriggersUnreadCount(client, alicesMessage)).toBe(true);
            expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, false);
        });

        it("returns false for beacon locations", () => {
            const beaconLocationEvent = makeBeaconEvent(aliceId);
            expect(eventTriggersUnreadCount(client, beaconLocationEvent)).toBe(false);
            expect(haveRendererForEvent).not.toHaveBeenCalled();
        });

        const noUnreadEventTypes = [
            EventType.RoomMember,
            EventType.RoomThirdPartyInvite,
            EventType.CallAnswer,
            EventType.CallHangup,
            EventType.RoomCanonicalAlias,
            EventType.RoomServerAcl,
        ];

        it.each(noUnreadEventTypes)(
            "returns false without checking for renderer for events with type %s",
            (eventType) => {
                const event = new MatrixEvent({
                    type: eventType,
                    sender: aliceId,
                });
                expect(eventTriggersUnreadCount(client, event)).toBe(false);
                expect(haveRendererForEvent).not.toHaveBeenCalled();
            },
        );
    });

    describe("doesRoomHaveUnreadMessages()", () => {
        let room: Room;
        let event: MatrixEvent;
        const roomId = "!abc:server.org";
        const myId = client.getUserId()!;

        beforeAll(() => {
            client.supportsThreads = () => true;
        });

        beforeEach(() => {
            room = new Room(roomId, client, myId);
            jest.spyOn(logger, "warn");
        });

        describe("when there is an initial event in the room", () => {
            beforeEach(() => {
                event = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: aliceId,
                    room: roomId,
                    content: {},
                });
                room.addLiveEvents([event]);

                // Don't care about the code path of hidden events.
                mocked(haveRendererForEvent).mockClear().mockReturnValue(true);
            });

            it("returns true for a room with no receipts", () => {
                expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            });

            it("returns false for a room when the latest event was sent by the current user", () => {
                event = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: myId,
                    room: roomId,
                    content: {},
                });
                // Only for timeline events.
                room.addLiveEvents([event]);

                expect(doesRoomHaveUnreadMessages(room)).toBe(false);
            });

            it("returns false for a room when the read receipt is at the latest event", () => {
                const receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room)).toBe(false);
            });

            it("returns true for a room when the read receipt is earlier than the latest event", () => {
                const receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                const event2 = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: aliceId,
                    room: roomId,
                    content: {},
                });
                // Only for timeline events.
                room.addLiveEvents([event2]);

                expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            });

            it("returns true for a room with an unread message in a thread", () => {
                // Mark the main timeline as read.
                const receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // Create a thread as a different user.
                mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            });

            it("returns false for a room when the latest thread event was sent by the current user", () => {
                // Mark the main timeline as read.
                const receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // Create a thread as the current user.
                mkThread({ room, client, authorId: myId, participantUserIds: [myId] });

                expect(doesRoomHaveUnreadMessages(room)).toBe(false);
            });

            it("returns false for a room with read thread messages", () => {
                // Mark the main timeline as read.
                let receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // Create threads.
                const { rootEvent, events } = mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                // Mark the thread as read.
                receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [events[events.length - 1].getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1, thread_id: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room)).toBe(false);
            });

            it("returns true for a room when read receipt is not on the latest thread messages", () => {
                // Mark the main timeline as read.
                let receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // Create threads.
                const { rootEvent, events } = mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                // Mark the thread as read.
                receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [events[0].getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1, threadId: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            });

            it("returns false when the event for a thread receipt can't be found, but the receipt ts is late", () => {
                // Given a room that is read
                let receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // And a thread
                const { rootEvent, events } = mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                // When we provide a receipt that points at an unknown event,
                // but its timestamp is after all events in the thread
                //
                // (This could happen if we mis-filed a reaction into the main
                // thread when it should actually have gone into this thread, or
                // maybe the event is just not loaded for some reason.)
                const receiptTs = Math.max(...events.map((e) => e.getTs())) + 100;
                receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        ["UNKNOWN_EVENT_ID"]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: receiptTs, threadId: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room)).toBe(false);
            });

            it("returns true when the event for a thread receipt can't be found, and the receipt ts is early", () => {
                // Given a room that is read
                let receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [event.getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1 },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                // And a thread
                const { rootEvent, events } = mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                // When we provide a receipt that points at an unknown event,
                // but its timestamp is before some of the events in the thread
                //
                // (This could happen if we mis-filed a reaction into the main
                // thread when it should actually have gone into this thread, or
                // maybe the event is just not loaded for some reason.)
                const receiptTs = (events.at(-1)?.getTs() ?? 0) - 100;
                receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        ["UNKNOWN_EVENT_ID"]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: receiptTs, threadId: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            });
        });

        it("returns true for a room that only contains a hidden event", () => {
            const redactedEvent = mkEvent({
                event: true,
                type: "m.room.message",
                user: aliceId,
                room: roomId,
                content: {},
            });
            console.log("Event Id", redactedEvent.getId());
            redactedEvent.makeRedacted(redactedEvent);
            console.log("Event Id", redactedEvent.getId());
            // Only for timeline events.
            room.addLiveEvents([redactedEvent]);

            expect(doesRoomHaveUnreadMessages(room)).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith(
                "Falling back to unread room because of no read receipt or counting message found",
                {
                    roomOrThreadId: room.roomId,
                    readUpToId: null,
                },
            );
        });
    });
});
