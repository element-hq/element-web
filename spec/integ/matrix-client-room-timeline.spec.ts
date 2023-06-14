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

import HttpBackend from "matrix-mock-request";

import * as utils from "../test-utils/test-utils";
import { EventStatus } from "../../src/models/event";
import {
    MatrixError,
    ClientEvent,
    IEvent,
    MatrixClient,
    RoomEvent,
    ISyncResponse,
    IMinimalEvent,
    IRoomEvent,
    Room,
} from "../../src";
import { TestClient } from "../TestClient";

describe("MatrixClient room timelines", function () {
    const userId = "@alice:localhost";
    const userName = "Alice";
    const accessToken = "aseukfgwef";
    const roomId = "!foo:bar";
    const otherUserId = "@bob:localhost";
    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;

    const USER_MEMBERSHIP_EVENT = utils.mkMembership({
        room: roomId,
        mship: "join",
        user: userId,
        name: userName,
    });
    const ROOM_NAME_EVENT = utils.mkEvent({
        type: "m.room.name",
        room: roomId,
        user: otherUserId,
        content: {
            name: "Old room name",
        },
    });
    let NEXT_SYNC_DATA: Partial<ISyncResponse>;
    const SYNC_DATA = {
        next_batch: "s_5_3",
        rooms: {
            join: {
                "!foo:bar": {
                    // roomId
                    timeline: {
                        events: [
                            utils.mkMessage({
                                room: roomId,
                                user: otherUserId,
                                msg: "hello",
                            }),
                        ],
                        prev_batch: "f_1_1",
                    },
                    state: {
                        events: [
                            ROOM_NAME_EVENT,
                            utils.mkMembership({
                                room: roomId,
                                mship: "join",
                                user: otherUserId,
                                name: "Bob",
                            }),
                            USER_MEMBERSHIP_EVENT,
                            utils.mkEvent({
                                type: "m.room.create",
                                room: roomId,
                                user: userId,
                                content: {
                                    creator: userId,
                                },
                            }),
                        ],
                    },
                },
            },
        },
    };

    function setNextSyncData(events: Partial<IEvent>[] = []) {
        NEXT_SYNC_DATA = {
            next_batch: "n",
            presence: { events: [] },
            rooms: {
                invite: {},
                join: {
                    "!foo:bar": {
                        timeline: { events: [] },
                        state: { events: [] },
                        ephemeral: { events: [] },
                    },
                },
                leave: {},
            } as unknown as ISyncResponse["rooms"],
        };
        events.forEach(function (e) {
            if (e.room_id !== roomId) {
                throw new Error("setNextSyncData only works with one room id");
            }
            if (e.state_key) {
                // push the current
                NEXT_SYNC_DATA.rooms!.join[roomId].timeline.events.push(e as unknown as IRoomEvent);
            } else if (["m.typing", "m.receipt"].indexOf(e.type!) !== -1) {
                NEXT_SYNC_DATA.rooms!.join[roomId].ephemeral.events.push(e as unknown as IMinimalEvent);
            } else {
                NEXT_SYNC_DATA.rooms!.join[roomId].timeline.events.push(e as unknown as IRoomEvent);
            }
        });
    }

    const setupTestClient = (): [MatrixClient, HttpBackend] => {
        // these tests should work with or without timelineSupport
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
        const httpBackend = testClient.httpBackend;
        const client = testClient.client;

        setNextSyncData();
        httpBackend!.when("GET", "/versions").respond(200, {});
        httpBackend!.when("GET", "/pushrules").respond(200, {});
        httpBackend!.when("POST", "/filter").respond(200, { filter_id: "fid" });
        httpBackend!.when("GET", "/sync").respond(200, SYNC_DATA);
        httpBackend!.when("GET", "/sync").respond(200, function () {
            return NEXT_SYNC_DATA;
        });
        client!.startClient();

        return [client!, httpBackend];
    };

    beforeEach(async function () {
        [client!, httpBackend] = setupTestClient();
        await httpBackend.flush("/versions");
        await httpBackend.flush("/pushrules");
        await httpBackend.flush("/filter");
    });

    afterEach(function () {
        httpBackend!.verifyNoOutstandingExpectation();
        client!.stopClient();
        return httpBackend!.stop();
    });

    describe("local echo events", function () {
        it(
            "should be added immediately after calling MatrixClient.sendEvent " +
                "with EventStatus.SENDING and the right event.sender",
            async () => {
                const wasMessageAddedPromise = new Promise((resolve) => {
                    client!.on(ClientEvent.Sync, async (state) => {
                        if (state !== "PREPARED") {
                            return;
                        }
                        const room = client!.getRoom(roomId)!;
                        expect(room.timeline.length).toEqual(1);

                        client!.sendTextMessage(roomId, "I am a fish", "txn1");
                        // check it was added
                        expect(room.timeline.length).toEqual(2);
                        // check status
                        expect(room.timeline[1].status).toEqual(EventStatus.SENDING);
                        // check member
                        const member = room.timeline[1].sender;
                        expect(member?.userId).toEqual(userId);
                        expect(member?.name).toEqual(userName);

                        await httpBackend!.flush("/sync", 1);
                        resolve(null);
                    });
                });
                await httpBackend!.flush("/sync", 1);
                await wasMessageAddedPromise;
            },
        );

        it(
            "should be updated correctly when the send request finishes " +
                "BEFORE the event comes down the event stream",
            async () => {
                const eventId = "$foo:bar";
                httpBackend!.when("PUT", "/txn1").respond(200, {
                    event_id: eventId,
                });

                const ev = utils.mkMessage({
                    msg: "I am a fish",
                    user: userId,
                    room: roomId,
                });
                ev.event_id = eventId;
                ev.unsigned = { transaction_id: "txn1" };
                setNextSyncData([ev]);

                const wasMessageAddedPromise = new Promise((resolve) => {
                    client!.on(ClientEvent.Sync, function (state) {
                        if (state !== "PREPARED") {
                            return;
                        }
                        const room = client!.getRoom(roomId)!;
                        client!.sendTextMessage(roomId, "I am a fish", "txn1").then(async () => {
                            expect(room.timeline[1].getId()).toEqual(eventId);
                            await httpBackend!.flush("/sync", 1);
                            expect(room.timeline[1].getId()).toEqual(eventId);
                            resolve(null);
                        });
                        httpBackend!.flush("/txn1", 1);
                    });
                });
                await httpBackend!.flush("/sync", 1);
                await wasMessageAddedPromise;
            },
        );

        it(
            "should be updated correctly when the send request finishes " +
                "AFTER the event comes down the event stream",
            async () => {
                const eventId = "$foo:bar";
                httpBackend!.when("PUT", "/txn1").respond(200, {
                    event_id: eventId,
                });

                const ev = utils.mkMessage({
                    msg: "I am a fish",
                    user: userId,
                    room: roomId,
                });
                ev.event_id = eventId;
                ev.unsigned = { transaction_id: "txn1" };
                setNextSyncData([ev]);

                const wasMessageAddedPromise = new Promise((resolve) => {
                    client!.on(ClientEvent.Sync, async (state) => {
                        if (state !== "PREPARED") {
                            return;
                        }
                        const room = client!.getRoom(roomId)!;
                        const messageSendPromise = client!.sendTextMessage(roomId, "I am a fish", "txn1");
                        await httpBackend!.flush("/sync", 1);
                        expect(room.timeline.length).toEqual(2);
                        httpBackend!.flush("/txn1", 1);
                        await messageSendPromise;
                        expect(room.timeline.length).toEqual(2);
                        expect(room.timeline[1].getId()).toEqual(eventId);
                        resolve(null);
                    });
                });
                await httpBackend!.flush("/sync", 1);
                await wasMessageAddedPromise;
            },
        );
    });

    describe("paginated events", function () {
        let sbEvents: Partial<IEvent>[];
        const sbEndTok = "pagin_end";

        beforeEach(function () {
            sbEvents = [];
            httpBackend!.when("GET", "/messages").respond(200, function () {
                return {
                    chunk: sbEvents,
                    start: "pagin_start",
                    end: sbEndTok,
                };
            });
        });

        it("should set Room.oldState.paginationToken to null at the start of the timeline.", async () => {
            const didPaginatePromise = new Promise((resolve) => {
                client!.on(ClientEvent.Sync, async (state) => {
                    if (state !== "PREPARED") {
                        return;
                    }
                    const room = client!.getRoom(roomId)!;
                    expect(room.timeline.length).toEqual(1);

                    await Promise.all([client!.scrollback(room), httpBackend!.flush("/messages", 1)]);
                    expect(room.timeline.length).toEqual(1);
                    expect(room.oldState.paginationToken).toBe(null);

                    // still have a sync to flush
                    await httpBackend!.flush("/sync", 1);
                    resolve(null);
                });
            });
            await httpBackend!.flush("/sync", 1);
            await didPaginatePromise;
        });

        it("should set the right event.sender values", async () => {
            // We're aiming for an eventual timeline of:
            //
            // 'Old Alice' joined the room
            // <Old Alice> I'm old alice
            // @alice:localhost changed their name from 'Old Alice' to 'Alice'
            // <Alice> I'm alice
            // ------^ /messages results above this point, /sync result below
            // <Bob> hello

            // make an m.room.member event for alice's join
            const joinMshipEvent = utils.mkMembership({
                mship: "join",
                user: userId,
                room: roomId,
                name: "Old Alice",
                url: undefined,
            });

            // make an m.room.member event with prev_content for alice's nick
            // change
            const oldMshipEvent = utils.mkMembership({
                mship: "join",
                user: userId,
                room: roomId,
                name: userName,
                url: "mxc://some/url",
            });
            oldMshipEvent.prev_content = {
                displayname: "Old Alice",
                avatar_url: undefined,
                membership: "join",
            };

            // set the list of events to return on scrollback (/messages)
            // N.B. synapse returns /messages in reverse chronological order
            sbEvents = [
                utils.mkMessage({
                    user: userId,
                    room: roomId,
                    msg: "I'm alice",
                }),
                oldMshipEvent,
                utils.mkMessage({
                    user: userId,
                    room: roomId,
                    msg: "I'm old alice",
                }),
                joinMshipEvent,
            ];

            const didPaginatePromise = new Promise((resolve) => {
                client!.on(ClientEvent.Sync, async (state) => {
                    if (state !== "PREPARED") {
                        return;
                    }
                    const room = client!.getRoom(roomId)!;
                    // sync response
                    expect(room.timeline.length).toEqual(1);

                    await Promise.all([client!.scrollback(room), httpBackend!.flush("/messages", 1)]);

                    expect(room.timeline.length).toEqual(5);
                    const joinMsg = room.timeline[0];
                    expect(joinMsg.sender?.name).toEqual("Old Alice");
                    const oldMsg = room.timeline[1];
                    expect(oldMsg.sender?.name).toEqual("Old Alice");
                    const newMsg = room.timeline[3];
                    expect(newMsg.sender?.name).toEqual(userName);

                    // still have a sync to flush
                    await httpBackend!.flush("/sync", 1);
                    resolve(null);
                });
            });
            await httpBackend!.flush("/sync", 1);
            await didPaginatePromise;
        });

        it("should add it them to the right place in the timeline", async () => {
            // set the list of events to return on scrollback
            sbEvents = [
                utils.mkMessage({
                    user: userId,
                    room: roomId,
                    msg: "I am new",
                }),
                utils.mkMessage({
                    user: userId,
                    room: roomId,
                    msg: "I am old",
                }),
            ];

            const didPaginatePromise = new Promise((resolve) => {
                client!.on(ClientEvent.Sync, async (state) => {
                    if (state !== "PREPARED") {
                        return;
                    }
                    const room = client!.getRoom(roomId)!;
                    expect(room.timeline.length).toEqual(1);

                    await Promise.all([client!.scrollback(room), httpBackend!.flush("/messages", 1)]);

                    expect(room.timeline.length).toEqual(3);
                    expect(room.timeline[0].event).toEqual(sbEvents[1]);
                    expect(room.timeline[1].event).toEqual(sbEvents[0]);

                    // still have a sync to flush
                    await httpBackend!.flush("/sync", 1);
                    resolve(null);
                });
            });
            await httpBackend!.flush("/sync", 1);
            await didPaginatePromise;
        });

        it("should use 'end' as the next pagination token", async () => {
            // set the list of events to return on scrollback
            sbEvents = [
                utils.mkMessage({
                    user: userId,
                    room: roomId,
                    msg: "I am new",
                }),
            ];

            const didPaginatePromise = new Promise((resolve) => {
                client!.on(ClientEvent.Sync, async (state) => {
                    if (state !== "PREPARED") {
                        return;
                    }
                    const room = client!.getRoom(roomId)!;
                    expect(room.oldState.paginationToken).toBeTruthy();

                    await Promise.all([client!.scrollback(room, 1), httpBackend!.flush("/messages", 1)]);
                    expect(room.oldState.paginationToken).toEqual(sbEndTok);

                    // still have a sync to flush
                    await httpBackend!.flush("/sync", 1);
                    resolve(null);
                });
            });
            await httpBackend!.flush("/sync", 1);
            await didPaginatePromise;
        });
    });

    describe("new events", function () {
        it("should be added to the right place in the timeline", function () {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            setNextSyncData(eventData);

            return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(() => {
                const room = client!.getRoom(roomId)!;

                let index = 0;
                client!.on(RoomEvent.Timeline, function (event, rm, toStart) {
                    expect(toStart).toBe(false);
                    expect(rm).toEqual(room);
                    expect(event.event).toEqual(eventData[index]);
                    index += 1;
                });

                httpBackend!.flush("/messages", 1);
                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(function () {
                    expect(index).toEqual(2);
                    expect(room.timeline.length).toEqual(3);
                    expect(room.timeline[2].event).toEqual(eventData[1]);
                    expect(room.timeline[1].event).toEqual(eventData[0]);
                });
            });
        });

        it("should set the right event.sender values", function () {
            const eventData = [
                utils.mkMessage({ user: userId, room: roomId }),
                utils.mkMembership({
                    user: userId,
                    room: roomId,
                    mship: "join",
                    name: "New Name",
                }),
                utils.mkMessage({ user: userId, room: roomId }),
            ];
            setNextSyncData(eventData);

            return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(() => {
                const room = client!.getRoom(roomId)!;
                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(function () {
                    const preNameEvent = room.timeline[room.timeline.length - 3];
                    const postNameEvent = room.timeline[room.timeline.length - 1];
                    expect(preNameEvent.sender?.name).toEqual(userName);
                    expect(postNameEvent.sender?.name).toEqual("New Name");
                });
            });
        });

        it("should set the right room.name", function () {
            const secondRoomNameEvent = utils.mkEvent({
                user: userId,
                room: roomId,
                type: "m.room.name",
                content: {
                    name: "Room 2",
                },
            });
            setNextSyncData([secondRoomNameEvent]);

            return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(() => {
                const room = client!.getRoom(roomId)!;
                let nameEmitCount = 0;
                client!.on(RoomEvent.Name, function (rm) {
                    nameEmitCount += 1;
                });

                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)])
                    .then(function () {
                        expect(nameEmitCount).toEqual(1);
                        expect(room.name).toEqual("Room 2");
                        // do another round
                        const thirdRoomNameEvent = utils.mkEvent({
                            user: userId,
                            room: roomId,
                            type: "m.room.name",
                            content: {
                                name: "Room 3",
                            },
                        });
                        setNextSyncData([thirdRoomNameEvent]);
                        httpBackend!.when("GET", "/sync").respond(200, NEXT_SYNC_DATA);
                        return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]);
                    })
                    .then(function () {
                        expect(nameEmitCount).toEqual(2);
                        expect(room.name).toEqual("Room 3");
                    });
            });
        });

        it("should set the right room members", function () {
            const userC = "@cee:bar";
            const userD = "@dee:bar";
            const eventData = [
                utils.mkMembership({
                    user: userC,
                    room: roomId,
                    mship: "join",
                    name: "C",
                }),
                utils.mkMembership({
                    user: userC,
                    room: roomId,
                    mship: "invite",
                    skey: userD,
                }),
            ];
            setNextSyncData(eventData);

            return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(() => {
                const room = client!.getRoom(roomId)!;
                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(function () {
                    expect(room.currentState.getMembers().length).toEqual(4);
                    expect(room.currentState.getMember(userC)!.name).toEqual("C");
                    expect(room.currentState.getMember(userC)!.membership).toEqual("join");
                    expect(room.currentState.getMember(userD)!.name).toEqual(userD);
                    expect(room.currentState.getMember(userD)!.membership).toEqual("invite");
                });
            });
        });
    });

    describe("gappy sync", function () {
        it("should copy the last known state to the new timeline", function () {
            const eventData = [utils.mkMessage({ user: userId, room: roomId })];
            setNextSyncData(eventData);
            NEXT_SYNC_DATA.rooms!.join[roomId].timeline.limited = true;

            return Promise.all([
                httpBackend!.flush("/versions", 1),
                httpBackend!.flush("/sync", 1),
                utils.syncPromise(client!),
            ]).then(() => {
                const room = client!.getRoom(roomId)!;

                httpBackend!.flush("/messages", 1);
                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(function () {
                    expect(room.timeline.length).toEqual(1);
                    expect(room.timeline[0].event).toEqual(eventData[0]);
                    expect(room.currentState.getMembers().length).toEqual(2);
                    expect(room.currentState.getMember(userId)!.name).toEqual(userName);
                    expect(room.currentState.getMember(userId)!.membership).toEqual("join");
                    expect(room.currentState.getMember(otherUserId)!.name).toEqual("Bob");
                    expect(room.currentState.getMember(otherUserId)!.membership).toEqual("join");
                });
            });
        });

        it("should emit a `RoomEvent.TimelineReset` event when the sync response is `limited`", function () {
            const eventData = [utils.mkMessage({ user: userId, room: roomId })];
            setNextSyncData(eventData);
            NEXT_SYNC_DATA.rooms!.join[roomId].timeline.limited = true;

            return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(() => {
                const room = client!.getRoom(roomId)!;

                let emitCount = 0;
                client!.on(RoomEvent.TimelineReset, function (emitRoom) {
                    expect(emitRoom).toEqual(room);
                    emitCount++;
                });

                httpBackend!.flush("/messages", 1);
                return Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!)]).then(function () {
                    expect(emitCount).toEqual(1);
                });
            });
        });
    });

    describe("Refresh live timeline", () => {
        const initialSyncEventData = [
            utils.mkMessage({ user: userId, room: roomId }),
            utils.mkMessage({ user: userId, room: roomId }),
            utils.mkMessage({ user: userId, room: roomId }),
        ];

        const contextUrl =
            `/rooms/${encodeURIComponent(roomId)}/context/` +
            `${encodeURIComponent(initialSyncEventData[2].event_id!)}`;
        const contextResponse = {
            start: "start_token",
            events_before: [initialSyncEventData[1], initialSyncEventData[0]],
            event: initialSyncEventData[2],
            events_after: [],
            state: [USER_MEMBERSHIP_EVENT],
            end: "end_token",
        };

        let room: Room;
        beforeEach(async () => {
            setNextSyncData(initialSyncEventData);

            // Create a room from the sync
            await Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 1)]);

            // Get the room after the first sync so the room is created
            room = client!.getRoom(roomId)!;
            expect(room).toBeTruthy();
        });

        it("should clear and refresh messages in timeline", async () => {
            // `/context` request for `refreshLiveTimeline()` -> `getEventTimeline()`
            // to construct a new timeline from.
            httpBackend!.when("GET", contextUrl).respond(200, function () {
                // The timeline should be cleared at this point in the refresh
                expect(room.timeline.length).toEqual(0);

                return contextResponse;
            });

            // Refresh the timeline.
            await Promise.all([room.refreshLiveTimeline(), httpBackend!.flushAllExpected()]);

            // Make sure the message are visible
            const resultantEventsInTimeline = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents();
            const resultantEventIdsInTimeline = resultantEventsInTimeline.map((event) => event.getId());
            expect(resultantEventIdsInTimeline).toEqual([
                initialSyncEventData[0].event_id,
                initialSyncEventData[1].event_id,
                initialSyncEventData[2].event_id,
            ]);
        });

        it("Perfectly merges timelines if a sync finishes while refreshing the timeline", async () => {
            // `/context` request for `refreshLiveTimeline()` ->
            // `getEventTimeline()` to construct a new timeline from.
            //
            // We only resolve this request after we detect that the timeline
            // was reset(when it goes blank) and force a sync to happen in the
            // middle of all of this refresh timeline logic. We want to make
            // sure the sync pagination still works as expected after messing
            // the refresh timline logic messes with the pagination tokens.
            httpBackend!.when("GET", contextUrl).respond(200, () => {
                // Now finally return and make the `/context` request respond
                return contextResponse;
            });

            // Wait for the timeline to reset(when it goes blank) which means
            // it's in the middle of the refrsh logic right before the
            // `getEventTimeline()` -> `/context`. Then simulate a racey `/sync`
            // to happen in the middle of all of this refresh timeline logic. We
            // want to make sure the sync pagination still works as expected
            // after messing the refresh timline logic messes with the
            // pagination tokens.
            //
            // We define this here so the event listener is in place before we
            // call `room.refreshLiveTimeline()`.
            const racingSyncEventData = [utils.mkMessage({ user: userId, room: roomId })];
            const waitForRaceySyncAfterResetPromise = new Promise<void>((resolve, reject) => {
                let eventFired = false;
                // Throw a more descriptive error if this part of the test times out.
                const failTimeout = setTimeout(() => {
                    if (eventFired) {
                        reject(
                            new Error(
                                "TestError: `RoomEvent.TimelineReset` fired but we timed out trying to make" +
                                    "a `/sync` happen in time.",
                            ),
                        );
                    } else {
                        reject(new Error("TestError: Timed out while waiting for `RoomEvent.TimelineReset` to fire."));
                    }
                }, 4000 /* FIXME: Is there a way to reference the current timeout of this test in Jest? */);

                room.on(RoomEvent.TimelineReset, async () => {
                    try {
                        eventFired = true;

                        // The timeline should be cleared at this point in the refresh
                        expect(room.getUnfilteredTimelineSet().getLiveTimeline().getEvents().length).toEqual(0);

                        // Then make a `/sync` happen by sending a message and seeing that it
                        // shows up (simulate a /sync naturally racing with us).
                        setNextSyncData(racingSyncEventData);
                        httpBackend!.when("GET", "/sync").respond(200, function () {
                            return NEXT_SYNC_DATA;
                        });
                        await Promise.all([httpBackend!.flush("/sync", 1), utils.syncPromise(client!, 1)]);
                        // Make sure the timeline has the racey sync data
                        const afterRaceySyncTimelineEvents = room
                            .getUnfilteredTimelineSet()
                            .getLiveTimeline()
                            .getEvents();
                        const afterRaceySyncTimelineEventIds = afterRaceySyncTimelineEvents.map((event) =>
                            event.getId(),
                        );
                        expect(afterRaceySyncTimelineEventIds).toEqual([racingSyncEventData[0].event_id]);

                        clearTimeout(failTimeout);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            });

            // Refresh the timeline. Just start the function, we will wait for
            // it to finish after the racey sync.
            const refreshLiveTimelinePromise = room.refreshLiveTimeline();

            await waitForRaceySyncAfterResetPromise;

            await Promise.all([
                refreshLiveTimelinePromise,
                // Then flush the remaining `/context` to left the refresh logic complete
                httpBackend!.flushAllExpected(),
            ]);

            // Make sure sync pagination still works by seeing a new message show up
            // after refreshing the timeline.
            const afterRefreshEventData = [utils.mkMessage({ user: userId, room: roomId })];
            setNextSyncData(afterRefreshEventData);
            httpBackend!.when("GET", "/sync").respond(200, function () {
                return NEXT_SYNC_DATA;
            });
            await Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 1)]);

            // Make sure the timeline includes the the events from the `/sync`
            // that raced and beat us in the middle of everything and the
            // `/sync` after the refresh. Since the `/sync` beat us to create
            // the timeline, `initialSyncEventData` won't be visible unless we
            // paginate backwards with `/messages`.
            const resultantEventsInTimeline = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents();
            const resultantEventIdsInTimeline = resultantEventsInTimeline.map((event) => event.getId());
            expect(resultantEventIdsInTimeline).toEqual([
                racingSyncEventData[0].event_id,
                afterRefreshEventData[0].event_id,
            ]);
        });

        it("Timeline recovers after `/context` request to generate new timeline fails", async () => {
            // `/context` request for `refreshLiveTimeline()` -> `getEventTimeline()`
            // to construct a new timeline from.
            httpBackend!
                .when("GET", contextUrl)
                .check(() => {
                    // The timeline should be cleared at this point in the refresh
                    expect(room.timeline.length).toEqual(0);
                })
                .respond(
                    500,
                    new MatrixError({
                        errcode: "TEST_FAKE_ERROR",
                        error:
                            "We purposely intercepted this /context request to make it fail " +
                            "in order to test whether the refresh timeline code is resilient",
                    }),
                );

            // Refresh the timeline and expect it to fail
            const settledFailedRefreshPromises = await Promise.allSettled([
                room.refreshLiveTimeline(),
                httpBackend!.flushAllExpected(),
            ]);
            // We only expect `TEST_FAKE_ERROR` here. Anything else is
            // unexpected and should fail the test.
            if (settledFailedRefreshPromises[0].status === "fulfilled") {
                throw new Error("Expected the /context request to fail with a 500");
            } else if (settledFailedRefreshPromises[0].reason.errcode !== "TEST_FAKE_ERROR") {
                throw settledFailedRefreshPromises[0].reason;
            }

            // The timeline will be empty after we refresh the timeline and fail
            // to construct a new timeline.
            expect(room.timeline.length).toEqual(0);

            // `/messages` request for `refreshLiveTimeline()` ->
            // `getLatestTimeline()` to construct a new timeline from.
            httpBackend!.when("GET", `/rooms/${encodeURIComponent(roomId)}/messages`).respond(200, function () {
                return {
                    chunk: [
                        {
                            // The latest message in the room
                            event_id: initialSyncEventData[2].event_id,
                        },
                    ],
                };
            });
            // `/context` request for `refreshLiveTimeline()` ->
            // `getLatestTimeline()` -> `getEventTimeline()` to construct a new
            // timeline from.
            httpBackend!.when("GET", contextUrl).respond(200, function () {
                // The timeline should be cleared at this point in the refresh
                expect(room.timeline.length).toEqual(0);

                return contextResponse;
            });

            // Refresh the timeline again but this time it should pass
            await Promise.all([room.refreshLiveTimeline(), httpBackend!.flushAllExpected()]);

            // Make sure sync pagination still works by seeing a new message show up
            // after refreshing the timeline.
            const afterRefreshEventData = [utils.mkMessage({ user: userId, room: roomId })];
            setNextSyncData(afterRefreshEventData);
            httpBackend!.when("GET", "/sync").respond(200, function () {
                return NEXT_SYNC_DATA;
            });
            await Promise.all([httpBackend!.flushAllExpected(), utils.syncPromise(client!, 1)]);

            // Make sure the message are visible
            const resultantEventsInTimeline = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents();
            const resultantEventIdsInTimeline = resultantEventsInTimeline.map((event) => event.getId());
            expect(resultantEventIdsInTimeline).toEqual([
                initialSyncEventData[0].event_id,
                initialSyncEventData[1].event_id,
                initialSyncEventData[2].event_id,
                afterRefreshEventData[0].event_id,
            ]);
        });
    });
});
