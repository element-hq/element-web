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

/**
 * This is an internal module. See {@link MatrixClient} for the public class.
 */

import { mocked } from "jest-mock";
import { M_POLL_KIND_DISCLOSED, M_POLL_RESPONSE, M_POLL_START, Optional, PollStartEvent } from "matrix-events-sdk";

import * as utils from "../test-utils/test-utils";
import { emitPromise } from "../test-utils/test-utils";
import {
    Direction,
    DuplicateStrategy,
    EventStatus,
    EventTimelineSet,
    EventType,
    IContent,
    IEvent,
    IRelationsRequestOpts,
    IStateEventWithRoomId,
    JoinRule,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    PendingEventOrdering,
    PollEvent,
    RelationType,
    RoomEvent,
    RoomMember,
} from "../../src";
import { EventTimeline } from "../../src/models/event-timeline";
import { NotificationCountType, Room } from "../../src/models/room";
import { RoomState } from "../../src/models/room-state";
import { UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "../../src/@types/event";
import { TestClient } from "../TestClient";
import { ReceiptType, WrappedReceipt } from "../../src/@types/read_receipts";
import { FeatureSupport, Thread, THREAD_RELATION_TYPE, ThreadEvent } from "../../src/models/thread";
import { Crypto } from "../../src/crypto";
import * as threadUtils from "../test-utils/thread";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../test-utils/client";
import { logger } from "../../src/logger";
import { IMessageOpts } from "../test-utils/test-utils";

describe("Room", function () {
    const roomId = "!foo:bar";
    const userA = "@alice:bar";
    const userB = "@bertha:bar";
    const userC = "@clarissa:bar";
    const userD = "@dorothy:bar";
    let room: Room;

    const mkMessage = (opts?: Partial<IMessageOpts>) =>
        utils.mkMessage(
            {
                ...opts,
                event: true,
                user: userA,
                room: roomId,
            },
            room.client,
        );

    const mkReply = (target: MatrixEvent) =>
        utils.mkEvent(
            {
                event: true,
                type: EventType.RoomMessage,
                user: userA,
                room: roomId,
                content: {
                    "body": "Reply :: " + Math.random(),
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: target.getId()!,
                        },
                    },
                },
            },
            room.client,
        );

    const mkEdit = (target: MatrixEvent, salt = Math.random()) =>
        utils.mkEvent(
            {
                event: true,
                type: EventType.RoomMessage,
                user: userA,
                room: roomId,
                content: {
                    "body": "* Edit of :: " + target.getId() + " :: " + salt,
                    "m.new_content": {
                        body: "Edit of :: " + target.getId() + " :: " + salt,
                    },
                    "m.relates_to": {
                        rel_type: RelationType.Replace,
                        event_id: target.getId()!,
                    },
                },
            },
            room.client,
        );

    const mkThreadResponse = (root: MatrixEvent, opts?: Partial<IMessageOpts>) =>
        utils.mkEvent(
            {
                ...opts,
                event: true,
                type: EventType.RoomMessage,
                user: userA,
                room: roomId,
                content: {
                    "body": "Thread response :: " + Math.random(),
                    "m.relates_to": {
                        "event_id": root.getId()!,
                        "m.in_reply_to": {
                            event_id: root.getId()!,
                        },
                        "rel_type": "m.thread",
                    },
                },
            },
            room.client,
        );

    const mkRedaction = (target: MatrixEvent) =>
        utils.mkEvent(
            {
                event: true,
                type: EventType.RoomRedaction,
                user: userA,
                room: roomId,
                redacts: target.getId()!,
                content: {},
            },
            room.client,
        );

    /**
     * @see threadUtils.mkThread
     */
    const mkThread = (
        opts: Partial<Parameters<typeof threadUtils.mkThread>[0]>,
    ): ReturnType<typeof threadUtils.mkThread> => {
        return threadUtils.mkThread({
            room,
            client: new TestClient().client,
            authorId: "@bob:example.org",
            participantUserIds: ["@bob:example.org"],
            ...opts,
        });
    };

    /**
     * Creates a message and adds it to the end of the main live timeline.
     *
     * @param room - Room to add the message to
     * @param timestamp - Timestamp of the message
     * @return The message event
     */
    const mkMessageInRoom = async (room: Room, timestamp: number) => {
        const message = mkMessage({ ts: timestamp });
        await room.addLiveEvents([message]);
        return message;
    };

    /**
     * Creates a message in a thread and adds it to the end of the thread live timeline.
     *
     * @param thread - Thread to add the message to
     * @param timestamp - Timestamp of the message
     * @returns The thread message event
     */
    const mkMessageInThread = (thread: Thread, timestamp: number) => {
        const message = mkThreadResponse(thread.rootEvent!, { ts: timestamp });
        thread.liveTimeline.addEvent(message, { toStartOfTimeline: false });
        return message;
    };

    const addRoomThreads = (
        room: Room,
        thread1EventTs: Optional<number>,
        thread2EventTs: Optional<number>,
    ): { thread1?: Thread; thread2?: Thread } => {
        const result: { thread1?: Thread; thread2?: Thread } = {};

        if (thread1EventTs !== null) {
            const { rootEvent: thread1RootEvent, thread: thread1 } = mkThread({ room });
            const thread1Event = mkThreadResponse(thread1RootEvent, { ts: thread1EventTs });
            thread1.liveTimeline.addEvent(thread1Event, { toStartOfTimeline: true });
            result.thread1 = thread1;
        }

        if (thread2EventTs !== null) {
            const { rootEvent: thread2RootEvent, thread: thread2 } = mkThread({ room });
            const thread2Event = mkThreadResponse(thread2RootEvent, { ts: thread2EventTs });
            thread2.liveTimeline.addEvent(thread2Event, { toStartOfTimeline: true });
            result.thread2 = thread2;
        }

        return result;
    };

    beforeEach(function () {
        room = new Room(roomId, new TestClient(userA, "device").client, userA);
        // mock RoomStates
        // @ts-ignore
        room.oldState = room.getLiveTimeline().startState = utils.mock(RoomState, "oldState");
        // @ts-ignore
        room.currentState = room.getLiveTimeline().endState = utils.mock(RoomState, "currentState");

        jest.spyOn(logger, "warn");
    });

    describe("getCreator", () => {
        it("should return the creator from m.room.create", function () {
            // @ts-ignore - mocked doesn't handle overloads sanely
            mocked(room.currentState.getStateEvents).mockImplementation(function (type, key) {
                if (type === EventType.RoomCreate && key === "") {
                    return utils.mkEvent({
                        event: true,
                        type: EventType.RoomCreate,
                        skey: "",
                        room: roomId,
                        user: userA,
                        content: {
                            creator: userA,
                        },
                    });
                }
            });
            const roomCreator = room.getCreator();
            expect(roomCreator).toStrictEqual(userA);
        });
    });

    describe("getAvatarUrl", function () {
        const hsUrl = "https://my.home.server";

        it("should return the URL from m.room.avatar preferentially", function () {
            // @ts-ignore - mocked doesn't handle overloads sanely
            mocked(room.currentState.getStateEvents).mockImplementation(function (type, key) {
                if (type === EventType.RoomAvatar && key === "") {
                    return utils.mkEvent({
                        event: true,
                        type: EventType.RoomAvatar,
                        skey: "",
                        room: roomId,
                        user: userA,
                        content: {
                            url: "mxc://flibble/wibble",
                        },
                    });
                }
            });
            const url = room.getAvatarUrl(hsUrl, 100, 100, "scale");
            // we don't care about how the mxc->http conversion is done, other
            // than it contains the mxc body.
            expect(url?.indexOf("flibble/wibble")).not.toEqual(-1);
        });

        it("should return nothing if there is no m.room.avatar and allowDefault=false", function () {
            const url = room.getAvatarUrl(hsUrl, 64, 64, "crop", false);
            expect(url).toEqual(null);
        });
    });

    describe("getMember", function () {
        beforeEach(function () {
            mocked(room.currentState.getMember).mockImplementation(function (userId) {
                return (
                    {
                        "@alice:bar": {
                            userId: userA,
                            roomId: roomId,
                        } as unknown as RoomMember,
                    }[userId] || null
                );
            });
        });

        it("should return null if the member isn't in current state", function () {
            expect(room.getMember("@bar:foo")).toEqual(null);
        });

        it("should return the member from current state", function () {
            expect(room.getMember(userA)).not.toEqual(null);
        });
    });

    describe("addLiveEvents", function () {
        const events: MatrixEvent[] = [
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "changing room name",
                event: true,
            }),
            utils.mkEvent({
                type: EventType.RoomName,
                room: roomId,
                user: userA,
                event: true,
                content: { name: "New Room Name" },
            }),
        ];

        it("Make sure legacy overload passing options directly as parameters still works", async () => {
            await expect(room.addLiveEvents(events, DuplicateStrategy.Replace, false)).resolves.not.toThrow();
            await expect(room.addLiveEvents(events, DuplicateStrategy.Ignore, true)).resolves.not.toThrow();
            await expect(
                // @ts-ignore
                room.addLiveEvents(events, "shouldfailbecauseinvalidduplicatestrategy", false),
            ).rejects.toThrow();
        });

        it("should throw if duplicateStrategy isn't 'replace' or 'ignore'", async function () {
            return expect(
                // @ts-ignore
                room.addLiveEvents(events, {
                    duplicateStrategy: "foo",
                }),
            ).rejects.toThrow();
        });

        it("should replace a timeline event if dupe strategy is 'replace'", async function () {
            // make a duplicate
            const dupe = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "dupe",
                event: true,
            });
            dupe.event.event_id = events[0].getId();
            await room.addLiveEvents(events);
            expect(room.timeline[0]).toEqual(events[0]);
            await room.addLiveEvents([dupe], {
                duplicateStrategy: DuplicateStrategy.Replace,
            });
            expect(room.timeline[0]).toEqual(dupe);
        });

        it("should ignore a given dupe event if dupe strategy is 'ignore'", async function () {
            // make a duplicate
            const dupe = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "dupe",
                event: true,
            });
            dupe.event.event_id = events[0].getId();
            await room.addLiveEvents(events);
            expect(room.timeline[0]).toEqual(events[0]);
            // @ts-ignore
            await room.addLiveEvents([dupe], {
                duplicateStrategy: "ignore",
            });
            expect(room.timeline[0]).toEqual(events[0]);
        });

        it("should emit 'Room.timeline' events", async function () {
            let callCount = 0;
            room.on(RoomEvent.Timeline, function (event, emitRoom, toStart) {
                callCount += 1;
                expect(room.timeline.length).toEqual(callCount);
                expect(event).toEqual(events[callCount - 1]);
                expect(emitRoom).toEqual(room);
                expect(toStart).toBeFalsy();
            });
            await room.addLiveEvents(events);
            expect(callCount).toEqual(2);
        });

        it("should call setStateEvents on the right RoomState with the right forwardLooking value for new events", async function () {
            const events: MatrixEvent[] = [
                utils.mkMembership({
                    room: roomId,
                    mship: "invite",
                    user: userB,
                    skey: userA,
                    event: true,
                }),
                utils.mkEvent({
                    type: EventType.RoomName,
                    room: roomId,
                    user: userB,
                    event: true,
                    content: {
                        name: "New room",
                    },
                }),
            ];
            await room.addLiveEvents(events);
            expect(room.currentState.setStateEvents).toHaveBeenCalledWith([events[0]], { timelineWasEmpty: false });
            expect(room.currentState.setStateEvents).toHaveBeenCalledWith([events[1]], { timelineWasEmpty: false });
            expect(events[0].forwardLooking).toBe(true);
            expect(events[1].forwardLooking).toBe(true);
            expect(room.oldState.setStateEvents).not.toHaveBeenCalled();
        });

        it("should synthesize read receipts for the senders of events", async function () {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            } as unknown as RoomMember;
            mocked(room.currentState.getSentinelMember).mockImplementation(function (uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            await room.addLiveEvents(events);
            expect(room.getEventReadUpTo(userA)).toEqual(events[1].getId());
        });

        it("should emit Room.localEchoUpdated when a local echo is updated", async function () {
            const localEvent = utils.mkMessage({
                room: roomId,
                user: userA,
                event: true,
            });
            localEvent.status = EventStatus.SENDING;
            const localEventId = localEvent.getId();

            const remoteEvent = utils.mkMessage({
                room: roomId,
                user: userA,
                event: true,
            });
            remoteEvent.event.unsigned = { transaction_id: "TXN_ID" };
            const remoteEventId = remoteEvent.getId();

            const stub = jest.fn();
            room.on(RoomEvent.LocalEchoUpdated, stub);

            // first add the local echo
            room.addPendingEvent(localEvent, "TXN_ID");
            expect(room.timeline.length).toEqual(1);

            expect(stub.mock.calls[0][0].getId()).toEqual(localEventId);
            expect(stub.mock.calls[0][0].status).toEqual(EventStatus.SENDING);
            expect(stub.mock.calls[0][1]).toEqual(room);
            expect(stub.mock.calls[0][2]).toBeUndefined();
            expect(stub.mock.calls[0][3]).toBeUndefined();

            // then the remoteEvent
            await room.addLiveEvents([remoteEvent]);
            expect(room.timeline.length).toEqual(1);

            expect(stub).toHaveBeenCalledTimes(2);

            expect(stub.mock.calls[1][0].getId()).toEqual(remoteEventId);
            expect(stub.mock.calls[1][0].status).toBeNull();
            expect(stub.mock.calls[1][1]).toEqual(room);
            expect(stub.mock.calls[1][2]).toEqual(localEventId);
            expect(stub.mock.calls[1][3]).toBe(EventStatus.SENDING);
        });

        it("should be able to update local echo without a txn ID (/send then /sync)", async function () {
            const eventJson = utils.mkMessage({
                room: roomId,
                user: userA,
                event: false,
            });
            delete eventJson["txn_id"];
            delete eventJson["event_id"];
            const localEvent = new MatrixEvent(Object.assign({ event_id: "$temp" }, eventJson));
            localEvent.status = EventStatus.SENDING;
            expect(localEvent.getTxnId()).toBeUndefined();
            expect(room.timeline.length).toEqual(0);

            // first add the local echo. This is done before the /send request is even sent.
            const txnId = "My_txn_id";
            room.addPendingEvent(localEvent, txnId);
            expect(room.getEventForTxnId(txnId)).toEqual(localEvent);
            expect(room.timeline.length).toEqual(1);

            // now the /send request returns the true event ID.
            const realEventId = "$real-event-id";
            room.updatePendingEvent(localEvent, EventStatus.SENT, realEventId);

            // then /sync returns the remoteEvent, it should de-dupe based on the event ID.
            const remoteEvent = new MatrixEvent(Object.assign({ event_id: realEventId }, eventJson));
            expect(remoteEvent.getTxnId()).toBeUndefined();
            await room.addLiveEvents([remoteEvent]);
            // the duplicate strategy code should ensure we don't add a 2nd event to the live timeline
            expect(room.timeline.length).toEqual(1);
            // but without the event ID matching we will still have the local event in pending events
            expect(room.getEventForTxnId(txnId)).toBeUndefined();
        });

        it("should be able to update local echo without a txn ID (/sync then /send)", async function () {
            const eventJson = utils.mkMessage({
                room: roomId,
                user: userA,
                event: false,
            });
            delete eventJson["txn_id"];
            delete eventJson["event_id"];
            const txnId = "My_txn_id";
            const localEvent = new MatrixEvent(Object.assign({ event_id: "$temp", txn_id: txnId }, eventJson));
            localEvent.status = EventStatus.SENDING;
            expect(localEvent.getTxnId()).toEqual(txnId);
            expect(room.timeline.length).toEqual(0);

            // first add the local echo. This is done before the /send request is even sent.
            room.addPendingEvent(localEvent, txnId);
            expect(room.getEventForTxnId(txnId)).toEqual(localEvent);
            expect(room.timeline.length).toEqual(1);

            // now the /sync returns the remoteEvent, it is impossible for the JS SDK to de-dupe this.
            const realEventId = "$real-event-id";
            const remoteEvent = new MatrixEvent(Object.assign({ event_id: realEventId }, eventJson));
            expect(remoteEvent.getUnsigned().transaction_id).toBeUndefined();
            await room.addLiveEvents([remoteEvent]);
            expect(room.timeline.length).toEqual(2); // impossible to de-dupe as no txn ID or matching event ID

            // then the /send request returns the real event ID.
            // Now it is possible for the JS SDK to de-dupe this.
            room.updatePendingEvent(localEvent, EventStatus.SENT, realEventId);

            // the 2nd event should be removed from the timeline.
            expect(room.timeline.length).toEqual(1);
            // but without the event ID matching we will still have the local event in pending events
            expect(room.getEventForTxnId(txnId)).toBeUndefined();
        });

        it("should correctly handle remote echoes from other devices", async () => {
            const remoteEvent = utils.mkMessage({
                room: roomId,
                user: userA,
                event: true,
            });
            remoteEvent.event.unsigned = { transaction_id: "TXN_ID" };

            // add the remoteEvent
            await room.addLiveEvents([remoteEvent]);
            expect(room.timeline.length).toEqual(1);
        });
    });

    describe("addEphemeralEvents", () => {
        it("should call RoomState.setTypingEvent on m.typing events", function () {
            const typing = utils.mkEvent({
                room: roomId,
                type: EventType.Typing,
                event: true,
                content: {
                    user_ids: [userA],
                },
            });
            room.addEphemeralEvents([typing]);
            expect(room.currentState.setTypingEvent).toHaveBeenCalledWith(typing);
        });
    });

    describe("addEventsToTimeline", function () {
        const events = [
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "changing room name",
                event: true,
            }),
            utils.mkEvent({
                type: EventType.RoomName,
                room: roomId,
                user: userA,
                event: true,
                content: { name: "New Room Name" },
            }),
        ];

        it("should not be able to add events to the end", function () {
            expect(function () {
                room.addEventsToTimeline(events, false, room.getLiveTimeline());
            }).toThrow();
        });

        it("should be able to add events to the start", function () {
            room.addEventsToTimeline(events, true, room.getLiveTimeline());
            expect(room.timeline.length).toEqual(2);
            expect(room.timeline[0]).toEqual(events[1]);
            expect(room.timeline[1]).toEqual(events[0]);
        });

        it("should emit 'Room.timeline' events when added to the start", function () {
            let callCount = 0;
            room.on(RoomEvent.Timeline, function (event, emitRoom, toStart) {
                callCount += 1;
                expect(room.timeline.length).toEqual(callCount);
                expect(event).toEqual(events[callCount - 1]);
                expect(emitRoom).toEqual(room);
                expect(toStart).toBe(true);
            });
            room.addEventsToTimeline(events, true, room.getLiveTimeline());
            expect(callCount).toEqual(2);
        });
    });

    describe("event metadata handling", function () {
        it("should set event.sender for new and old events", async function () {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            } as unknown as RoomMember;
            const oldSentinel = {
                userId: userA,
                membership: "join",
                name: "Old Alice",
            } as unknown as RoomMember;
            mocked(room.currentState.getSentinelMember).mockImplementation(function (uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            mocked(room.oldState.getSentinelMember).mockImplementation(function (uid) {
                if (uid === userA) {
                    return oldSentinel;
                }
                return null;
            });

            const newEv = utils.mkEvent({
                type: EventType.RoomName,
                room: roomId,
                user: userA,
                event: true,
                content: { name: "New Room Name" },
            });
            const oldEv = utils.mkEvent({
                type: EventType.RoomName,
                room: roomId,
                user: userA,
                event: true,
                content: { name: "Old Room Name" },
            });
            await room.addLiveEvents([newEv]);
            expect(newEv.sender).toEqual(sentinel);
            room.addEventsToTimeline([oldEv], true, room.getLiveTimeline());
            expect(oldEv.sender).toEqual(oldSentinel);
        });

        it("should set event.target for new and old m.room.member events", async function () {
            const sentinel = {
                userId: userA,
                membership: "join",
                name: "Alice",
            } as unknown as RoomMember;
            const oldSentinel = {
                userId: userA,
                membership: "join",
                name: "Old Alice",
            } as unknown as RoomMember;
            mocked(room.currentState.getSentinelMember).mockImplementation(function (uid) {
                if (uid === userA) {
                    return sentinel;
                }
                return null;
            });
            mocked(room.oldState.getSentinelMember).mockImplementation(function (uid) {
                if (uid === userA) {
                    return oldSentinel;
                }
                return null;
            });

            const newEv = utils.mkMembership({
                room: roomId,
                mship: "invite",
                user: userB,
                skey: userA,
                event: true,
            });
            const oldEv = utils.mkMembership({
                room: roomId,
                mship: "ban",
                user: userB,
                skey: userA,
                event: true,
            });
            await room.addLiveEvents([newEv]);
            expect(newEv.target).toEqual(sentinel);
            room.addEventsToTimeline([oldEv], true, room.getLiveTimeline());
            expect(oldEv.target).toEqual(oldSentinel);
        });

        it(
            "should call setStateEvents on the right RoomState with the right " + "forwardLooking value for old events",
            function () {
                const events: MatrixEvent[] = [
                    utils.mkMembership({
                        room: roomId,
                        mship: "invite",
                        user: userB,
                        skey: userA,
                        event: true,
                    }),
                    utils.mkEvent({
                        type: EventType.RoomName,
                        room: roomId,
                        user: userB,
                        event: true,
                        content: {
                            name: "New room",
                        },
                    }),
                ];

                room.addEventsToTimeline(events, true, room.getLiveTimeline());
                expect(room.oldState.setStateEvents).toHaveBeenCalledWith([events[0]], { timelineWasEmpty: undefined });
                expect(room.oldState.setStateEvents).toHaveBeenCalledWith([events[1]], { timelineWasEmpty: undefined });
                expect(events[0].forwardLooking).toBe(false);
                expect(events[1].forwardLooking).toBe(false);
                expect(room.currentState.setStateEvents).not.toHaveBeenCalled();
            },
        );
    });

    const resetTimelineTests = function (timelineSupport: boolean) {
        let events: MatrixEvent[];

        beforeEach(function () {
            room = new Room(roomId, new TestClient(userA).client, userA, { timelineSupport: timelineSupport });
            // set events each time to avoid resusing Event objects (which
            // doesn't work because they get frozen)
            events = [
                utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "A message",
                    event: true,
                }),
                utils.mkEvent({
                    type: EventType.RoomName,
                    room: roomId,
                    user: userA,
                    event: true,
                    content: { name: "New Room Name" },
                }),
                utils.mkEvent({
                    type: EventType.RoomName,
                    room: roomId,
                    user: userA,
                    event: true,
                    content: { name: "Another New Name" },
                }),
            ];
        });

        it("should copy state from previous timeline", async function () {
            await room.addLiveEvents([events[0], events[1]]);
            expect(room.getLiveTimeline().getEvents().length).toEqual(2);
            room.resetLiveTimeline("sometoken", "someothertoken");

            await room.addLiveEvents([events[2]]);
            const oldState = room.getLiveTimeline().getState(EventTimeline.BACKWARDS);
            const newState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
            expect(room.getLiveTimeline().getEvents().length).toEqual(1);
            expect(oldState?.getStateEvents(EventType.RoomName, "")).toEqual(events[1]);
            expect(newState?.getStateEvents(EventType.RoomName, "")).toEqual(events[2]);
        });

        it("should reset the legacy timeline fields", async function () {
            await room.addLiveEvents([events[0], events[1]]);
            expect(room.timeline.length).toEqual(2);

            const oldStateBeforeRunningReset = room.oldState;
            let oldStateUpdateEmitCount = 0;
            room.on(RoomEvent.OldStateUpdated, function (room, previousOldState, oldState) {
                expect(previousOldState).toBe(oldStateBeforeRunningReset);
                expect(oldState).toBe(room.oldState);
                oldStateUpdateEmitCount += 1;
            });

            const currentStateBeforeRunningReset = room.currentState;
            let currentStateUpdateEmitCount = 0;
            room.on(RoomEvent.CurrentStateUpdated, function (room, previousCurrentState, currentState) {
                expect(previousCurrentState).toBe(currentStateBeforeRunningReset);
                expect(currentState).toBe(room.currentState);
                currentStateUpdateEmitCount += 1;
            });

            room.resetLiveTimeline("sometoken", "someothertoken");

            await room.addLiveEvents([events[2]]);
            const newLiveTimeline = room.getLiveTimeline();
            expect(room.timeline).toEqual(newLiveTimeline.getEvents());
            expect(room.oldState).toEqual(newLiveTimeline.getState(EventTimeline.BACKWARDS));
            expect(room.currentState).toEqual(newLiveTimeline.getState(EventTimeline.FORWARDS));
            // Make sure `RoomEvent.OldStateUpdated` was emitted
            expect(oldStateUpdateEmitCount).toEqual(1);
            // Make sure `RoomEvent.OldStateUpdated` was emitted if necessary
            expect(currentStateUpdateEmitCount).toEqual(timelineSupport ? 1 : 0);
        });

        it("should emit Room.timelineReset event and set the correct pagination token", function () {
            let callCount = 0;
            room.on(RoomEvent.TimelineReset, function (emitRoom) {
                callCount += 1;
                expect(emitRoom).toEqual(room);

                // make sure that the pagination token has been set before the event is emitted.
                const tok = emitRoom?.getLiveTimeline().getPaginationToken(EventTimeline.BACKWARDS);

                expect(tok).toEqual("pagToken");
            });
            room.resetLiveTimeline("pagToken");
            expect(callCount).toEqual(1);
        });

        it("should " + (timelineSupport ? "remember" : "forget") + " old timelines", async function () {
            await room.addLiveEvents([events[0]]);
            expect(room.timeline.length).toEqual(1);
            const firstLiveTimeline = room.getLiveTimeline();
            room.resetLiveTimeline("sometoken", "someothertoken");

            const tl = room.getTimelineForEvent(events[0].getId()!);
            expect(tl).toBe(timelineSupport ? firstLiveTimeline : null);
        });
    };

    describe("resetLiveTimeline with timeline support enabled", () => {
        resetTimelineTests.bind(null, true);
    });
    describe("resetLiveTimeline with timeline support disabled", () => {
        resetTimelineTests.bind(null, false);
    });

    describe("compareEventOrdering", function () {
        beforeEach(function () {
            room = new Room(roomId, new TestClient(userA).client, userA, { timelineSupport: true });
        });

        const events: MatrixEvent[] = [
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "1111",
                event: true,
            }),
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "2222",
                event: true,
            }),
            utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "3333",
                event: true,
            }),
        ];

        it("should handle events in the same timeline", async function () {
            await room.addLiveEvents(events);

            expect(
                room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId()!, events[1].getId()!),
            ).toBeLessThan(0);
            expect(
                room.getUnfilteredTimelineSet().compareEventOrdering(events[2].getId()!, events[1].getId()!),
            ).toBeGreaterThan(0);
            expect(
                room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId()!, events[1].getId()!),
            ).toEqual(0);
        });

        it("should handle events in adjacent timelines", async function () {
            const oldTimeline = room.addTimeline();
            oldTimeline.setNeighbouringTimeline(room.getLiveTimeline(), Direction.Forward);
            room.getLiveTimeline().setNeighbouringTimeline(oldTimeline, Direction.Backward);

            room.addEventsToTimeline([events[0]], false, oldTimeline);
            await room.addLiveEvents([events[1]]);

            expect(
                room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId()!, events[1].getId()!),
            ).toBeLessThan(0);
            expect(
                room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId()!, events[0].getId()!),
            ).toBeGreaterThan(0);
        });

        it("should return null for events in non-adjacent timelines", async function () {
            const oldTimeline = room.addTimeline();

            room.addEventsToTimeline([events[0]], false, oldTimeline);
            await room.addLiveEvents([events[1]]);

            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId()!, events[1].getId()!)).toBe(
                null,
            );
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[1].getId()!, events[0].getId()!)).toBe(
                null,
            );
        });

        it("should return null for unknown events", async function () {
            await room.addLiveEvents(events);

            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId()!, "xxx")).toBe(null);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering("xxx", events[0].getId()!)).toBe(null);
            expect(room.getUnfilteredTimelineSet().compareEventOrdering(events[0].getId()!, events[0].getId()!)).toBe(
                0,
            );
        });
    });

    describe("getJoinedMembers", function () {
        it("should return members whose membership is 'join'", function () {
            mocked(room.currentState.getMembers).mockImplementation(function () {
                return [
                    { userId: "@alice:bar", membership: "join" } as unknown as RoomMember,
                    { userId: "@bob:bar", membership: "invite" } as unknown as RoomMember,
                    { userId: "@cleo:bar", membership: "leave" } as unknown as RoomMember,
                ];
            });
            const res = room.getJoinedMembers();
            expect(res.length).toEqual(1);
            expect(res[0].userId).toEqual("@alice:bar");
        });

        it("should return an empty list if no membership is 'join'", function () {
            mocked(room.currentState.getMembers).mockImplementation(function () {
                return [{ userId: "@bob:bar", membership: "invite" } as unknown as RoomMember];
            });
            const res = room.getJoinedMembers();
            expect(res.length).toEqual(0);
        });
    });

    describe("hasMembershipState", function () {
        it("should return true for a matching userId and membership", function () {
            mocked(room.currentState.getMember).mockImplementation(function (userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                    "@bob:bar": { userId: "@bob:bar", membership: "invite" },
                }[userId] as unknown as RoomMember;
            });
            expect(room.hasMembershipState("@bob:bar", "invite")).toBe(true);
        });

        it("should return false if match membership but no match userId", function () {
            mocked(room.currentState.getMember).mockImplementation(function (userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId] as unknown as RoomMember;
            });
            expect(room.hasMembershipState("@bob:bar", "join")).toBe(false);
        });

        it("should return false if match userId but no match membership", function () {
            mocked(room.currentState.getMember).mockImplementation(function (userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId] as unknown as RoomMember;
            });
            expect(room.hasMembershipState("@alice:bar", "ban")).toBe(false);
        });

        it("should return false if no match membership or userId", function () {
            mocked(room.currentState.getMember).mockImplementation(function (userId) {
                return {
                    "@alice:bar": { userId: "@alice:bar", membership: "join" },
                }[userId] as unknown as RoomMember;
            });
            expect(room.hasMembershipState("@bob:bar", "invite")).toBe(false);
        });

        it("should return false if no members exist", function () {
            expect(room.hasMembershipState("@foo:bar", "join")).toBe(false);
        });
    });

    describe("recalculate", function () {
        const setJoinRule = async function (rule: JoinRule) {
            await room.addLiveEvents([
                utils.mkEvent({
                    type: EventType.RoomJoinRules,
                    room: roomId,
                    user: userA,
                    content: {
                        join_rule: rule,
                    },
                    event: true,
                }),
            ]);
        };
        const setAltAliases = async function (aliases: string[]) {
            await room.addLiveEvents([
                utils.mkEvent({
                    type: EventType.RoomCanonicalAlias,
                    room: roomId,
                    skey: "",
                    content: {
                        alt_aliases: aliases,
                    },
                    event: true,
                }),
            ]);
        };
        const setAlias = async function (alias: string) {
            await room.addLiveEvents([
                utils.mkEvent({
                    type: EventType.RoomCanonicalAlias,
                    room: roomId,
                    skey: "",
                    content: { alias },
                    event: true,
                }),
            ]);
        };
        const setRoomName = async function (name: string) {
            await room.addLiveEvents([
                utils.mkEvent({
                    type: EventType.RoomName,
                    room: roomId,
                    user: userA,
                    content: {
                        name: name,
                    },
                    event: true,
                }),
            ]);
        };
        const addMember = async function (userId: string, state = "join", opts: any = {}) {
            opts.room = roomId;
            opts.mship = state;
            opts.user = opts.user || userId;
            opts.skey = userId;
            opts.event = true;
            const event = utils.mkMembership(opts);
            await room.addLiveEvents([event]);
            return event;
        };

        beforeEach(function () {
            // no mocking
            room = new Room(roomId, new TestClient(userA).client, userA);
        });

        describe("Room.recalculate => Stripped State Events", function () {
            it(
                "should set stripped state events as actual state events if the " + "room is an invite room",
                async function () {
                    const roomName = "flibble";

                    const event = await addMember(userA, "invite");
                    event.event.unsigned = {};
                    event.event.unsigned.invite_room_state = [
                        {
                            type: EventType.RoomName,
                            state_key: "",
                            content: {
                                name: roomName,
                            },
                            sender: "@bob:foobar",
                        },
                    ];

                    room.recalculate();
                    expect(room.name).toEqual(roomName);
                },
            );

            it("should not clobber state events if it isn't an invite room", async function () {
                const event = await addMember(userA, "join");
                const roomName = "flibble";
                setRoomName(roomName);
                const roomNameToIgnore = "ignoreme";
                event.event.unsigned = {};
                event.event.unsigned.invite_room_state = [
                    {
                        type: EventType.RoomName,
                        state_key: "",
                        content: {
                            name: roomNameToIgnore,
                        },
                        sender: "@bob:foobar",
                    },
                ];

                room.recalculate();
                expect(room.name).toEqual(roomName);
            });
        });

        describe("Room.recalculate => Room Name using room summary", function () {
            it("should use room heroes if available", function () {
                addMember(userA, "invite");
                addMember(userB);
                addMember(userC);
                addMember(userD);
                room.setSummary({
                    "m.heroes": [userB, userC, userD],
                });

                room.recalculate();
                expect(room.name).toEqual(`${userB} and 2 others`);
            });

            it("missing hero member state reverts to mxid", function () {
                room.setSummary({
                    "m.heroes": [userB],
                    "m.joined_member_count": 2,
                });

                room.recalculate();
                expect(room.name).toEqual(userB);
            });

            it("uses hero name from state", function () {
                const name = "Mr B";
                addMember(userA, "invite");
                addMember(userB, "join", { name });
                room.setSummary({
                    "m.heroes": [userB],
                });

                room.recalculate();
                expect(room.name).toEqual(name);
            });

            it("uses counts from summary", function () {
                const name = "Mr B";
                addMember(userB, "join", { name });
                room.setSummary({
                    "m.heroes": [userB],
                    "m.joined_member_count": 50,
                    "m.invited_member_count": 50,
                });
                room.recalculate();
                expect(room.name).toEqual(`${name} and 98 others`);
            });

            it("relies on heroes in case of absent counts", function () {
                const nameB = "Mr Bean";
                const nameC = "Mel C";
                addMember(userB, "join", { name: nameB });
                addMember(userC, "join", { name: nameC });
                room.setSummary({
                    "m.heroes": [userB, userC],
                });
                room.recalculate();
                expect(room.name).toEqual(`${nameB} and ${nameC}`);
            });

            it("uses only heroes", function () {
                const nameB = "Mr Bean";
                addMember(userB, "join", { name: nameB });
                addMember(userC, "join");
                room.setSummary({
                    "m.heroes": [userB],
                });
                room.recalculate();
                expect(room.name).toEqual(nameB);
            });

            it("reverts to empty room in case of self chat", function () {
                room.setSummary({
                    "m.heroes": [],
                    "m.invited_member_count": 1,
                });
                room.recalculate();
                expect(room.name).toEqual("Empty room");
            });
        });

        describe("Room.recalculate => Room Name", function () {
            it(
                "should return the names of members in a private (invite join_rules)" +
                    " room if a room name and alias don't exist and there are >3 members.",
                function () {
                    setJoinRule(JoinRule.Invite);
                    addMember(userA);
                    addMember(userB);
                    addMember(userC);
                    addMember(userD);
                    room.recalculate();
                    const name = room.name;
                    // we expect at least 1 member to be mentioned
                    const others = [userB, userC, userD];
                    let found = false;
                    for (let i = 0; i < others.length; i++) {
                        if (name.indexOf(others[i]) !== -1) {
                            found = true;
                            break;
                        }
                    }
                    expect(found).toEqual(true);
                },
            );

            it(
                "should return the names of members in a private (invite join_rules)" +
                    " room if a room name and alias don't exist and there are >2 members.",
                function () {
                    setJoinRule(JoinRule.Invite);
                    addMember(userA);
                    addMember(userB);
                    addMember(userC);
                    room.recalculate();
                    const name = room.name;
                    expect(name.indexOf(userB)).not.toEqual(-1);
                    expect(name.indexOf(userC)).not.toEqual(-1);
                },
            );

            it(
                "should return the names of members in a public (public join_rules)" +
                    " room if a room name and alias don't exist and there are >2 members.",
                function () {
                    setJoinRule(JoinRule.Public);
                    addMember(userA);
                    addMember(userB);
                    addMember(userC);
                    room.recalculate();
                    const name = room.name;
                    expect(name.indexOf(userB)).not.toEqual(-1);
                    expect(name.indexOf(userC)).not.toEqual(-1);
                },
            );

            it(
                "should show the other user's name for public (public join_rules)" +
                    " rooms if a room name and alias don't exist and it is a 1:1-chat.",
                function () {
                    setJoinRule(JoinRule.Public);
                    addMember(userA);
                    addMember(userB);
                    room.recalculate();
                    const name = room.name;
                    expect(name.indexOf(userB)).not.toEqual(-1);
                },
            );

            it(
                "should show the other user's name for private " +
                    "(invite join_rules) rooms if a room name and alias don't exist and it" +
                    " is a 1:1-chat.",
                function () {
                    setJoinRule(JoinRule.Invite);
                    addMember(userA);
                    addMember(userB);
                    room.recalculate();
                    const name = room.name;
                    expect(name.indexOf(userB)).not.toEqual(-1);
                },
            );

            it(
                "should show the other user's name for private" +
                    " (invite join_rules) rooms if you are invited to it.",
                function () {
                    setJoinRule(JoinRule.Invite);
                    addMember(userA, "invite", { user: userB });
                    addMember(userB);
                    room.recalculate();
                    const name = room.name;
                    expect(name.indexOf(userB)).not.toEqual(-1);
                },
            );

            it(
                "should show the room alias if one exists for private " +
                    "(invite join_rules) rooms if a room name doesn't exist.",
                function () {
                    const alias = "#room_alias:here";
                    setJoinRule(JoinRule.Invite);
                    setAlias(alias);
                    room.recalculate();
                    const name = room.name;
                    expect(name).toEqual(alias);
                },
            );

            it(
                "should show the room alias if one exists for public " +
                    "(public join_rules) rooms if a room name doesn't exist.",
                function () {
                    const alias = "#room_alias:here";
                    setJoinRule(JoinRule.Public);
                    setAlias(alias);
                    room.recalculate();
                    const name = room.name;
                    expect(name).toEqual(alias);
                },
            );

            it("should not show alt aliases if a room name does not exist", () => {
                const alias = "#room_alias:here";
                setAltAliases([alias, "#another:here"]);
                room.recalculate();
                const name = room.name;
                expect(name).not.toEqual(alias);
            });

            it("should show the room name if one exists for private " + "(invite join_rules) rooms.", function () {
                const roomName = "A mighty name indeed";
                setJoinRule(JoinRule.Invite);
                setRoomName(roomName);
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(roomName);
            });

            it("should show the room name if one exists for public " + "(public join_rules) rooms.", function () {
                const roomName = "A mighty name indeed";
                setJoinRule(JoinRule.Public);
                setRoomName(roomName);
                room.recalculate();
                expect(room.name).toEqual(roomName);
            });

            it(
                "should return 'Empty room' for private (invite join_rules) rooms if" +
                    " a room name and alias don't exist and it is a self-chat.",
                function () {
                    setJoinRule(JoinRule.Invite);
                    addMember(userA);
                    room.recalculate();
                    expect(room.name).toEqual("Empty room");
                },
            );

            it(
                "should return 'Empty room' for public (public join_rules) rooms if a" +
                    " room name and alias don't exist and it is a self-chat.",
                function () {
                    setJoinRule(JoinRule.Public);
                    addMember(userA);
                    room.recalculate();
                    const name = room.name;
                    expect(name).toEqual("Empty room");
                },
            );

            it("should return 'Empty room' if there is no name, " + "alias or members in the room.", function () {
                room.recalculate();
                const name = room.name;
                expect(name).toEqual("Empty room");
            });

            it("should return '[inviter display name] if state event " + "available", function () {
                setJoinRule(JoinRule.Invite);
                addMember(userB, "join", { name: "Alice" });
                addMember(userA, "invite", { user: userA });
                room.recalculate();
                const name = room.name;
                expect(name).toEqual("Alice");
            });

            it("should return inviter mxid if display name not available", function () {
                setJoinRule(JoinRule.Invite);
                addMember(userB);
                addMember(userA, "invite", { user: userA });
                room.recalculate();
                const name = room.name;
                expect(name).toEqual(userB);
            });
        });
    });

    describe("receipts", function () {
        const eventToAck = utils.mkMessage({
            room: roomId,
            user: userA,
            msg: "PLEASE ACKNOWLEDGE MY EXISTENCE",
            event: true,
        });

        function mkReceipt(roomId: string, records: Array<ReturnType<typeof mkRecord>>) {
            const content: IContent = {};
            records.forEach(function (r) {
                if (!content[r.eventId]) {
                    content[r.eventId] = {};
                }
                if (!content[r.eventId][r.type]) {
                    content[r.eventId][r.type] = {};
                }
                content[r.eventId][r.type][r.userId] = {
                    ts: r.ts,
                };
            });
            return new MatrixEvent({
                content: content,
                room_id: roomId,
                type: "m.receipt",
            });
        }

        function mkRecord(eventId: string, type: string, userId: string, ts: number) {
            ts = ts || Date.now();
            return {
                eventId: eventId,
                type: type,
                userId: userId,
                ts: ts,
            };
        }

        describe("addReceipt", function () {
            it("should store the receipt so it can be obtained via getReceiptsForEvent", function () {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [mkRecord(eventToAck.getId()!, "m.read", userB, ts)]));
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([
                    {
                        type: "m.read",
                        userId: userB,
                        data: {
                            ts: ts,
                        },
                    },
                ]);
            });

            it("should emit an event when a receipt is added", function () {
                const listener = jest.fn();
                room.on(RoomEvent.Receipt, listener);

                const ts = 13787898424;

                const receiptEvent = mkReceipt(roomId, [mkRecord(eventToAck.getId()!, "m.read", userB, ts)]);

                room.addReceipt(receiptEvent);
                expect(listener).toHaveBeenCalledWith(receiptEvent, room);
            });

            it("should clobber receipts based on type and user ID", function () {
                const nextEventToAck = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "I AM HERE YOU KNOW",
                    event: true,
                });
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [mkRecord(eventToAck.getId()!, "m.read", userB, ts)]));
                const ts2 = 13787899999;
                room.addReceipt(mkReceipt(roomId, [mkRecord(nextEventToAck.getId()!, "m.read", userB, ts2)]));
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([]);
                expect(room.getReceiptsForEvent(nextEventToAck)).toEqual([
                    {
                        type: "m.read",
                        userId: userB,
                        data: {
                            ts: ts2,
                        },
                    },
                ]);
            });

            it("should persist multiple receipts for a single event ID", function () {
                const ts = 13787898424;
                room.addReceipt(
                    mkReceipt(roomId, [
                        mkRecord(eventToAck.getId()!, "m.read", userB, ts),
                        mkRecord(eventToAck.getId()!, "m.read", userC, ts),
                        mkRecord(eventToAck.getId()!, "m.read", userD, ts),
                    ]),
                );
                expect(room.getUsersReadUpTo(eventToAck)).toEqual([userB, userC, userD]);
            });

            it("should persist multiple receipts for a single receipt type", function () {
                const eventTwo = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "2222",
                    event: true,
                });
                const eventThree = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "3333",
                    event: true,
                });
                const ts = 13787898424;
                room.addReceipt(
                    mkReceipt(roomId, [
                        mkRecord(eventToAck.getId()!, "m.read", userB, ts),
                        mkRecord(eventTwo.getId()!, "m.read", userC, ts),
                        mkRecord(eventThree.getId()!, "m.read", userD, ts),
                    ]),
                );
                expect(room.getUsersReadUpTo(eventToAck)).toEqual([userB]);
                expect(room.getUsersReadUpTo(eventTwo)).toEqual([userC]);
                expect(room.getUsersReadUpTo(eventThree)).toEqual([userD]);
            });

            it("should persist multiple receipts for a single user ID", function () {
                room.addReceipt(
                    mkReceipt(roomId, [
                        mkRecord(eventToAck.getId()!, "m.delivered", userB, 13787898424),
                        mkRecord(eventToAck.getId()!, "m.read", userB, 22222222),
                        mkRecord(eventToAck.getId()!, "m.seen", userB, 33333333),
                    ]),
                );
                expect(room.getReceiptsForEvent(eventToAck)).toEqual([
                    {
                        type: "m.delivered",
                        userId: userB,
                        data: {
                            ts: 13787898424,
                        },
                    },
                    {
                        type: "m.read",
                        userId: userB,
                        data: {
                            ts: 22222222,
                        },
                    },
                    {
                        type: "m.seen",
                        userId: userB,
                        data: {
                            ts: 33333333,
                        },
                    },
                ]);
            });

            it("should prioritise the most recent event", async function () {
                const events: MatrixEvent[] = [
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "1111",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "2222",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "3333",
                        event: true,
                    }),
                ];

                await room.addLiveEvents(events);
                const ts = 13787898424;

                // check it initialises correctly
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[0].getId()!, "m.read", userB, ts)]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[0].getId());

                // 2>0, so it should move forward
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[2].getId()!, "m.read", userB, ts)]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());

                // 1<2, so it should stay put
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[1].getId()!, "m.read", userB, ts)]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());
            });

            it("should prioritise the most recent event even if it is synthetic", async () => {
                const events: MatrixEvent[] = [
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "1111",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "2222",
                        event: true,
                    }),
                    utils.mkMessage({
                        room: roomId,
                        user: userA,
                        msg: "3333",
                        event: true,
                    }),
                ];

                await room.addLiveEvents(events);
                const ts = 13787898424;

                // check it initialises correctly
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[0].getId()!, "m.read", userB, ts)]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[0].getId());

                // 2>0, so it should move forward
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[2].getId()!, "m.read", userB, ts)]), true);
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());
                expect(room.getReceiptsForEvent(events[2])).toEqual([{ data: { ts }, type: "m.read", userId: userB }]);

                // 1<2, so it should stay put
                room.addReceipt(mkReceipt(roomId, [mkRecord(events[1].getId()!, "m.read", userB, ts)]));
                expect(room.getEventReadUpTo(userB)).toEqual(events[2].getId());
                expect(room.getEventReadUpTo(userB, true)).toEqual(events[1].getId());
                expect(room.getReceiptsForEvent(events[2])).toEqual([{ data: { ts }, type: "m.read", userId: userB }]);
            });
        });

        describe("getUsersReadUpTo", function () {
            it("should return user IDs read up to the given event", function () {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [mkRecord(eventToAck.getId()!, "m.read", userB, ts)]));
                expect(room.getUsersReadUpTo(eventToAck)).toEqual([userB]);
            });
        });

        describe("hasUserReadUpTo", function () {
            it("should acknowledge if an event has been read", function () {
                const ts = 13787898424;
                room.addReceipt(mkReceipt(roomId, [mkRecord(eventToAck.getId()!, "m.read", userB, ts)]));
                expect(room.hasUserReadEvent(userB, eventToAck.getId()!)).toEqual(true);
            });
            it("return false for an unknown event", function () {
                expect(room.hasUserReadEvent(userB, "unknown_event")).toEqual(false);
            });
        });
    });

    describe("tags", function () {
        function mkTags(roomId: string, tags: object) {
            const content = { tags: tags };
            return new MatrixEvent({
                content: content,
                room_id: roomId,
                type: "m.tag",
            });
        }

        describe("addTag", function () {
            it(
                "should set tags on rooms from event stream so " + "they can be obtained by the tags property",
                function () {
                    const tags = { "m.foo": { order: 0.5 } };
                    room.addTags(mkTags(roomId, tags));
                    expect(room.tags).toEqual(tags);
                },
            );

            it("should emit Room.tags event when new tags are " + "received on the event stream", function () {
                const listener = jest.fn();
                room.on(RoomEvent.Tags, listener);

                const tags = { "m.foo": { order: 0.5 } };
                const event = mkTags(roomId, tags);
                room.addTags(event);
                expect(listener).toHaveBeenCalledWith(event, room);
            });

            // XXX: shouldn't we try injecting actual m.tag events onto the eventstream
            // rather than injecting via room.addTags()?
        });
    });

    describe("addPendingEvent", function () {
        it(
            "should add pending events to the pendingEventList if " + "pendingEventOrdering == 'detached'",
            async function () {
                const client = new TestClient("@alice:example.com", "alicedevice").client;
                client.supportsThreads = () => true;
                const room = new Room(roomId, client, userA, {
                    pendingEventOrdering: PendingEventOrdering.Detached,
                });
                const eventA = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "remote 1",
                    event: true,
                });
                const eventB = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "local 1",
                    event: true,
                });
                eventB.status = EventStatus.SENDING;
                const eventC = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "remote 2",
                    event: true,
                });
                await room.addLiveEvents([eventA]);
                room.addPendingEvent(eventB, "TXN1");
                await room.addLiveEvents([eventC]);
                expect(room.timeline).toEqual([eventA, eventC]);
                expect(room.getPendingEvents()).toEqual([eventB]);
            },
        );

        it(
            "should add pending events to the timeline if " + "pendingEventOrdering == 'chronological'",
            async function () {
                const room = new Room(roomId, new TestClient(userA).client, userA, {
                    pendingEventOrdering: PendingEventOrdering.Chronological,
                });
                const eventA = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "remote 1",
                    event: true,
                });
                const eventB = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "local 1",
                    event: true,
                });
                eventB.status = EventStatus.SENDING;
                const eventC = utils.mkMessage({
                    room: roomId,
                    user: userA,
                    msg: "remote 2",
                    event: true,
                });
                await room.addLiveEvents([eventA]);
                room.addPendingEvent(eventB, "TXN1");
                await room.addLiveEvents([eventC]);
                expect(room.timeline).toEqual([eventA, eventB, eventC]);
            },
        );

        it("should apply redactions eagerly in the pending event list", () => {
            const client = new TestClient("@alice:example.com", "alicedevice").client;
            const room = new Room(roomId, client, userA, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            const eventA = utils.mkMessage({
                room: roomId,
                user: userA,
                msg: "remote 1",
                event: true,
            });
            eventA.status = EventStatus.SENDING;
            const redactA = utils.mkEvent({
                room: roomId,
                user: userA,
                type: EventType.RoomRedaction,
                content: {},
                redacts: eventA.getId()!,
                event: true,
            });
            redactA.status = EventStatus.SENDING;

            room.addPendingEvent(eventA, "TXN1");
            expect(room.getPendingEvents()).toEqual([eventA]);
            room.addPendingEvent(redactA, "TXN2");
            expect(room.getPendingEvents()).toEqual([eventA, redactA]);
            expect(eventA.isRedacted()).toBeTruthy();
        });
    });

    describe("updatePendingEvent", function () {
        it("should remove cancelled events from the pending list", function () {
            const client = new TestClient("@alice:example.com", "alicedevice").client;
            const room = new Room(roomId, client, userA, {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });
            const eventA = utils.mkMessage({
                room: roomId,
                user: userA,
                event: true,
            });
            eventA.status = EventStatus.SENDING;
            const eventId = eventA.getId();

            room.addPendingEvent(eventA, "TXN1");
            expect(room.getPendingEvents()).toEqual([eventA]);

            // the event has to have been failed or queued before it can be
            // cancelled
            room.updatePendingEvent(eventA, EventStatus.NOT_SENT);

            let callCount = 0;
            room.on(RoomEvent.LocalEchoUpdated, function (event, emitRoom, oldEventId, oldStatus) {
                expect(event).toEqual(eventA);
                expect(event.status).toEqual(EventStatus.CANCELLED);
                expect(emitRoom).toEqual(room);
                expect(oldEventId).toEqual(eventId);
                expect(oldStatus).toEqual(EventStatus.NOT_SENT);
                callCount++;
            });

            room.updatePendingEvent(eventA, EventStatus.CANCELLED);
            expect(room.getPendingEvents()).toEqual([]);
            expect(callCount).toEqual(1);
        });

        it("should remove cancelled events from the timeline", function () {
            const room = new Room(roomId, null!, userA);
            const eventA = utils.mkMessage({
                room: roomId,
                user: userA,
                event: true,
            });
            eventA.status = EventStatus.SENDING;
            const eventId = eventA.getId();

            room.addPendingEvent(eventA, "TXN1");
            expect(room.getLiveTimeline().getEvents()).toEqual([eventA]);

            // the event has to have been failed or queued before it can be
            // cancelled
            room.updatePendingEvent(eventA, EventStatus.NOT_SENT);

            let callCount = 0;
            room.on(RoomEvent.LocalEchoUpdated, function (event, emitRoom, oldEventId, oldStatus) {
                expect(event).toEqual(eventA);
                expect(event.status).toEqual(EventStatus.CANCELLED);
                expect(emitRoom).toEqual(room);
                expect(oldEventId).toEqual(eventId);
                expect(oldStatus).toEqual(EventStatus.NOT_SENT);
                callCount++;
            });

            room.updatePendingEvent(eventA, EventStatus.CANCELLED);
            expect(room.getLiveTimeline().getEvents()).toEqual([]);
            expect(callCount).toEqual(1);
        });
    });

    describe("loadMembersIfNeeded", function () {
        function createClientMock(
            serverResponse: Error | MatrixEvent[],
            storageResponse: MatrixEvent[] | Error | null = null,
        ) {
            return {
                getEventMapper: function () {
                    // events should already be MatrixEvents
                    return function (event: MatrixEvent) {
                        return event;
                    };
                },
                isCryptoEnabled() {
                    return true;
                },
                isRoomEncrypted: function () {
                    return false;
                },
                members: jest.fn().mockImplementation(() => {
                    if (serverResponse instanceof Error) {
                        return Promise.reject(serverResponse);
                    } else {
                        return Promise.resolve({ chunk: serverResponse });
                    }
                }),
                store: {
                    storageResponse,
                    storedMembers: [] as IStateEventWithRoomId[] | null,
                    getOutOfBandMembers: function () {
                        if (this.storageResponse instanceof Error) {
                            return Promise.reject(this.storageResponse);
                        } else {
                            return Promise.resolve(this.storageResponse);
                        }
                    },
                    setOutOfBandMembers: function (roomId: string, memberEvents: IStateEventWithRoomId[]) {
                        this.storedMembers = memberEvents;
                        return Promise.resolve();
                    },
                    getSyncToken: () => "sync_token",
                    getPendingEvents: jest.fn().mockResolvedValue([]),
                    setPendingEvents: jest.fn().mockResolvedValue(undefined),
                },
            };
        }

        const memberEvent = utils.mkMembership({
            user: "@user_a:bar",
            mship: "join",
            room: roomId,
            event: true,
            name: "User A",
        });

        it("should load members from server on first call", async function () {
            const client = createClientMock([memberEvent]);
            const room = new Room(roomId, client as any, null!, { lazyLoadMembers: true });
            await room.loadMembersIfNeeded();
            const memberA = room.getMember("@user_a:bar")!;
            expect(memberA.name).toEqual("User A");
            const storedMembers = client.store.storedMembers!;
            expect(storedMembers.length).toEqual(1);
            expect(storedMembers[0].event_id).toEqual(memberEvent.getId());
        });

        it("should take members from storage if available", async function () {
            const memberEvent2 = utils.mkMembership({
                user: "@user_a:bar",
                mship: "join",
                room: roomId,
                event: true,
                name: "Ms A",
            });
            const client = createClientMock([memberEvent2], [memberEvent]);
            const room = new Room(roomId, client as any, null!, { lazyLoadMembers: true });

            await room.loadMembersIfNeeded();

            const memberA = room.getMember("@user_a:bar")!;
            expect(memberA.name).toEqual("User A");
        });

        it("should allow retry on error", async function () {
            const client = createClientMock(new Error("server says no"));
            const room = new Room(roomId, client as any, null!, { lazyLoadMembers: true });
            await expect(room.loadMembersIfNeeded()).rejects.toBeTruthy();

            client.members.mockReturnValue({ chunk: [memberEvent] });
            await room.loadMembersIfNeeded();
            const memberA = room.getMember("@user_a:bar")!;
            expect(memberA.name).toEqual("User A");
        });
    });

    describe("getMyMembership", function () {
        it("should return synced membership if membership isn't available yet", function () {
            const room = new Room(roomId, null!, userA);
            room.updateMyMembership(JoinRule.Invite);
            expect(room.getMyMembership()).toEqual(JoinRule.Invite);
        });
        it("should emit a Room.myMembership event on a change", function () {
            const room = new Room(roomId, null!, userA);
            const events: {
                membership: string;
                oldMembership?: string;
            }[] = [];
            room.on(RoomEvent.MyMembership, (_room, membership, oldMembership) => {
                events.push({ membership, oldMembership });
            });
            room.updateMyMembership(JoinRule.Invite);
            expect(room.getMyMembership()).toEqual(JoinRule.Invite);
            expect(events[0]).toEqual({ membership: "invite", oldMembership: undefined });
            events.splice(0); //clear
            room.updateMyMembership(JoinRule.Invite);
            expect(events.length).toEqual(0);
            room.updateMyMembership("join");
            expect(room.getMyMembership()).toEqual("join");
            expect(events[0]).toEqual({ membership: "join", oldMembership: "invite" });
        });
    });

    describe("getDMInviter", () => {
        it("should delegate to RoomMember::getDMInviter if available", () => {
            const room = new Room(roomId, null!, userA);
            room.currentState.markOutOfBandMembersStarted();
            room.currentState.setOutOfBandMembers([
                new MatrixEvent({
                    type: EventType.RoomMember,
                    state_key: userA,
                    sender: userB,
                    content: {
                        membership: "invite",
                        is_direct: true,
                    },
                }),
            ]);

            expect(room.getDMInviter()).toBe(userB);
        });

        it("should fall back to summary heroes and return the first one", () => {
            const room = new Room(roomId, null!, userA);
            room.updateMyMembership("invite");
            room.setSummary({
                "m.heroes": [userA, userC],
                "m.joined_member_count": 1,
                "m.invited_member_count": 1,
            });

            expect(room.getDMInviter()).toBe(userC);
        });

        it("should return undefined if we're not joined or invited to the room", () => {
            const room = new Room(roomId, null!, userA);
            expect(room.getDMInviter()).toBeUndefined();
            room.updateMyMembership("leave");
            expect(room.getDMInviter()).toBeUndefined();
        });
    });

    describe("guessDMUserId", function () {
        it("should return first hero id", function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            room.setSummary({
                "m.heroes": [userB],
                "m.joined_member_count": 1,
                "m.invited_member_count": 1,
            });
            expect(room.guessDMUserId()).toEqual(userB);
        });
        it("should return first member that isn't self", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                }),
            ]);
            expect(room.guessDMUserId()).toEqual(userB);
        });
        it("should return self if only member present", function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            expect(room.guessDMUserId()).toEqual(userA);
        });
    });

    describe("getAvatarFallbackMember", () => {
        it("should should return undefined if the room isn't a 1:1", () => {
            const room = new Room(roomId, null!, userA);
            room.currentState.setJoinedMemberCount(2);
            room.currentState.setInvitedMemberCount(1);
            expect(room.getAvatarFallbackMember()).toBeUndefined();
        });

        it("should use summary heroes member if 1:1", () => {
            const room = new Room(roomId, null!, userA);
            room.currentState.markOutOfBandMembersStarted();
            room.currentState.setOutOfBandMembers([
                new MatrixEvent({
                    type: EventType.RoomMember,
                    state_key: userD,
                    sender: userD,
                    content: {
                        membership: "join",
                    },
                }),
            ]);
            room.setSummary({
                "m.heroes": [userA, userD],
                "m.joined_member_count": 1,
                "m.invited_member_count": 1,
            });
            expect(room.getAvatarFallbackMember()?.userId).toBe(userD);
        });
    });

    describe("maySendMessage", function () {
        it("should return false if synced membership not join", function () {
            const room = new Room(roomId, { isRoomEncrypted: () => false } as any, userA);
            room.updateMyMembership(JoinRule.Invite);
            expect(room.maySendMessage()).toEqual(false);
            room.updateMyMembership("leave");
            expect(room.maySendMessage()).toEqual(false);
            room.updateMyMembership("join");
            expect(room.maySendMessage()).toEqual(true);
        });
    });

    describe("getDefaultRoomName", function () {
        it("should return 'Empty room' if a user is the only member", function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
        });

        it("should return a display name if one other member is in the room", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return a display name if one other member is banned", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "ban",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room (was User B)");
        });

        it("should return a display name if one other member is invited", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "invite",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return 'Empty room (was User B)' if User B left the room", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "leave",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room (was User B)");
        });

        it("should return 'User B and User C' if in a room with two other users", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkMembership({
                    user: userC,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User C",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B and User C");
        });

        it("should return 'User B and 2 others' if in a room with three other users", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkMembership({
                    user: userC,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User C",
                }),
                utils.mkMembership({
                    user: userD,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User D",
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B and 2 others");
        });
    });

    describe("io.element.functional_users", function () {
        it("should return a display name (default behaviour) if no one is marked as a functional member", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    content: {
                        service_members: [],
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return a display name (default behaviour) if service members is a number (invalid)", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    content: {
                        service_members: 1,
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return a display name (default behaviour) if service members is a string (invalid)", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    content: {
                        service_members: userB,
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return 'Empty room' if the only other member is a functional member", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    content: {
                        service_members: [userB],
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
        });

        it("should return 'User B' if User B is the only other member who isn't a functional member", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkMembership({
                    user: userC,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User C",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    user: userA,
                    content: {
                        service_members: [userC],
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });

        it("should return 'Empty room' if all other members are functional members", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkMembership({
                    user: userC,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User C",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    user: userA,
                    content: {
                        service_members: [userB, userC],
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("Empty room");
        });

        it("should not break if an unjoined user is marked as a service user", async function () {
            const room = new Room(roomId, new TestClient(userA).client, userA);
            await room.addLiveEvents([
                utils.mkMembership({
                    user: userA,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User A",
                }),
                utils.mkMembership({
                    user: userB,
                    mship: "join",
                    room: roomId,
                    event: true,
                    name: "User B",
                }),
                utils.mkEvent({
                    type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                    skey: "",
                    room: roomId,
                    event: true,
                    user: userA,
                    content: {
                        service_members: [userC],
                    },
                }),
            ]);
            expect(room.getDefaultRoomName(userA)).toEqual("User B");
        });
    });

    describe("threads", function () {
        beforeEach(() => {
            const client = new TestClient("@alice:example.com", "alicedevice").client;
            room = new Room(roomId, client, userA);
            client.getRoom = () => room;
        });

        it("allow create threads without a root event", function () {
            const eventWithoutARootEvent = new MatrixEvent({
                event_id: "$123",
                room_id: roomId,
                content: {
                    "m.relates_to": {
                        rel_type: "m.thread",
                        event_id: "$000",
                    },
                },
                unsigned: {
                    age: 1,
                },
            });

            room.createThread("$000", undefined, [eventWithoutARootEvent], false);

            const rootEvent = new MatrixEvent({
                event_id: "$666",
                room_id: roomId,
                content: {},
                unsigned: {
                    "age": 1,
                    "m.relations": {
                        "m.thread": {
                            latest_event: null,
                            count: 1,
                            current_user_participated: false,
                        },
                    },
                },
            });

            expect(() => room.createThread(rootEvent.getId()!, rootEvent, [], false)).not.toThrow();
        });

        it("returns the same model when creating a thread twice", () => {
            const { thread, rootEvent } = mkThread({ room });

            expect(thread).toBeInstanceOf(Thread);

            const duplicateThread = room.createThread(rootEvent.getId()!, rootEvent, [], false);

            expect(duplicateThread).toBe(thread);
        });

        it("creating thread from edited event should not conflate old versions of the event", () => {
            const message = mkMessage();
            const edit = mkEdit(message);
            message.makeReplaced(edit);

            const thread = room.createThread("$000", message, [], true);
            expect(thread).toHaveLength(0);
        });

        it("Edits update the lastReply event", async () => {
            room.client.supportsThreads = () => true;
            Thread.setServerSideSupport(FeatureSupport.Stable);

            const randomMessage = mkMessage();
            const threadRoot = mkMessage();
            const threadResponse = mkThreadResponse(threadRoot);
            threadResponse.localTimestamp += 1000;
            const threadResponseEdit = mkEdit(threadResponse);
            threadResponseEdit.localTimestamp += 2000;

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: threadResponse.event,
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            room.client.fetchRelations = (
                roomId: string,
                eventId: string,
                relationType?: RelationType | string | null,
                eventType?: EventType | string | null,
                opts: IRelationsRequestOpts = { dir: Direction.Backward },
            ) =>
                Promise.resolve({
                    chunk: [threadResponse.event] as IEvent[],
                    next_batch: "start_token",
                });

            let prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents([randomMessage, threadRoot, threadResponse]);
            const thread: Thread = await prom;
            await emitPromise(room, ThreadEvent.Update);

            expect(thread.initialEventsFetched).toBeTruthy();
            expect(thread.replyToEvent!.event).toEqual(threadResponse.event);
            expect(thread.replyToEvent!.getContent().body).toBe(threadResponse.getContent().body);

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: {
                                    ...threadResponse.event,
                                    content: threadResponseEdit.getContent()["m.new_content"],
                                },
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            prom = emitPromise(room, ThreadEvent.Update);
            await room.addLiveEvents([threadResponseEdit]);
            await prom;
            expect(thread.replyToEvent!.getContent().body).toBe(threadResponseEdit.getContent()["m.new_content"].body);
        });

        it("Redactions to thread responses decrement the length", async () => {
            room.client.supportsThreads = () => true;
            Thread.setServerSideSupport(FeatureSupport.Stable);

            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            threadResponse1.localTimestamp += 1000;
            const threadResponse2 = mkThreadResponse(threadRoot);
            threadResponse2.localTimestamp += 2000;

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: threadResponse2.event,
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            let prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents([threadRoot, threadResponse1, threadResponse2]);
            const thread = await prom;
            await emitPromise(room, ThreadEvent.Update);

            expect(thread).toHaveLength(2);
            expect(thread.replyToEvent.getId()).toBe(threadResponse2.getId());

            thread.timelineSet.addEventToTimeline(threadResponse1, thread.liveTimeline, {
                toStartOfTimeline: true,
                fromCache: false,
                roomState: thread.roomState,
            });
            thread.timelineSet.addEventToTimeline(threadResponse2, thread.liveTimeline, {
                toStartOfTimeline: true,
                fromCache: false,
                roomState: thread.roomState,
            });

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: threadResponse2.event,
                                count: 1,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            prom = emitPromise(thread, ThreadEvent.Update);
            const threadResponse1Redaction = mkRedaction(threadResponse1);
            await room.addLiveEvents([threadResponse1Redaction]);
            await prom;
            expect(thread).toHaveLength(1);
            expect(thread.replyToEvent.getId()).toBe(threadResponse2.getId());
        });

        it("Redactions to reactions in threads do not decrement the length", async () => {
            room.client.supportsThreads = () => true;
            Thread.setServerSideSupport(FeatureSupport.Stable);

            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            threadResponse1.localTimestamp += 1000;
            const threadResponse2 = mkThreadResponse(threadRoot);
            threadResponse2.localTimestamp += 2000;
            const threadResponse2Reaction = utils.mkReaction(threadResponse2, room.client, userA, roomId);

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: threadResponse2.event,
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            const prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents([threadRoot, threadResponse1, threadResponse2, threadResponse2Reaction]);
            const thread = await prom;
            await emitPromise(room, ThreadEvent.Update);

            expect(thread).toHaveLength(2);
            expect(thread.replyToEvent.getId()).toBe(threadResponse2.getId());

            const threadResponse2ReactionRedaction = mkRedaction(threadResponse2Reaction);
            await room.addLiveEvents([threadResponse2ReactionRedaction]);
            expect(thread).toHaveLength(2);
            expect(thread.replyToEvent.getId()).toBe(threadResponse2.getId());
        });

        it("should not decrement the length when the thread root is redacted", async () => {
            room.client.supportsThreads = () => true;
            Thread.setServerSideSupport(FeatureSupport.Stable);

            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            threadResponse1.localTimestamp += 1000;
            const threadResponse2 = mkThreadResponse(threadRoot);
            threadResponse2.localTimestamp += 2000;
            const threadResponse2Reaction = utils.mkReaction(threadResponse2, room.client, userA, roomId);

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            [THREAD_RELATION_TYPE.name]: {
                                latest_event: threadResponse2.event,
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            let prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents([threadRoot, threadResponse1, threadResponse2, threadResponse2Reaction]);
            const thread = await prom;
            await emitPromise(room, ThreadEvent.Update);

            expect(thread).toHaveLength(2);
            expect(thread.replyToEvent.getId()).toBe(threadResponse2.getId());

            prom = emitPromise(room, ThreadEvent.Update);
            const threadRootRedaction = mkRedaction(threadRoot);
            await room.addLiveEvents([threadRootRedaction]);
            await prom;
            expect(thread).toHaveLength(2);
        });

        it("Redacting the lastEvent finds a new lastEvent", async () => {
            room.client.supportsThreads = () => true;
            Thread.setServerSideSupport(FeatureSupport.Stable);
            Thread.setServerSideListSupport(FeatureSupport.Stable);

            room.client.createThreadListMessagesRequest = () =>
                Promise.resolve({
                    chunk: [],
                    state: [],
                });

            await room.createThreadsTimelineSets();
            await room.fetchRoomThreads();

            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            threadResponse1.localTimestamp += 1000;
            const threadResponse2 = mkThreadResponse(threadRoot);
            threadResponse2.localTimestamp += 2000;

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            "m.thread": {
                                latest_event: threadResponse2.event,
                                count: 2,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            room.client.fetchRelations = (
                roomId: string,
                eventId: string,
                relationType?: RelationType | string | null,
                eventType?: EventType | string | null,
                opts: IRelationsRequestOpts = { dir: Direction.Backward },
            ) =>
                Promise.resolve({
                    chunk: [threadResponse1.event] as IEvent[],
                    next_batch: "start_token",
                });

            let prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents([threadRoot, threadResponse1]);
            const thread: Thread = await prom;
            await emitPromise(room, ThreadEvent.Update);

            expect(thread.initialEventsFetched).toBeTruthy();
            await room.addLiveEvents([threadResponse2]);
            expect(thread).toHaveLength(2);
            expect(thread.replyToEvent!.getId()).toBe(threadResponse2.getId());

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            "m.thread": {
                                latest_event: threadResponse1.event,
                                count: 1,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            prom = emitPromise(room, ThreadEvent.Update);
            const threadResponse2Redaction = mkRedaction(threadResponse2);
            await room.addLiveEvents([threadResponse2Redaction]);
            await prom;
            await emitPromise(room, ThreadEvent.Update);
            expect(thread).toHaveLength(1);
            expect(thread.replyToEvent!.getId()).toBe(threadResponse1.getId());

            room.client.fetchRoomEvent = (eventId: string) =>
                Promise.resolve({
                    ...threadRoot.event,
                    unsigned: {
                        "age": 123,
                        "m.relations": {
                            "m.thread": {
                                latest_event: threadRoot.event,
                                count: 0,
                                current_user_participated: true,
                            },
                        },
                    },
                });

            prom = emitPromise(room, ThreadEvent.Delete);
            const prom2 = emitPromise(room, RoomEvent.Timeline);
            const threadResponse1Redaction = mkRedaction(threadResponse1);
            await room.addLiveEvents([threadResponse1Redaction]);
            await prom;
            await prom2;
            expect(thread).toHaveLength(0);
            expect(thread.replyToEvent!.getId()).toBe(threadRoot.getId());
        });
    });

    describe("eventShouldLiveIn", () => {
        const client = new TestClient(userA).client;
        client.supportsThreads = () => true;
        Thread.setServerSideSupport(FeatureSupport.Stable);
        const room = new Room(roomId, client, userA);

        it("thread root and its relations&redactions should be in both", () => {
            const randomMessage = mkMessage();
            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            const threadReaction1 = utils.mkReaction(threadRoot, room.client, userA, roomId);
            const threadReaction2 = utils.mkReaction(threadRoot, room.client, userA, roomId);
            const threadReaction2Redaction = mkRedaction(threadReaction2);

            const roots = new Set([threadRoot.getId()!]);
            const events = [
                randomMessage,
                threadRoot,
                threadResponse1,
                threadReaction1,
                threadReaction2,
                threadReaction2Redaction,
            ];

            expect(room.eventShouldLiveIn(randomMessage, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(randomMessage, events, roots).shouldLiveInThread).toBeFalsy();

            expect(room.eventShouldLiveIn(threadRoot, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(threadRoot, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadRoot, events, roots).threadId).toBe(threadRoot.getId());
            expect(room.eventShouldLiveIn(threadResponse1, events, roots).shouldLiveInRoom).toBeFalsy();
            expect(room.eventShouldLiveIn(threadResponse1, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadResponse1, events, roots).threadId).toBe(threadRoot.getId());

            expect(room.eventShouldLiveIn(threadReaction1, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction1, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction1, events, roots).threadId).toBe(threadRoot.getId());
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).threadId).toBe(threadRoot.getId());
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).threadId).toBe(threadRoot.getId());
        });

        it("thread response and its relations&redactions should be only in thread timeline", () => {
            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            const threadReaction1 = utils.mkReaction(threadResponse1, room.client, userA, roomId);
            const threadReaction2 = utils.mkReaction(threadResponse1, room.client, userA, roomId);
            const threadReaction2Redaction = mkRedaction(threadReaction2);

            const roots = new Set([threadRoot.getId()!]);
            const events = [threadRoot, threadResponse1, threadReaction1, threadReaction2, threadReaction2Redaction];

            expect(room.eventShouldLiveIn(threadReaction1, events, roots).shouldLiveInRoom).toBeFalsy();
            expect(room.eventShouldLiveIn(threadReaction1, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction1, events, roots).threadId).toBe(threadRoot.getId());
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).shouldLiveInRoom).toBeFalsy();
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2, events, roots).threadId).toBe(threadRoot.getId());
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).shouldLiveInRoom).toBeFalsy();
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).shouldLiveInThread).toBeTruthy();
            expect(room.eventShouldLiveIn(threadReaction2Redaction, events, roots).threadId).toBe(threadRoot.getId());
        });

        it("reply to thread response and its relations&redactions should be only in main timeline", () => {
            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            const reply1 = mkReply(threadResponse1);
            const reaction1 = utils.mkReaction(reply1, room.client, userA, roomId);
            const reaction2 = utils.mkReaction(reply1, room.client, userA, roomId);
            const reaction2Redaction = mkRedaction(reply1);

            const roots = new Set([threadRoot.getId()!]);
            const events = [threadRoot, threadResponse1, reply1, reaction1, reaction2, reaction2Redaction];

            expect(room.eventShouldLiveIn(reply1, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reply1, events, roots).shouldLiveInThread).toBeFalsy();
            expect(room.eventShouldLiveIn(reaction1, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reaction1, events, roots).shouldLiveInThread).toBeFalsy();
            expect(room.eventShouldLiveIn(reaction2, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reaction2, events, roots).shouldLiveInThread).toBeFalsy();
            expect(room.eventShouldLiveIn(reaction2Redaction, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reaction2Redaction, events, roots).shouldLiveInThread).toBeFalsy();
        });

        it("reply to reply to thread root should only be in the main timeline", () => {
            const threadRoot = mkMessage();
            const threadResponse1 = mkThreadResponse(threadRoot);
            const reply1 = mkReply(threadRoot);
            const reply2 = mkReply(reply1);

            const roots = new Set([threadRoot.getId()!]);
            const events = [threadRoot, threadResponse1, reply1, reply2];

            expect(room.eventShouldLiveIn(reply1, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reply1, events, roots).shouldLiveInThread).toBeFalsy();
            expect(room.eventShouldLiveIn(reply2, events, roots).shouldLiveInRoom).toBeTruthy();
            expect(room.eventShouldLiveIn(reply2, events, roots).shouldLiveInThread).toBeFalsy();
        });

        it("should aggregate relations in thread event timeline set", async () => {
            Thread.setServerSideSupport(FeatureSupport.Stable);
            const threadRoot = mkMessage();
            const rootReaction = utils.mkReaction(threadRoot, room.client, userA, roomId);
            const threadResponse = mkThreadResponse(threadRoot);
            const threadReaction = utils.mkReaction(threadResponse, room.client, userA, roomId);

            const events = [threadRoot, rootReaction, threadResponse, threadReaction];

            const prom = emitPromise(room, ThreadEvent.New);
            await room.addLiveEvents(events);
            const thread = await prom;
            expect(thread).toBe(threadRoot.getThread());
            expect(thread.rootEvent).toBe(threadRoot);

            const rootRelations = thread.timelineSet.relations
                .getChildEventsForEvent(threadRoot.getId()!, RelationType.Annotation, EventType.Reaction)!
                .getSortedAnnotationsByKey();
            expect(rootRelations).toHaveLength(1);
            expect(rootRelations![0][0]).toEqual(rootReaction.getRelation()!.key);
            expect(rootRelations![0][1].size).toEqual(1);
            expect(rootRelations![0][1].has(rootReaction)).toBeTruthy();

            const responseRelations = thread.timelineSet.relations
                .getChildEventsForEvent(threadResponse.getId()!, RelationType.Annotation, EventType.Reaction)!
                .getSortedAnnotationsByKey();
            expect(responseRelations).toHaveLength(1);
            expect(responseRelations![0][0]).toEqual(threadReaction.getRelation()!.key);
            expect(responseRelations![0][1].size).toEqual(1);
            expect(responseRelations![0][1].has(threadReaction)).toBeTruthy();
        });
    });

    describe("getEventReadUpTo()", () => {
        const client = new TestClient(userA).client;
        const room = new Room(roomId, client, userA);

        it("handles missing receipt type", () => {
            room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                return receiptType === ReceiptType.ReadPrivate ? ({ eventId: "eventId" } as WrappedReceipt) : null;
            };

            expect(room.getEventReadUpTo(userA)).toEqual("eventId");
        });

        describe("prefers newer receipt", () => {
            it("should compare correctly using timelines", () => {
                room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                    if (receiptType === ReceiptType.ReadPrivate) {
                        return { eventId: "eventId1" } as WrappedReceipt;
                    }
                    if (receiptType === ReceiptType.Read) {
                        return { eventId: "eventId2" } as WrappedReceipt;
                    }
                    return null;
                };

                for (let i = 1; i <= 2; i++) {
                    room.getUnfilteredTimelineSet = () =>
                        ({
                            compareEventOrdering: (event1, event2) => {
                                return event1 === `eventId${i}` ? 1 : -1;
                            },
                        } as EventTimelineSet);

                    expect(room.getEventReadUpTo(userA)).toEqual(`eventId${i}`);
                }
            });

            describe("correctly compares by timestamp", () => {
                it("should correctly compare, if we have all receipts", () => {
                    for (let i = 1; i <= 2; i++) {
                        room.getUnfilteredTimelineSet = () =>
                            ({
                                compareEventOrdering: (_1, _2) => null,
                            } as EventTimelineSet);
                        room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                            if (receiptType === ReceiptType.ReadPrivate) {
                                return { eventId: "eventId1", data: { ts: i === 1 ? 2 : 1 } } as WrappedReceipt;
                            }
                            if (receiptType === ReceiptType.Read) {
                                return { eventId: "eventId2", data: { ts: i === 2 ? 2 : 1 } } as WrappedReceipt;
                            }
                            return null;
                        };

                        expect(room.getEventReadUpTo(userA)).toEqual(`eventId${i}`);
                    }
                });

                it("should correctly compare, if private read receipt is missing", () => {
                    room.getUnfilteredTimelineSet = () =>
                        ({
                            compareEventOrdering: (_1, _2) => null,
                        } as EventTimelineSet);
                    room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                        if (receiptType === ReceiptType.Read) {
                            return { eventId: "eventId2", data: { ts: 1 } } as WrappedReceipt;
                        }
                        return null;
                    };

                    expect(room.getEventReadUpTo(userA)).toEqual(`eventId2`);
                });
            });

            describe("fallback precedence", () => {
                beforeAll(() => {
                    room.getUnfilteredTimelineSet = () =>
                        ({
                            compareEventOrdering: (_1, _2) => null,
                        } as EventTimelineSet);
                });

                it("should give precedence to m.read.private", () => {
                    room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                        if (receiptType === ReceiptType.ReadPrivate) {
                            return { eventId: "eventId1" } as WrappedReceipt;
                        }
                        if (receiptType === ReceiptType.Read) {
                            return { eventId: "eventId2" } as WrappedReceipt;
                        }
                        return null;
                    };

                    expect(room.getEventReadUpTo(userA)).toEqual(`eventId1`);
                });

                it("should give precedence to m.read", () => {
                    room.getReadReceiptForUserId = (userId, ignore, receiptType): WrappedReceipt | null => {
                        if (receiptType === ReceiptType.Read) {
                            return { eventId: "eventId3" } as WrappedReceipt;
                        }
                        return null;
                    };

                    expect(room.getEventReadUpTo(userA)).toEqual(`eventId3`);
                });
            });
        });
    });

    describe("roomNameGenerator", () => {
        const client = new TestClient(userA).client;
        client.roomNameGenerator = jest.fn().mockReturnValue(null);
        const room = new Room(roomId, client, userA);

        it("should call fn when recalculating room name", () => {
            (client.roomNameGenerator as jest.Mock).mockClear();
            room.recalculate();
            expect(client.roomNameGenerator).toHaveBeenCalled();
        });
    });

    describe("thread notifications", () => {
        let room: Room;

        beforeEach(() => {
            const client = new TestClient(userA).client;
            room = new Room(roomId, client, userA);
        });

        it("defaults to undefined", () => {
            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Total)).toBe(0);
            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Highlight)).toBe(0);
        });

        it("lets you set values", () => {
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 1);

            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Total)).toBe(1);
            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Highlight)).toBe(0);

            room.setThreadUnreadNotificationCount("123", NotificationCountType.Highlight, 10);

            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Total)).toBe(1);
            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Highlight)).toBe(10);
        });

        it("lets you reset threads notifications", () => {
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 666);
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Highlight, 123);

            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Highlight);

            room.resetThreadUnreadNotificationCount();

            expect(room.threadsAggregateNotificationType).toBe(null);

            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Total)).toBe(0);
            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Highlight)).toBe(0);
        });

        it("sets the room threads notification type", () => {
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 666);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Total);
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Highlight, 123);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Highlight);
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 333);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Highlight);
        });

        it("partially resets room notifications", () => {
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 666);
            room.setThreadUnreadNotificationCount("456", NotificationCountType.Highlight, 123);

            room.resetThreadUnreadNotificationCount(["123"]);

            expect(room.getThreadUnreadNotificationCount("123", NotificationCountType.Total)).toBe(666);
            expect(room.getThreadUnreadNotificationCount("456", NotificationCountType.Highlight)).toBe(0);
        });

        it("emits event on notifications reset", () => {
            const cb = jest.fn();

            room.on(RoomEvent.UnreadNotifications, cb);

            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 666);
            room.setThreadUnreadNotificationCount("456", NotificationCountType.Highlight, 123);

            room.resetThreadUnreadNotificationCount();

            expect(cb).toHaveBeenLastCalledWith();
        });
    });

    describe("hasThreadUnreadNotification", () => {
        it("has no notifications by default", () => {
            expect(room.hasThreadUnreadNotification()).toBe(false);
        });

        it("main timeline notification does not affect this", () => {
            room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);
            expect(room.hasThreadUnreadNotification()).toBe(false);
            room.setUnreadNotificationCount(NotificationCountType.Total, 1);
            expect(room.hasThreadUnreadNotification()).toBe(false);

            room.setThreadUnreadNotificationCount("123", NotificationCountType.Total, 1);
            expect(room.hasThreadUnreadNotification()).toBe(true);
        });

        it("lets you reset", () => {
            room.setThreadUnreadNotificationCount("123", NotificationCountType.Highlight, 1);
            expect(room.hasThreadUnreadNotification()).toBe(true);

            room.resetThreadUnreadNotificationCount();

            expect(room.hasThreadUnreadNotification()).toBe(false);
        });
    });

    describe("threadsAggregateNotificationType", () => {
        it("defaults to null", () => {
            expect(room.threadsAggregateNotificationType).toBeNull();
        });

        it("counts multiple threads", () => {
            room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 1);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Total);

            room.setThreadUnreadNotificationCount("$456", NotificationCountType.Total, 1);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Total);

            room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 1);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Highlight);

            room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 0);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Total);
        });

        it("allows reset", () => {
            room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 1);
            room.setThreadUnreadNotificationCount("$456", NotificationCountType.Total, 1);
            room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 1);
            expect(room.threadsAggregateNotificationType).toBe(NotificationCountType.Highlight);

            room.resetThreadUnreadNotificationCount();

            expect(room.threadsAggregateNotificationType).toBeNull();
        });
    });

    it("should load pending events from from the store and decrypt if needed", async () => {
        const client = new TestClient(userA).client;
        client.crypto = client["cryptoBackend"] = {
            decryptEvent: jest.fn().mockResolvedValue({ clearEvent: { body: "enc" } }),
        } as unknown as Crypto;
        client.store.getPendingEvents = jest.fn(async (roomId) => [
            {
                event_id: "$1:server",
                type: "m.room.message",
                content: { body: "1" },
                sender: "@1:server",
                room_id: roomId,
                origin_server_ts: 1,
                txn_id: "txn1",
            },
            {
                event_id: "$2:server",
                type: "m.room.encrypted",
                content: { body: "2" },
                sender: "@2:server",
                room_id: roomId,
                origin_server_ts: 2,
                txn_id: "txn2",
            },
        ]);
        const room = new Room(roomId, client, userA, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        await emitPromise(room, RoomEvent.LocalEchoUpdated);
        await emitPromise(client, MatrixEventEvent.Decrypted);
        await emitPromise(room, RoomEvent.LocalEchoUpdated);
        const pendingEvents = room.getPendingEvents();
        expect(pendingEvents).toHaveLength(2);
        expect(pendingEvents[1].isDecryptionFailure()).toBeFalsy();
        expect(pendingEvents[1].isBeingDecrypted()).toBeFalsy();
        expect(pendingEvents[1].isEncrypted()).toBeTruthy();
        for (const ev of pendingEvents) {
            expect(room.getPendingEvent(ev.getId()!)).toBe(ev);
        }
    });

    describe("getBlacklistUnverifiedDevices", () => {
        it("defaults to null", () => {
            expect(room.getBlacklistUnverifiedDevices()).toBeNull();
        });

        it("is updated by setBlacklistUnverifiedDevices", () => {
            room.setBlacklistUnverifiedDevices(false);
            expect(room.getBlacklistUnverifiedDevices()).toBe(false);
        });
    });

    describe("processPollEvents()", () => {
        let room: Room;
        let client: MatrixClient;

        beforeEach(() => {
            client = getMockClientWithEventEmitter({
                decryptEventIfNeeded: jest.fn(),
            });
            room = new Room(roomId, client, userA);
            jest.spyOn(room, "emit").mockClear();
        });

        const makePollStart = (id: string): MatrixEvent => {
            const event = new MatrixEvent({
                ...PollStartEvent.from("What?", ["a", "b"], M_POLL_KIND_DISCLOSED.name).serialize(),
                room_id: roomId,
            });
            event.event.event_id = id;
            return event;
        };

        it("adds poll models to room state for a poll start event", async () => {
            const pollStartEvent = makePollStart("1");
            const events = [pollStartEvent];

            await room.processPollEvents(events);
            expect(client.decryptEventIfNeeded).toHaveBeenCalledWith(pollStartEvent);
            const pollInstance = room.polls.get(pollStartEvent.getId()!);
            expect(pollInstance).toBeTruthy();

            expect(room.emit).toHaveBeenCalledWith(PollEvent.New, pollInstance);
        });

        it("adds related events to poll models and log errors", async () => {
            const pollStartEvent = makePollStart("1");
            const pollStartEvent2 = makePollStart("2");
            const events = [pollStartEvent, pollStartEvent2];
            const pollResponseEvent = new MatrixEvent({
                type: M_POLL_RESPONSE.name,
                content: {
                    "m.relates_to": {
                        rel_type: RelationType.Reference,
                        event_id: pollStartEvent.getId(),
                    },
                },
            });

            const messageEvent = new MatrixEvent({
                type: "m.room.messsage",
                content: {
                    text: "hello",
                },
            });

            const errorEvent = new MatrixEvent({
                type: M_POLL_START.name,
                content: {
                    text: "Error!!!!",
                },
            });

            const error = new Error("Test error");

            mocked(client.decryptEventIfNeeded).mockImplementation(async (event: MatrixEvent) => {
                if (event === errorEvent) throw error;
            });

            // init poll
            await room.processPollEvents(events);

            const poll = room.polls.get(pollStartEvent.getId()!)!;
            const poll2 = room.polls.get(pollStartEvent2.getId()!)!;
            jest.spyOn(poll, "onNewRelation");
            jest.spyOn(poll2, "onNewRelation");

            await room.processPollEvents([errorEvent, messageEvent, pollResponseEvent]);

            // only called for relevant event
            expect(poll.onNewRelation).toHaveBeenCalledTimes(1);
            expect(poll.onNewRelation).toHaveBeenCalledWith(pollResponseEvent);

            // only called on poll with relation
            expect(poll2.onNewRelation).not.toHaveBeenCalled();

            expect(logger.warn).toHaveBeenCalledWith("Error processing poll event", errorEvent.getId(), error);
        });

        it("should retry on decryption", async () => {
            const pollStartEventId = "poll1";
            const pollStartEvent = makePollStart(pollStartEventId);
            // simulate decryption failure
            const isDecryptionFailureSpy = jest.spyOn(pollStartEvent, "isDecryptionFailure").mockReturnValue(true);

            await room.processPollEvents([pollStartEvent]);
            // do not expect a poll to show up for the room
            expect(room.polls.get(pollStartEventId)).toBeUndefined();

            // now emit a Decrypted event but keep the decryption failure
            pollStartEvent.emit(MatrixEventEvent.Decrypted, pollStartEvent);
            // still do not expect a poll to show up for the room
            expect(room.polls.get(pollStartEventId)).toBeUndefined();

            // clear decryption failure and emit a Decrypted event again
            isDecryptionFailureSpy.mockRestore();
            pollStartEvent.emit(MatrixEventEvent.Decrypted, pollStartEvent);

            // the poll should now show up in the room's polls
            const poll = room.polls.get(pollStartEventId);
            expect(poll?.pollId).toBe(pollStartEventId);
        });
    });

    describe("findPredecessorRoomId", () => {
        let client: MatrixClient | null = null;
        beforeEach(() => {
            client = getMockClientWithEventEmitter({
                ...mockClientMethodsUser(),
                isInitialSyncComplete: jest.fn().mockReturnValue(false),
                supportsThreads: jest.fn().mockReturnValue(true),
            });
        });

        function roomCreateEvent(newRoomId: string, predecessorRoomId: string | null): MatrixEvent {
            const content: {
                creator: string;
                ["m.federate"]: boolean;
                room_version: string;
                predecessor: { event_id: string; room_id: string } | undefined;
            } = {
                "creator": "@daryl:alexandria.example.com",
                "predecessor": undefined,
                "m.federate": true,
                "room_version": "9",
            };
            if (predecessorRoomId) {
                content.predecessor = {
                    event_id: "id_of_last_known_event",
                    room_id: predecessorRoomId,
                };
            }
            return new MatrixEvent({
                content,
                event_id: `create_event_id_pred_${predecessorRoomId}`,
                origin_server_ts: 1432735824653,
                room_id: newRoomId,
                sender: "@daryl:alexandria.example.com",
                state_key: "",
                type: "m.room.create",
            });
        }

        function predecessorEvent(
            newRoomId: string,
            predecessorRoomId: string,
            tombstoneEventId: string | null = null,
            viaServers: string[] = [],
        ): MatrixEvent {
            const content =
                tombstoneEventId === null
                    ? { predecessor_room_id: predecessorRoomId, via_servers: viaServers }
                    : {
                          predecessor_room_id: predecessorRoomId,
                          last_known_event_id: tombstoneEventId,
                          via_servers: viaServers,
                      };

            return new MatrixEvent({
                content,
                event_id: `predecessor_event_id_pred_${predecessorRoomId}`,
                origin_server_ts: 1432735824653,
                room_id: newRoomId,
                sender: "@daryl:alexandria.example.com",
                state_key: "",
                type: "org.matrix.msc3946.room_predecessor",
            });
        }

        it("Returns null if there is no create event", () => {
            const room = new Room("roomid", client!, "@u:example.com");
            expect(room.findPredecessor()).toBeNull();
        });

        it("Returns null if the create event has no predecessor", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([roomCreateEvent("roomid", null)]);
            expect(room.findPredecessor()).toBeNull();
        });

        it("Returns the predecessor ID if one is provided via create event", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([roomCreateEvent("roomid", "replacedroomid")]);
            expect(room.findPredecessor()).toEqual({ roomId: "replacedroomid", eventId: "id_of_last_known_event" });
        });

        it("Prefers the m.predecessor event if one exists", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([
                roomCreateEvent("roomid", "replacedroomid"),
                predecessorEvent("roomid", "otherreplacedroomid"),
            ]);
            const useMsc3946 = true;
            expect(room.findPredecessor(useMsc3946)).toEqual({
                roomId: "otherreplacedroomid",
                eventId: undefined, // m.predecessor did not include an event_id
                viaServers: [],
            });
        });

        it("uses the m.predecessor event ID if provided", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([
                roomCreateEvent("roomid", "replacedroomid"),
                predecessorEvent("roomid", "otherreplacedroomid", "lstevtid", ["one.example.com", "two.example.com"]),
            ]);
            const useMsc3946 = true;
            expect(room.findPredecessor(useMsc3946)).toEqual({
                roomId: "otherreplacedroomid",
                eventId: "lstevtid",
                viaServers: ["one.example.com", "two.example.com"],
            });
        });

        it("Ignores the m.predecessor event if we don't ask to use it", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([
                roomCreateEvent("roomid", "replacedroomid"),
                predecessorEvent("roomid", "otherreplacedroomid"),
            ]);
            // Don't provide an argument for msc3946ProcessDynamicPredecessor -
            // we should ignore the predecessor event.
            expect(room.findPredecessor()).toEqual({ roomId: "replacedroomid", eventId: "id_of_last_known_event" });
        });

        it("Ignores the m.predecessor event and returns null if we don't ask to use it", async () => {
            const room = new Room("roomid", client!, "@u:example.com");
            await room.addLiveEvents([
                roomCreateEvent("roomid", null), // Create event has no predecessor
                predecessorEvent("roomid", "otherreplacedroomid", "lastevtid"),
            ]);
            // Don't provide an argument for msc3946ProcessDynamicPredecessor -
            // we should ignore the predecessor event.
            expect(room.findPredecessor()).toBeNull();
        });
    });

    describe("getLastLiveEvent", () => {
        it("when there are no events, it should return undefined", () => {
            expect(room.getLastLiveEvent()).toBeUndefined();
        });

        it("when there is only an event in the main timeline and there are no threads, it should return the last event from the main timeline", async () => {
            const lastEventInMainTimeline = await mkMessageInRoom(room, 23);
            expect(room.getLastLiveEvent()).toBe(lastEventInMainTimeline);
        });

        /**
         * This should normally not happen. The test exists only for the sake of completeness.
         * No event is added to the room's live timeline here.
         */
        it("when there is no event in the room live timeline but in a thread, it should return the last event from the thread", () => {
            const { thread } = mkThread({ room, length: 0 });
            const lastEventInThread = mkMessageInThread(thread, 42);
            expect(room.getLastLiveEvent()).toBe(lastEventInThread);
        });

        describe("when there are events in both, the main timeline and threads", () => {
            it("and the last event is in a thread, it should return the last event from the thread", async () => {
                await mkMessageInRoom(room, 23);
                const { thread } = mkThread({ room, length: 0 });
                const lastEventInThread = mkMessageInThread(thread, 42);
                expect(room.getLastLiveEvent()).toBe(lastEventInThread);
            });

            it("and the last event is in the main timeline, it should return the last event from the main timeline", async () => {
                const lastEventInMainTimeline = await mkMessageInRoom(room, 42);
                const { thread } = mkThread({ room, length: 0 });
                mkMessageInThread(thread, 23);
                expect(room.getLastLiveEvent()).toBe(lastEventInMainTimeline);
            });

            it("and both events have the same timestamp, it should return the last event from the thread", async () => {
                await mkMessageInRoom(room, 23);
                const { thread } = mkThread({ room, length: 0 });
                const lastEventInThread = mkMessageInThread(thread, 23);
                expect(room.getLastLiveEvent()).toBe(lastEventInThread);
            });

            it("and there is a thread without any messages, it should return the last event from the main timeline", async () => {
                const lastEventInMainTimeline = await mkMessageInRoom(room, 23);
                mkThread({ room, length: 0 });
                expect(room.getLastLiveEvent()).toBe(lastEventInMainTimeline);
            });
        });
    });

    describe("getLastThread", () => {
        it("when there is no thread, it should return undefined", () => {
            expect(room.getLastThread()).toBeUndefined();
        });

        it("when there is only one thread, it should return this one", () => {
            const { thread1 } = addRoomThreads(room, 23, null);
            expect(room.getLastThread()).toBe(thread1);
        });

        it("when there are tho threads, it should return the one with the recent event I", () => {
            const { thread2 } = addRoomThreads(room, 23, 42);
            expect(room.getLastThread()).toBe(thread2);
        });

        it("when there are tho threads, it should return the one with the recent event II", () => {
            const { thread1 } = addRoomThreads(room, 42, 23);
            expect(room.getLastThread()).toBe(thread1);
        });

        it("when there is a thread with the last event ts undefined, it should return the thread with the defined event ts", () => {
            const { thread2 } = addRoomThreads(room, undefined, 23);
            expect(room.getLastThread()).toBe(thread2);
        });

        it("when the last event ts of all threads is undefined, it should return the last added thread", () => {
            const { thread2 } = addRoomThreads(room, undefined, undefined);
            expect(room.getLastThread()).toBe(thread2);
        });
    });
});
