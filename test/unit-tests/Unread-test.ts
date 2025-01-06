/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixEvent, EventType, MsgType, Room, ReceiptType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { haveRendererForEvent } from "../../src/events/EventTileFactory";
import { makeBeaconEvent, mkEvent, stubClient } from "../test-utils";
import { makeThreadEvents, mkThread, populateThread } from "../test-utils/threads";
import {
    doesRoomHaveUnreadMessages,
    doesRoomHaveUnreadThreads,
    doesRoomOrThreadHaveUnreadMessages,
    eventTriggersUnreadCount,
} from "../../src/Unread";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";

jest.mock("../../src/events/EventTileFactory", () => ({
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
        redactedEvent.makeRedacted(redactedEvent, new Room(redactedEvent.getRoomId()!, client, aliceId));

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
            expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, client, false);
        });

        it("returns true for an event with a renderer", () => {
            mocked(haveRendererForEvent).mockReturnValue(true);
            expect(eventTriggersUnreadCount(client, alicesMessage)).toBe(true);
            expect(haveRendererForEvent).toHaveBeenCalledWith(alicesMessage, client, false);
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
        const myId = client.getSafeUserId();

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
                room.addLiveEvents([event], { addToState: true });

                // Don't care about the code path of hidden events.
                mocked(haveRendererForEvent).mockClear().mockReturnValue(true);
            });

            it("returns true for a room with no receipts", () => {
                expect(doesRoomHaveUnreadMessages(room, false)).toBe(true);
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
                room.addLiveEvents([event], { addToState: true });

                expect(doesRoomHaveUnreadMessages(room, false)).toBe(false);
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

                expect(doesRoomHaveUnreadMessages(room, false)).toBe(false);
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
                room.addLiveEvents([event2], { addToState: true });

                expect(doesRoomHaveUnreadMessages(room, false)).toBe(true);
            });

            it("returns true for a room with an unread message in a thread", async () => {
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

                // Create a read thread, so we don't consider all threads read
                // because there are no threaded read receipts.
                const { rootEvent, events } = mkThread({ room, client, authorId: myId, participantUserIds: [aliceId] });
                const receipt2 = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [events[events.length - 1].getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1, thread_id: rootEvent.getId() },
                            },
                        },
                    },
                });
                room.addReceipt(receipt2);

                // Create a thread as a different user.
                await populateThread({ room, client, authorId: myId, participantUserIds: [aliceId] });

                expect(doesRoomHaveUnreadMessages(room, true)).toBe(true);
            });

            it("returns false for a room when the latest thread event was sent by the current user", async () => {
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
                await populateThread({ room, client, authorId: myId, participantUserIds: [myId] });

                expect(doesRoomHaveUnreadMessages(room, true)).toBe(false);
            });

            it("returns false for a room with read thread messages", async () => {
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
                const { rootEvent, events } = await populateThread({
                    room,
                    client,
                    authorId: myId,
                    participantUserIds: [aliceId],
                });

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

                expect(doesRoomHaveUnreadMessages(room, true)).toBe(false);
            });

            it("returns true for a room when read receipt is not on the latest thread messages", async () => {
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
                const { rootEvent, events } = await populateThread({
                    room,
                    client,
                    authorId: myId,
                    participantUserIds: [aliceId],
                });

                // Mark the thread as read.
                receipt = new MatrixEvent({
                    type: "m.receipt",
                    room_id: "!foo:bar",
                    content: {
                        [events[0].getId()!]: {
                            [ReceiptType.Read]: {
                                [myId]: { ts: 1, thread_id: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room, true)).toBe(true);
            });

            it("returns true when the event for a thread receipt can't be found", async () => {
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
                const { rootEvent, events } = await populateThread({
                    room,
                    client,
                    authorId: myId,
                    participantUserIds: [aliceId],
                });

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
                                [myId]: { ts: receiptTs, thread_id: rootEvent.getId()! },
                            },
                        },
                    },
                });
                room.addReceipt(receipt);

                expect(doesRoomHaveUnreadMessages(room, true)).toBe(true);
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
            redactedEvent.makeRedacted(redactedEvent, room);
            console.log("Event Id", redactedEvent.getId());
            // Only for timeline events.
            room.addLiveEvents([redactedEvent], { addToState: true });

            expect(doesRoomHaveUnreadMessages(room, true)).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith(
                "Falling back to unread room because of no read receipt or counting message found",
                {
                    roomId: room.roomId,
                    earliestUnimportantEventId: redactedEvent.getId(),
                },
            );
        });

        it("returns false for space", () => {
            jest.spyOn(room, "isSpaceRoom").mockReturnValue(true);
            expect(doesRoomHaveUnreadMessages(room, false)).toBe(false);
        });
    });

    describe("doesRoomOrThreadHaveUnreadMessages()", () => {
        let room: Room;
        let event: MatrixEvent;
        const roomId = "!abc:server.org";
        const myId = client.getSafeUserId();

        beforeAll(() => {
            client.supportsThreads = () => true;
        });

        beforeEach(() => {
            room = new Room(roomId, client, myId);
            jest.spyOn(logger, "warn");

            // Don't care about the code path of hidden events.
            mocked(haveRendererForEvent).mockClear().mockReturnValue(true);
        });

        describe("with a single event on the main timeline", () => {
            beforeEach(() => {
                event = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: aliceId,
                    room: roomId,
                    content: {},
                });
                room.addLiveEvents([event], { addToState: true });
            });

            it("an unthreaded receipt for the event makes the room read", () => {
                // Send unthreaded receipt into room pointing at the latest event
                room.addReceipt(
                    new MatrixEvent({
                        type: "m.receipt",
                        room_id: "!foo:bar",
                        content: {
                            [event.getId()!]: {
                                [ReceiptType.Read]: {
                                    [myId]: { ts: 1 },
                                },
                            },
                        },
                    }),
                );

                expect(doesRoomOrThreadHaveUnreadMessages(room)).toBe(false);
            });

            it("a threaded receipt for the event makes the room read", () => {
                // Send threaded receipt into room pointing at the latest event
                room.addReceipt(
                    new MatrixEvent({
                        type: "m.receipt",
                        room_id: "!foo:bar",
                        content: {
                            [event.getId()!]: {
                                [ReceiptType.Read]: {
                                    [myId]: { ts: 1, thread_id: "main" },
                                },
                            },
                        },
                    }),
                );

                expect(doesRoomOrThreadHaveUnreadMessages(room)).toBe(false);
            });
        });

        describe("with an event on the main timeline and a later one in a thread", () => {
            let threadEvent: MatrixEvent;

            beforeEach(() => {
                const { events } = makeThreadEvents({
                    roomId: roomId,
                    authorId: aliceId,
                    participantUserIds: ["@x:s.co"],
                    length: 2,
                    ts: 100,
                    currentUserId: myId,
                });
                room.addLiveEvents(events, { addToState: true });
                threadEvent = events[1];
            });

            it("an unthreaded receipt for the later threaded event makes the room read", () => {
                // Send unthreaded receipt into room pointing at the latest event
                room.addReceipt(
                    new MatrixEvent({
                        type: "m.receipt",
                        room_id: roomId,
                        content: {
                            [threadEvent.getId()!]: {
                                [ReceiptType.Read]: {
                                    [myId]: { ts: 1 },
                                },
                            },
                        },
                    }),
                );

                expect(doesRoomOrThreadHaveUnreadMessages(room)).toBe(false);
            });
        });
    });

    describe("doesRoomHaveUnreadThreads()", () => {
        let room: Room;
        const roomId = "!abc:server.org";
        const myId = client.getSafeUserId();

        beforeAll(() => {
            client.supportsThreads = () => true;
        });

        beforeEach(async () => {
            room = new Room(roomId, client, myId);
            jest.spyOn(logger, "warn");

            // Don't care about the code path of hidden events.
            mocked(haveRendererForEvent).mockClear().mockReturnValue(true);
        });

        it("returns false when no threads", () => {
            expect(doesRoomHaveUnreadThreads(room)).toBe(false);

            // Add event to the room
            const event = mkEvent({
                event: true,
                type: "m.room.message",
                user: aliceId,
                room: roomId,
                content: {},
            });
            room.addLiveEvents([event], { addToState: true });

            // It still returns false
            expect(doesRoomHaveUnreadThreads(room)).toBe(false);
        });

        it("return true when we don't have any receipt for the thread", async () => {
            await populateThread({
                room,
                client,
                authorId: myId,
                participantUserIds: [aliceId],
            });

            // There is no receipt for the thread, it should be unread
            expect(doesRoomHaveUnreadThreads(room)).toBe(true);
        });

        it("return false when we have a receipt for the thread", async () => {
            const { events, rootEvent } = await populateThread({
                room,
                client,
                authorId: myId,
                participantUserIds: [aliceId],
            });

            // Mark the thread as read.
            const receipt = new MatrixEvent({
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

            // There is a receipt for the thread, it should be read
            expect(doesRoomHaveUnreadThreads(room)).toBe(false);
        });

        it("return true when only of the threads has a receipt", async () => {
            // Create a first thread
            await populateThread({
                room,
                client,
                authorId: myId,
                participantUserIds: [aliceId],
            });

            // Create a second thread
            const { events, rootEvent } = await populateThread({
                room,
                client,
                authorId: myId,
                participantUserIds: [aliceId],
            });

            // Mark the thread as read.
            const receipt = new MatrixEvent({
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

            // The first thread doesn't have a receipt, it should be unread
            expect(doesRoomHaveUnreadThreads(room)).toBe(true);
        });
    });
});
