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

import { mocked } from "jest-mock";

import { MatrixClient, PendingEventOrdering } from "../../../src/client";
import { Room, RoomEvent } from "../../../src/models/room";
import { Thread, THREAD_RELATION_TYPE, ThreadEvent, FeatureSupport } from "../../../src/models/thread";
import { makeThreadEvent, mkThread } from "../../test-utils/thread";
import { TestClient } from "../../TestClient";
import { emitPromise, mkEdit, mkMessage, mkReaction, mock } from "../../test-utils/test-utils";
import { Direction, EventStatus, EventType, MatrixEvent } from "../../../src";
import { ReceiptType } from "../../../src/@types/read_receipts";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../test-utils/client";
import { ReEmitter } from "../../../src/ReEmitter";
import { Feature, ServerSupport } from "../../../src/feature";
import { eventMapperFor } from "../../../src/event-mapper";

describe("Thread", () => {
    describe("constructor", () => {
        it("should explode for element-web#22141 logging", () => {
            // Logging/debugging for https://github.com/vector-im/element-web/issues/22141
            expect(() => {
                new Thread("$event", undefined, {} as any); // deliberate cast to test error case
            }).toThrow("element-web#22141: A thread requires a room in order to function");
        });
    });

    it("includes pending events in replyCount", async () => {
        const myUserId = "@bob:example.org";
        const testClient = new TestClient(myUserId, "DEVICE", "ACCESS_TOKEN", undefined, { timelineSupport: false });
        const client = testClient.client;
        const room = new Room("123", client, myUserId, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        jest.spyOn(client, "getRoom").mockReturnValue(room);

        const { thread } = mkThread({
            room,
            client,
            authorId: myUserId,
            participantUserIds: ["@alice:example.org"],
            length: 3,
        });
        await emitPromise(thread, ThreadEvent.Update);
        expect(thread.length).toBe(2);

        const event = mkMessage({
            room: room.roomId,
            user: myUserId,
            msg: "thread reply",
            relatesTo: {
                rel_type: THREAD_RELATION_TYPE.name,
                event_id: thread.id,
            },
            event: true,
        });
        await thread.processEvent(event);
        event.setStatus(EventStatus.SENDING);
        room.addPendingEvent(event, "txn01");

        await emitPromise(thread, ThreadEvent.Update);
        expect(thread.length).toBe(3);
    });

    describe("hasUserReadEvent", () => {
        let myUserId: string;
        let client: MatrixClient;
        let room: Room;

        beforeEach(() => {
            client = getMockClientWithEventEmitter({
                ...mockClientMethodsUser(),
                isInitialSyncComplete: jest.fn().mockReturnValue(false),
                getRoom: jest.fn().mockImplementation(() => room),
                decryptEventIfNeeded: jest.fn().mockResolvedValue(void 0),
                supportsThreads: jest.fn().mockReturnValue(true),
            });
            client.reEmitter = mock(ReEmitter, "ReEmitter");
            client.canSupport = new Map();
            Object.keys(Feature).forEach((feature) => {
                client.canSupport.set(feature as Feature, ServerSupport.Stable);
            });

            myUserId = client.getUserId()!;

            room = new Room("123", client, myUserId);

            const receipt = new MatrixEvent({
                type: "m.receipt",
                room_id: "!foo:bar",
                content: {
                    // first threaded receipt
                    "$event0:localhost": {
                        [ReceiptType.Read]: {
                            [client.getUserId()!]: { ts: 100, thread_id: "$threadId:localhost" },
                        },
                    },
                    // last unthreaded receipt
                    "$event1:localhost": {
                        [ReceiptType.Read]: {
                            [client.getUserId()!]: { ts: 200 },
                            ["@alice:example.org"]: { ts: 200 },
                        },
                    },
                    // last threaded receipt
                    "$event2:localhost": {
                        [ReceiptType.Read]: {
                            [client.getUserId()!]: { ts: 300, thread_id: "$threadId" },
                        },
                    },
                },
            });
            room.addReceipt(receipt);

            jest.spyOn(client, "getRoom").mockReturnValue(room);
        });

        afterAll(() => {
            jest.resetAllMocks();
        });

        it("considers own events with no RR as read", () => {
            const { thread, events } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: [myUserId],
                length: 2,
            });

            // The event is automatically considered read as the current user is the sender
            expect(thread.hasUserReadEvent(myUserId, events.at(-1)!.getId() ?? "")).toBeTruthy();
        });

        it("considers other events with no RR as unread", () => {
            const { thread, events } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: [myUserId],
                length: 25,
                ts: 190,
            });

            // Before alice's last unthreaded receipt
            expect(thread.hasUserReadEvent("@alice:example.org", events.at(1)!.getId() ?? "")).toBeTruthy();

            // After alice's last unthreaded receipt
            expect(thread.hasUserReadEvent("@alice:example.org", events.at(-1)!.getId() ?? "")).toBeFalsy();
        });

        it("considers event as read if there's a more recent unthreaded receipt", () => {
            const { thread, events } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: ["@alice:example.org"],
                length: 2,
                ts: 150, // before the latest unthreaded receipt
            });
            expect(thread.hasUserReadEvent(client.getUserId()!, events.at(-1)!.getId() ?? "")).toBe(true);
        });

        it("considers event as unread if there's no more recent unthreaded receipt", () => {
            const { thread, events } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: ["@alice:example.org"],
                length: 2,
                ts: 1000,
            });
            expect(thread.hasUserReadEvent(client.getUserId()!, events.at(-1)!.getId() ?? "")).toBe(false);
        });
    });

    describe("getEventReadUpTo", () => {
        let myUserId: string;
        let client: MatrixClient;
        let room: Room;

        beforeEach(() => {
            client = getMockClientWithEventEmitter({
                ...mockClientMethodsUser(),
                isInitialSyncComplete: jest.fn().mockReturnValue(false),
                getRoom: jest.fn().mockImplementation(() => room),
                decryptEventIfNeeded: jest.fn().mockResolvedValue(void 0),
                supportsThreads: jest.fn().mockReturnValue(true),
            });
            client.reEmitter = mock(ReEmitter, "ReEmitter");
            client.canSupport = new Map();
            Object.keys(Feature).forEach((feature) => {
                client.canSupport.set(feature as Feature, ServerSupport.Stable);
            });

            myUserId = client.getUserId()!;

            room = new Room("123", client, myUserId);

            jest.spyOn(client, "getRoom").mockReturnValue(room);
        });

        afterAll(() => {
            jest.resetAllMocks();
        });

        it("uses unthreaded receipt to figure out read up to", () => {
            const receipt = new MatrixEvent({
                type: "m.receipt",
                room_id: "!foo:bar",
                content: {
                    // last unthreaded receipt
                    "$event1:localhost": {
                        [ReceiptType.Read]: {
                            ["@alice:example.org"]: { ts: 200 },
                        },
                    },
                },
            });
            room.addReceipt(receipt);

            const { thread, events } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: [myUserId],
                length: 25,
                ts: 190,
            });

            // The 10th event has been read, as alice's last unthreaded receipt is at ts 200
            // and `mkThread` increment every thread response by 1ms.
            expect(thread.getEventReadUpTo("@alice:example.org")).toBe(events.at(9)!.getId());
        });

        it("considers thread created before the first threaded receipt to be read", () => {
            const receipt = new MatrixEvent({
                type: "m.receipt",
                room_id: "!foo:bar",
                content: {
                    // last unthreaded receipt
                    "$event1:localhost": {
                        [ReceiptType.Read]: {
                            [myUserId]: { ts: 200, thread_id: "$threadId" },
                        },
                    },
                },
            });
            room.addReceipt(receipt);

            const { thread, events } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2,
                ts: 10,
            });

            // This is marked as read as it is before alice's first threaded receipt...
            expect(thread.getEventReadUpTo(myUserId)).toBe(events.at(-1)!.getId());

            const { thread: thread2 } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2,
                ts: 1000,
            });

            // Nothing has been read, this thread is after the first threaded receipt...
            expect(thread2.getEventReadUpTo(myUserId)).toBe(null);
        });
    });

    describe("resetLiveTimeline", () => {
        // ResetLiveTimeline is used when we have missing messages between the current live timeline's end and newly
        // received messages. In that case, we want to replace the existing live timeline. To ensure pagination
        // continues working correctly, new pagination tokens need to be set on both the old live timeline (which is
        // now a regular timeline) and the new live timeline.
        it("replaces the live timeline and correctly sets pagination tokens", async () => {
            const myUserId = "@bob:example.org";
            const testClient = new TestClient(myUserId, "DEVICE", "ACCESS_TOKEN", undefined, {
                timelineSupport: false,
            });
            const client = testClient.client;
            const room = new Room("123", client, myUserId, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            jest.spyOn(client, "getRoom").mockReturnValue(room);

            const { thread } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: ["@alice:example.org"],
                length: 3,
            });
            await emitPromise(thread, ThreadEvent.Update);
            expect(thread.length).toBe(2);

            jest.spyOn(client, "createMessagesRequest").mockImplementation((_, token) =>
                Promise.resolve({
                    chunk: [],
                    start: `${token}-new`,
                    end: `${token}-new`,
                }),
            );

            function timelines(): [string | null, string | null][] {
                return thread.timelineSet
                    .getTimelines()
                    .map((it) => [it.getPaginationToken(Direction.Backward), it.getPaginationToken(Direction.Forward)]);
            }

            expect(timelines()).toEqual([[null, null]]);
            const promise = thread.resetLiveTimeline("b1", "f1");
            expect(timelines()).toEqual([
                [null, "f1"],
                ["b1", null],
            ]);
            await promise;
            expect(timelines()).toEqual([
                [null, "f1-new"],
                ["b1-new", null],
            ]);
        });

        // As the pagination tokens cannot be used right now, resetLiveTimeline needs to replace them before they can
        // be used. But if in the future the bug in synapse is fixed, and they can actually be used, we can get into a
        // state where the client has paginated (and changed the tokens) while resetLiveTimeline tries to set the
        // corrected tokens. To prevent such a race condition, we make sure that resetLiveTimeline respects any
        // changes done to the pagination tokens.
        it("replaces the live timeline but does not replace changed pagination tokens", async () => {
            const myUserId = "@bob:example.org";
            const testClient = new TestClient(myUserId, "DEVICE", "ACCESS_TOKEN", undefined, {
                timelineSupport: false,
            });
            const client = testClient.client;
            const room = new Room("123", client, myUserId, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            jest.spyOn(client, "getRoom").mockReturnValue(room);

            const { thread } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: ["@alice:example.org"],
                length: 3,
            });
            await emitPromise(thread, ThreadEvent.Update);
            expect(thread.length).toBe(2);

            jest.spyOn(client, "createMessagesRequest").mockImplementation((_, token) =>
                Promise.resolve({
                    chunk: [],
                    start: `${token}-new`,
                    end: `${token}-new`,
                }),
            );

            function timelines(): [string | null, string | null][] {
                return thread.timelineSet
                    .getTimelines()
                    .map((it) => [it.getPaginationToken(Direction.Backward), it.getPaginationToken(Direction.Forward)]);
            }

            expect(timelines()).toEqual([[null, null]]);
            const promise = thread.resetLiveTimeline("b1", "f1");
            expect(timelines()).toEqual([
                [null, "f1"],
                ["b1", null],
            ]);
            thread.timelineSet.getTimelines()[0].setPaginationToken("f2", Direction.Forward);
            thread.timelineSet.getTimelines()[1].setPaginationToken("b2", Direction.Backward);
            await promise;
            expect(timelines()).toEqual([
                [null, "f2"],
                ["b2", null],
            ]);
        });

        it("is correctly called by the room", async () => {
            const myUserId = "@bob:example.org";
            const testClient = new TestClient(myUserId, "DEVICE", "ACCESS_TOKEN", undefined, {
                timelineSupport: false,
            });
            const client = testClient.client;
            const room = new Room("123", client, myUserId, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            jest.spyOn(client, "getRoom").mockReturnValue(room);

            const { thread } = mkThread({
                room,
                client,
                authorId: myUserId,
                participantUserIds: ["@alice:example.org"],
                length: 3,
            });
            await emitPromise(thread, ThreadEvent.Update);
            expect(thread.length).toBe(2);
            const mock = jest.spyOn(thread, "resetLiveTimeline");
            mock.mockReturnValue(Promise.resolve());

            room.resetLiveTimeline("b1", "f1");
            expect(mock).toHaveBeenCalledWith("b1", "f1");
        });
    });

    describe("insertEventIntoTimeline", () => {
        it("Inserts a reaction in timestamp order", () => {
            // Assumption: no server side support because if we have it, events
            // can only be added to the timeline after the thread has been
            // initialised, and we are not properly initialising it here.
            expect(Thread.hasServerSideSupport).toBe(FeatureSupport.None);

            const client = createClientWithEventMapper();
            const userId = "user1";
            const room = new Room("room1", client, userId);

            // Given a thread with a root plus 5 messages
            const { thread, events } = mkThread({
                room,
                client,
                authorId: userId,
                participantUserIds: ["@bob:hs", "@chia:hs", "@dv:hs"],
                length: 6,
                ts: 100, // Events will be at ts 100, 101, 102, 103, 104 and 105
            });

            // When we insert a reaction to the second thread message
            const replyEvent = mkReaction(events[2], client, userId, room.roomId, 104);
            thread.insertEventIntoTimeline(replyEvent);

            // Then the reaction is inserted based on its timestamp
            expect(thread.events.map((ev) => ev.getId())).toEqual([
                events[0].getId(),
                events[1].getId(),
                events[2].getId(),
                events[3].getId(),
                events[4].getId(),
                replyEvent.getId(),
                events[5].getId(),
            ]);
        });

        describe("Without relations recursion support", () => {
            it("Creates a local echo receipt for new events", async () => {
                // Assumption: no server side support because if we have it, events
                // can only be added to the timeline after the thread has been
                // initialised, and we are not properly initialising it here.
                expect(Thread.hasServerSideSupport).toBe(FeatureSupport.None);

                // Given a client without relations recursion support
                const client = createClientWithEventMapper();

                // And a thread with an added event (with later timestamp)
                const userId = "user1";
                const { thread, message } = await createThreadAndEvent(client, 1, 100, userId);

                // Then a receipt was added to the thread
                const receipt = thread.getReadReceiptForUserId(userId);
                expect(receipt).toBeTruthy();
                expect(receipt?.eventId).toEqual(message.getId());
                expect(receipt?.data.ts).toEqual(100);
                expect(receipt?.data.thread_id).toEqual(thread.id);

                // (And the receipt was synthetic)
                expect(thread.getReadReceiptForUserId(userId, true)).toBeNull();
            });

            it("Doesn't create a local echo receipt for events before an existing receipt", async () => {
                // Assumption: no server side support because if we have it, events
                // can only be added to the timeline after the thread has been
                // initialised, and we are not properly initialising it here.
                expect(Thread.hasServerSideSupport).toBe(FeatureSupport.None);

                // Given a client without relations recursion support
                const client = createClientWithEventMapper();

                // And a thread with an added event with a lower timestamp than its other events
                const userId = "user1";
                const { thread } = await createThreadAndEvent(client, 200, 100, userId);

                // Then no receipt was added to the thread (the receipt is still
                // for the thread root). This happens because since we have no
                // recursive relations support, we know that sometimes events
                // appear out of order, so we have to check their timestamps as
                // a guess of the correct order.
                expect(thread.getReadReceiptForUserId(userId)?.eventId).toEqual(thread.rootEvent?.getId());
            });
        });

        describe("With relations recursion support", () => {
            it("Creates a local echo receipt for new events", async () => {
                // Assumption: no server side support because if we have it, events
                // can only be added to the timeline after the thread has been
                // initialised, and we are not properly initialising it here.
                expect(Thread.hasServerSideSupport).toBe(FeatureSupport.None);

                // Given a client WITH relations recursion support
                const client = createClientWithEventMapper(
                    new Map([[Feature.RelationsRecursion, ServerSupport.Stable]]),
                );

                // And a thread with an added event (with later timestamp)
                const userId = "user1";
                const { thread, message } = await createThreadAndEvent(client, 1, 100, userId);

                // Then a receipt was added to the thread
                const receipt = thread.getReadReceiptForUserId(userId);
                expect(receipt?.eventId).toEqual(message.getId());
            });

            it("Creates a local echo receipt even for events BEFORE an existing receipt", async () => {
                // Assumption: no server side support because if we have it, events
                // can only be added to the timeline after the thread has been
                // initialised, and we are not properly initialising it here.
                expect(Thread.hasServerSideSupport).toBe(FeatureSupport.None);

                // Given a client WITH relations recursion support
                const client = createClientWithEventMapper(
                    new Map([[Feature.RelationsRecursion, ServerSupport.Stable]]),
                );

                // And a thread with an added event with a lower timestamp than its other events
                const userId = "user1";
                const { thread, message } = await createThreadAndEvent(client, 200, 100, userId);

                // Then a receipt was added to the thread, because relations
                // recursion is available, so we trust the server to have
                // provided us with events in the right order.
                const receipt = thread.getReadReceiptForUserId(userId);
                expect(receipt?.eventId).toEqual(message.getId());
            });
        });

        async function createThreadAndEvent(
            client: MatrixClient,
            rootTs: number,
            eventTs: number,
            userId: string,
        ): Promise<{ thread: Thread; message: MatrixEvent }> {
            const room = new Room("room1", client, userId);

            // Given a thread
            const { thread } = mkThread({
                room,
                client,
                authorId: userId,
                participantUserIds: [],
                ts: rootTs,
            });
            // Sanity: the current receipt is for the thread root
            expect(thread.getReadReceiptForUserId(userId)?.eventId).toEqual(thread.rootEvent?.getId());

            const awaitTimelineEvent = new Promise<void>((res) => thread.on(RoomEvent.Timeline, () => res()));

            // When we add a message that is before the latest receipt
            const message = makeThreadEvent({
                event: true,
                rootEventId: thread.id,
                replyToEventId: thread.id,
                user: userId,
                room: room.roomId,
                ts: eventTs,
            });
            await thread.addEvent(message, false, true);
            await awaitTimelineEvent;

            return { thread, message };
        }

        function createClientWithEventMapper(canSupport: Map<Feature, ServerSupport> = new Map()): MatrixClient {
            const client = mock(MatrixClient, "MatrixClient");
            client.reEmitter = mock(ReEmitter, "ReEmitter");
            client.canSupport = canSupport;
            jest.spyOn(client, "getEventMapper").mockReturnValue(eventMapperFor(client, {}));
            mocked(client.supportsThreads).mockReturnValue(true);
            return client;
        }
    });

    describe("Editing events", () => {
        describe("Given server support for threads", () => {
            let previousThreadHasServerSideSupport: FeatureSupport;

            beforeAll(() => {
                previousThreadHasServerSideSupport = Thread.hasServerSideSupport;
                Thread.hasServerSideSupport = FeatureSupport.Stable;
            });

            afterAll(() => {
                Thread.hasServerSideSupport = previousThreadHasServerSideSupport;
            });

            it("Adds edits from sync to the thread timeline and applies them", async () => {
                // Given a thread
                const client = createClient();
                const user = "@alice:matrix.org";
                const room = "!room:z";
                const thread = await createThread(client, user, room);

                // When a message and an edit are added to the thread
                const messageToEdit = createThreadMessage(thread.id, user, room, "Thread reply");
                const editEvent = mkEdit(messageToEdit, client, user, room, "edit");
                await thread.addEvent(messageToEdit, false);
                await thread.addEvent(editEvent, false);

                // Then both events end up in the timeline
                const lastEvent = thread.timeline.at(-1)!;
                const secondLastEvent = thread.timeline.at(-2)!;
                expect(lastEvent).toBe(editEvent);
                expect(secondLastEvent).toBe(messageToEdit);

                // And the first message has been edited
                expect(secondLastEvent.getContent().body).toEqual("edit");
            });

            it("Adds edits fetched on demand to the thread timeline and applies them", async () => {
                // Given we don't support recursive relations
                const client = createClient(new Map([[Feature.RelationsRecursion, ServerSupport.Unsupported]]));
                // And we have a thread
                const user = "@alice:matrix.org";
                const room = "!room:z";
                const thread = await createThread(client, user, room);

                // When a message is added to the thread, and an edit to it is provided on demand
                const messageToEdit = createThreadMessage(thread.id, user, room, "Thread reply");
                // (fetchEditsWhereNeeded only applies to encrypted messages for some reason)
                messageToEdit.event.type = EventType.RoomMessageEncrypted;
                const editEvent = mkEdit(messageToEdit, client, user, room, "edit");
                mocked(client.relations).mockImplementation(async (_roomId, eventId) => {
                    if (eventId === messageToEdit.getId()) {
                        return { events: [editEvent] };
                    } else {
                        return { events: [] };
                    }
                });
                await thread.addEvent(messageToEdit, false);

                // Then both events end up in the timeline
                const lastEvent = thread.timeline.at(-1)!;
                const secondLastEvent = thread.timeline.at(-2)!;
                expect(lastEvent).toBe(editEvent);
                expect(secondLastEvent).toBe(messageToEdit);

                // And the first message has been edited
                expect(secondLastEvent.getContent().body).toEqual("edit");
            });
        });
    });
});

/**
 * Create a message event that lives in a thread
 */
function createThreadMessage(threadId: string, user: string, room: string, msg: string): MatrixEvent {
    return makeThreadEvent({
        event: true,
        user,
        room,
        msg,
        rootEventId: threadId,
        replyToEventId: threadId,
    });
}

/**
 * Create a thread and wait for it to be properly initialised (so you can safely
 * add events to it and expect them to appear in the timeline.
 */
async function createThread(client: MatrixClient, user: string, roomId: string): Promise<Thread> {
    const root = mkMessage({ event: true, user, room: roomId, msg: "Thread root" });
    const room = new Room(roomId, client, "@roomcreator:x");

    // Ensure the root is in the room timeline
    root.setThreadId(root.getId());
    await room.addLiveEvents([root]);

    // Create the thread and wait for it to be initialised
    const thread = room.createThread(root.getId()!, root, [], false);
    await new Promise<void>((res) => thread.once(RoomEvent.TimelineReset, () => res()));

    return thread;
}

/**
 * Create a MatrixClient that supports threads and has all the methods used when
 * creating a thread that call out to HTTP endpoints mocked out.
 */
function createClient(canSupport = new Map()): MatrixClient {
    const client = mock(MatrixClient, "MatrixClient");
    client.reEmitter = mock(ReEmitter, "ReEmitter");
    client.canSupport = canSupport;

    jest.spyOn(client, "supportsThreads").mockReturnValue(true);
    jest.spyOn(client, "getEventMapper").mockReturnValue(eventMapperFor(client, {}));

    // Mock methods that call out to HTTP endpoints
    jest.spyOn(client, "paginateEventTimeline").mockResolvedValue(true);
    jest.spyOn(client, "relations").mockResolvedValue({ events: [] });
    jest.spyOn(client, "fetchRoomEvent").mockResolvedValue({});

    return client;
}
