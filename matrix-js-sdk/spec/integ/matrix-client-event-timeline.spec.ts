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

import * as utils from "../test-utils/test-utils";
import {
    ClientEvent,
    Direction,
    EventStatus,
    EventTimeline,
    EventTimelineSet,
    EventType,
    Filter,
    IEvent,
    MatrixClient,
    MatrixEvent,
    PendingEventOrdering,
    RelationType,
    Room,
} from "../../src/matrix";
import { logger } from "../../src/logger";
import { encodeParams, encodeUri, QueryDict, replaceParam } from "../../src/utils";
import { TestClient } from "../TestClient";
import { FeatureSupport, Thread, THREAD_RELATION_TYPE, ThreadEvent } from "../../src/models/thread";
import { emitPromise } from "../test-utils/test-utils";
import { Feature, ServerSupport } from "../../src/feature";

const userId = "@alice:localhost";
const userName = "Alice";
const accessToken = "aseukfgwef";
const roomId = "!foo:bar";
const otherUserId = "@bob:localhost";

const withoutRoomId = (e: Partial<IEvent>): Partial<IEvent> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { room_id: _, ...copy } = e;
    return copy;
};

/**
 * Our httpBackend only allows matching calls if we have the exact same query, in the exact same order
 * This method allows building queries with the exact same parameter order as the fetchRelations method in client
 * @param params query parameters
 */
const buildRelationPaginationQuery = (params: QueryDict): string => {
    if (Thread.hasServerSideFwdPaginationSupport === FeatureSupport.Experimental) {
        params = replaceParam("dir", "org.matrix.msc3715.dir", params);
    }
    return "?" + encodeParams(params).toString();
};

const USER_MEMBERSHIP_EVENT = utils.mkMembership({
    room: roomId,
    mship: "join",
    user: userId,
    name: userName,
    event: false,
});

const ROOM_NAME_EVENT = utils.mkEvent({
    type: "m.room.name",
    room: roomId,
    user: otherUserId,
    content: {
        name: "Old room name",
    },
    event: false,
});

const INITIAL_SYNC_DATA = {
    next_batch: "s_5_3",
    rooms: {
        join: {
            [roomId]: {
                timeline: {
                    events: [
                        utils.mkMessage({
                            user: otherUserId,
                            msg: "hello",
                            event: false,
                        }),
                    ],
                    prev_batch: "f_1_1",
                },
                state: {
                    events: [
                        withoutRoomId(ROOM_NAME_EVENT),
                        utils.mkMembership({
                            mship: "join",
                            user: otherUserId,
                            name: "Bob",
                            event: false,
                        }),
                        withoutRoomId(USER_MEMBERSHIP_EVENT),
                        utils.mkEvent({
                            type: "m.room.create",
                            user: userId,
                            content: {
                                creator: userId,
                            },
                            event: false,
                        }),
                    ],
                },
            },
        },
    },
};

const EVENTS = [
    utils.mkMessage({
        room: roomId,
        user: userId,
        msg: "we",
        event: false,
    }),
    utils.mkMessage({
        room: roomId,
        user: userId,
        msg: "could",
        event: false,
    }),
    utils.mkMessage({
        room: roomId,
        user: userId,
        msg: "be",
        event: false,
    }),
    utils.mkMessage({
        room: roomId,
        user: userId,
        msg: "heroes",
        event: false,
    }),
];

const THREAD_ROOT = utils.mkEvent({
    room: roomId,
    user: userId,
    type: "m.room.message",
    content: {
        body: "thread root",
        msgtype: "m.text",
    },
    unsigned: {
        "m.relations": {
            "io.element.thread": {
                //"latest_event": undefined,
                count: 1,
                current_user_participated: true,
            },
        },
    },
    event: false,
});

const THREAD_REPLY = utils.mkEvent({
    room: roomId,
    user: userId,
    type: "m.room.message",
    content: {
        "body": "thread reply",
        "msgtype": "m.text",
        "m.relates_to": {
            // We can't use the const here because we change server support mode for test
            rel_type: "io.element.thread",
            event_id: THREAD_ROOT.event_id,
        },
    },
    event: false,
});

// @ts-ignore we know this is a defined path for THREAD ROOT
THREAD_ROOT.unsigned["m.relations"]["io.element.thread"].latest_event = THREAD_REPLY;

const SYNC_THREAD_ROOT = withoutRoomId(THREAD_ROOT);
const SYNC_THREAD_REPLY = withoutRoomId(THREAD_REPLY);
SYNC_THREAD_ROOT.unsigned = {
    "m.relations": {
        "io.element.thread": {
            latest_event: SYNC_THREAD_REPLY,
            count: 1,
            current_user_participated: true,
        },
    },
};

type HttpBackend = TestClient["httpBackend"];
type ExpectedHttpRequest = ReturnType<HttpBackend["when"]>;

// start the client, and wait for it to initialise
function startClient(httpBackend: HttpBackend, client: MatrixClient) {
    httpBackend.when("GET", "/versions").respond(200, {});
    httpBackend.when("GET", "/pushrules").respond(200, {});
    httpBackend.when("POST", "/filter").respond(200, { filter_id: "fid" });
    httpBackend.when("GET", "/sync").respond(200, INITIAL_SYNC_DATA);

    client.startClient();

    // set up a promise which will resolve once the client is initialised
    const prom = new Promise<void>((resolve) => {
        client.on(ClientEvent.Sync, function (state) {
            logger.log("sync", state);
            if (state != "SYNCING") {
                return;
            }
            resolve();
        });
    });

    return Promise.all([httpBackend.flushAllExpected(), prom]);
}

describe("getEventTimeline support", function () {
    let httpBackend: HttpBackend;
    let client: MatrixClient;

    beforeEach(function () {
        const testClient = new TestClient(userId, "DEVICE", accessToken);
        client = testClient.client;
        httpBackend = testClient.httpBackend;
    });

    afterEach(function () {
        if (client) {
            client.stopClient();
        }
        return httpBackend.stop();
    });

    it("timeline support must be enabled to work", function () {
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: false });
        client = testClient.client;
        httpBackend = testClient.httpBackend;

        return startClient(httpBackend, client).then(function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room!.getTimelineSets()[0];
            expect(client.getEventTimeline(timelineSet, "event")).rejects.toBeTruthy();
        });
    });

    it("timeline support works when enabled", function () {
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
        client = testClient.client;
        httpBackend = testClient.httpBackend;

        return startClient(httpBackend, client).then(() => {
            const room = client.getRoom(roomId)!;
            const timelineSet = room!.getTimelineSets()[0];
            expect(client.getEventTimeline(timelineSet, "event")).rejects.toBeFalsy();
        });
    });

    it("only works with room timelines", function () {
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
        client = testClient.client;
        httpBackend = testClient.httpBackend;

        return startClient(httpBackend, client).then(function () {
            const timelineSet = new EventTimelineSet(undefined);
            expect(client.getEventTimeline(timelineSet, "event")).rejects.toBeTruthy();
        });
    });

    it("scrollback should be able to scroll back to before a gappy /sync", function () {
        // need a client with timelineSupport disabled to make this work
        let room: Room | undefined;

        return startClient(httpBackend, client)
            .then(function () {
                room = client.getRoom(roomId)!;

                httpBackend.when("GET", "/sync").respond(200, {
                    next_batch: "s_5_4",
                    rooms: {
                        join: {
                            "!foo:bar": {
                                timeline: {
                                    events: [withoutRoomId(EVENTS[0])],
                                    prev_batch: "f_1_1",
                                },
                            },
                        },
                    },
                });

                httpBackend.when("GET", "/sync").respond(200, {
                    next_batch: "s_5_5",
                    rooms: {
                        join: {
                            "!foo:bar": {
                                timeline: {
                                    events: [withoutRoomId(EVENTS[1])],
                                    limited: true,
                                    prev_batch: "f_1_2",
                                },
                            },
                        },
                    },
                });

                return Promise.all([httpBackend.flushAllExpected(), utils.syncPromise(client, 2)]);
            })
            .then(function () {
                expect(room!.timeline.length).toEqual(1);
                expect(room!.timeline[0].event).toEqual(EVENTS[1]);

                httpBackend.when("GET", "/messages").respond(200, {
                    chunk: [EVENTS[0]],
                    start: "pagin_start",
                    end: "pagin_end",
                });
                httpBackend.flush("/messages", 1);
                return client.scrollback(room!);
            })
            .then(function () {
                expect(room!.timeline.length).toEqual(2);
                expect(room!.timeline[0].event).toEqual(EVENTS[0]);
                expect(room!.timeline[1].event).toEqual(EVENTS[1]);
                expect(room!.oldState.paginationToken).toEqual("pagin_end");
            });
    });
});

describe("MatrixClient event timelines", function () {
    let client: MatrixClient;
    let httpBackend: HttpBackend;

    beforeEach(function () {
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
        client = testClient.client;
        httpBackend = testClient.httpBackend;

        return startClient(httpBackend, client);
    });

    afterEach(function () {
        httpBackend.verifyNoOutstandingExpectation();
        client.stopClient();
        Thread.setServerSideSupport(FeatureSupport.None);
        Thread.setServerSideListSupport(FeatureSupport.None);
        Thread.setServerSideFwdPaginationSupport(FeatureSupport.None);
    });

    async function flushHttp<T>(promise: Promise<T>): Promise<T> {
        return Promise.all([promise, httpBackend.flushAllExpected()]).then(([result]) => result);
    }

    describe("getEventTimeline", function () {
        it("should create a new timeline for new events", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];
            httpBackend.when("GET", "/rooms/!foo%3Abar/context/event1%3Abar").respond(200, function () {
                return {
                    start: "start_token",
                    events_before: [EVENTS[1], EVENTS[0]],
                    event: EVENTS[2],
                    events_after: [EVENTS[3]],
                    state: [ROOM_NAME_EVENT, USER_MEMBERSHIP_EVENT],
                    end: "end_token",
                };
            });

            return Promise.all([
                client.getEventTimeline(timelineSet, "event1:bar").then(function (tl) {
                    expect(tl!.getEvents().length).toEqual(4);
                    for (let i = 0; i < 4; i++) {
                        expect(tl!.getEvents()[i].event).toEqual(EVENTS[i]);
                        expect(tl!.getEvents()[i]?.sender?.name).toEqual(userName);
                    }
                    expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token");
                    expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token");
                }),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should return existing timeline for known events", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];
            httpBackend.when("GET", "/sync").respond(200, {
                next_batch: "s_5_4",
                rooms: {
                    join: {
                        "!foo:bar": {
                            timeline: {
                                events: [withoutRoomId(EVENTS[0])],
                                prev_batch: "f_1_2",
                            },
                        },
                    },
                },
            });

            return Promise.all([httpBackend.flush("/sync"), utils.syncPromise(client)])
                .then(function () {
                    return client.getEventTimeline(timelineSet, EVENTS[0].event_id!);
                })
                .then(function (tl) {
                    expect(tl!.getEvents().length).toEqual(2);
                    expect(tl!.getEvents()[1].event).toEqual(EVENTS[0]);
                    expect(tl!.getEvents()[1]?.sender?.name).toEqual(userName);
                    expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("f_1_1");
                    // expect(tl.getPaginationToken(EventTimeline.FORWARDS))
                    //    .toEqual("s_5_4");
                });
        });

        it("should update timelines where they overlap a previous /sync", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];
            httpBackend.when("GET", "/sync").respond(200, {
                next_batch: "s_5_4",
                rooms: {
                    join: {
                        "!foo:bar": {
                            timeline: {
                                events: [withoutRoomId(EVENTS[3])],
                                prev_batch: "f_1_2",
                            },
                        },
                    },
                },
            });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[2].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token",
                        events_before: [EVENTS[1]],
                        event: EVENTS[2],
                        events_after: [EVENTS[3]],
                        end: "end_token",
                        state: [],
                    };
                });

            const prom = new Promise((resolve, reject) => {
                client.on(ClientEvent.Sync, function () {
                    client
                        .getEventTimeline(timelineSet, EVENTS[2].event_id!)
                        .then(function (tl) {
                            expect(tl!.getEvents().length).toEqual(4);
                            expect(tl!.getEvents()[0].event).toEqual(EVENTS[1]);
                            expect(tl!.getEvents()[1].event).toEqual(EVENTS[2]);
                            expect(tl!.getEvents()[3].event).toEqual(EVENTS[3]);
                            expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token");
                            // expect(tl.getPaginationToken(EventTimeline.FORWARDS))
                            //    .toEqual("s_5_4");
                        })
                        .then(resolve, reject);
                });
            });

            return Promise.all([httpBackend.flushAllExpected(), prom]);
        });

        it("should join timelines where they overlap a previous /context", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            // we fetch event 0, then 2, then 3, and finally 1. 1 is returned
            // with context which joins them all up.
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: EVENTS[0],
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[2].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token2",
                        events_before: [],
                        event: EVENTS[2],
                        events_after: [],
                        end: "end_token2",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[3].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token3",
                        events_before: [],
                        event: EVENTS[3],
                        events_after: [],
                        end: "end_token3",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[1].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token4",
                        events_before: [EVENTS[0]],
                        event: EVENTS[1],
                        events_after: [EVENTS[2], EVENTS[3]],
                        end: "end_token4",
                        state: [],
                    };
                });

            let tl0: EventTimeline;
            let tl3: EventTimeline;
            return Promise.all([
                client
                    .getEventTimeline(timelineSet, EVENTS[0].event_id!)
                    .then(function (tl) {
                        expect(tl!.getEvents().length).toEqual(1);
                        tl0 = tl!;
                        return client.getEventTimeline(timelineSet, EVENTS[2].event_id!);
                    })
                    .then(function (tl) {
                        expect(tl!.getEvents().length).toEqual(1);
                        return client.getEventTimeline(timelineSet, EVENTS[3].event_id!);
                    })
                    .then(function (tl) {
                        expect(tl!.getEvents().length).toEqual(1);
                        tl3 = tl!;
                        return client.getEventTimeline(timelineSet, EVENTS[1].event_id!);
                    })
                    .then(function (tl) {
                        // we expect it to get merged in with event 2
                        expect(tl!.getEvents().length).toEqual(2);
                        expect(tl!.getEvents()[0].event).toEqual(EVENTS[1]);
                        expect(tl!.getEvents()[1].event).toEqual(EVENTS[2]);
                        expect(tl!.getNeighbouringTimeline(EventTimeline.BACKWARDS)).toBe(tl0);
                        expect(tl!.getNeighbouringTimeline(EventTimeline.FORWARDS)).toBe(tl3);
                        expect(tl0.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token0");
                        expect(tl0.getPaginationToken(EventTimeline.FORWARDS)).toBe(null);
                        expect(tl3.getPaginationToken(EventTimeline.BACKWARDS)).toBe(null);
                        expect(tl3.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token3");
                    }),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should fail gracefully if there is no event field", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];
            // we fetch event 0, then 2, then 3, and finally 1. 1 is returned
            // with context which joins them all up.
            httpBackend.when("GET", "/rooms/!foo%3Abar/context/event1").respond(200, function () {
                return {
                    start: "start_token",
                    events_before: [],
                    events_after: [],
                    end: "end_token",
                    state: [],
                };
            });

            return Promise.all([
                client.getEventTimeline(timelineSet, "event1").then(
                    function (tl) {
                        // could do with a fail()
                        expect(true).toBeFalsy();
                    },
                    function (e) {
                        expect(String(e)).toMatch(/'event'/);
                    },
                ),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should handle thread replies with server support by fetching a contiguous thread timeline", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            await client.stopClient(); // we don't need the client to be syncing at this time
            const room = client.getRoom(roomId)!;

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });

            httpBackend
                .when(
                    "GET",
                    "/rooms/!foo%3Abar/relations/" +
                        encodeURIComponent(THREAD_ROOT.event_id!) +
                        "/" +
                        encodeURIComponent(THREAD_RELATION_TYPE.name) +
                        buildRelationPaginationQuery({ dir: Direction.Backward, limit: 1 }),
                )
                .respond(200, function () {
                    return {
                        chunk: [THREAD_REPLY],
                        // no next batch as this is the oldest end of the timeline
                    };
                });

            const thread = room.createThread(THREAD_ROOT.event_id!, undefined, [], false);
            await httpBackend.flushAllExpected();
            const timelineSet = thread.timelineSet;
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            await flushHttp(emitPromise(thread, ThreadEvent.Update));

            const timeline = await client.getEventTimeline(timelineSet, THREAD_REPLY.event_id!);

            const eventIds = timeline!.getEvents().map((it) => it.getId());
            expect(eventIds).toContain(THREAD_ROOT.event_id);
            expect(eventIds).toContain(THREAD_REPLY.event_id);
        });

        it("should return relevant timeline from non-thread timelineSet when asking for the thread root", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            client.stopClient(); // we don't need the client to be syncing at this time
            const room = client.getRoom(roomId)!;
            const threadRoot = new MatrixEvent(THREAD_ROOT);
            const thread = room.createThread(THREAD_ROOT.event_id!, threadRoot, [threadRoot], false)!;
            const timelineSet = room.getTimelineSets()[0]!;

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: THREAD_ROOT,
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            const [timeline] = await Promise.all([
                client.getEventTimeline(timelineSet, THREAD_ROOT.event_id!),
                httpBackend.flushAllExpected(),
            ]);

            expect(timeline!).not.toBe(thread.liveTimeline);
            expect(timelineSet.getTimelines()).toContain(timeline);
            expect(timeline!.getEvents().find((e) => e.getId() === THREAD_ROOT.event_id!)).toBeTruthy();
        });

        it("should return undefined when event is not in the thread that the given timelineSet is representing", () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            client.stopClient(); // we don't need the client to be syncing at this time
            const room = client.getRoom(roomId)!;
            const threadRoot = new MatrixEvent(THREAD_ROOT);
            const thread = room.createThread(THREAD_ROOT.event_id!, threadRoot, [threadRoot], false);
            const timelineSet = thread.timelineSet;

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: EVENTS[0],
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            return Promise.all([
                expect(client.getEventTimeline(timelineSet, EVENTS[0].event_id!)).resolves.toBeUndefined(),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should return undefined when event is within a thread but timelineSet is not", () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            client.stopClient(); // we don't need the client to be syncing at this time
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(THREAD_REPLY.event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: THREAD_REPLY,
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            return Promise.all([
                expect(client.getEventTimeline(timelineSet, THREAD_REPLY.event_id!)).resolves.toBeUndefined(),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should should add lazy loading filter when requested", async () => {
            // @ts-ignore
            client.clientOpts.lazyLoadMembers = true;
            client.stopClient(); // we don't need the client to be syncing at this time
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            const req = httpBackend.when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!));
            req.respond(200, function () {
                return {
                    start: "start_token0",
                    events_before: [],
                    event: EVENTS[0],
                    events_after: [],
                    end: "end_token0",
                    state: [],
                };
            });
            req.check((request) => {
                expect(request.queryParams?.filter).toEqual(JSON.stringify(Filter.LAZY_LOADING_MESSAGES_FILTER));
            });

            await Promise.all([
                client.getEventTimeline(timelineSet, EVENTS[0].event_id!),
                httpBackend.flushAllExpected(),
            ]);
        });
    });

    describe("getLatestTimeline", function () {
        it("timeline support must be enabled to work", async function () {
            await client.stopClient();

            const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: false });
            client = testClient.client;
            httpBackend = testClient.httpBackend;
            await startClient(httpBackend, client);

            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0]!;
            await expect(client.getLatestTimeline(timelineSet)).rejects.toBeTruthy();
        });

        it("timeline support works when enabled", async function () {
            await client.stopClient();

            const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
            client = testClient.client;
            httpBackend = testClient.httpBackend;

            return startClient(httpBackend, client).then(() => {
                const room = client.getRoom(roomId)!;
                const timelineSet = room.getTimelineSets()[0];
                expect(client.getLatestTimeline(timelineSet)).rejects.toBeFalsy();
            });
        });

        it("only works with room timelines", async function () {
            await client.stopClient();

            const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { timelineSupport: true });
            client = testClient.client;
            httpBackend = testClient.httpBackend;
            await startClient(httpBackend, client);

            const timelineSet = new EventTimelineSet(undefined);
            await expect(client.getLatestTimeline(timelineSet)).rejects.toBeTruthy();
        });

        it("should create a new timeline for new events", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            const latestMessageId = "event1:bar";

            httpBackend.when("GET", "/rooms/!foo%3Abar/messages").respond(200, function () {
                return {
                    chunk: [
                        {
                            event_id: latestMessageId,
                        },
                    ],
                };
            });

            httpBackend
                .when("GET", `/rooms/!foo%3Abar/context/${encodeURIComponent(latestMessageId)}`)
                .respond(200, function () {
                    return {
                        start: "start_token",
                        events_before: [EVENTS[1], EVENTS[0]],
                        event: EVENTS[2],
                        events_after: [EVENTS[3]],
                        state: [ROOM_NAME_EVENT, USER_MEMBERSHIP_EVENT],
                        end: "end_token",
                    };
                });

            return Promise.all([
                client.getLatestTimeline(timelineSet).then(function (tl) {
                    // Instead of this assertion logic, we could just add a spy
                    // for `getEventTimeline` and make sure it's called with the
                    // correct parameters. This doesn't feel too bad to make sure
                    // `getLatestTimeline` is doing the right thing though.
                    expect(tl!.getEvents().length).toEqual(4);
                    for (let i = 0; i < 4; i++) {
                        expect(tl!.getEvents()[i].event).toEqual(EVENTS[i]);
                        expect(tl!.getEvents()[i]?.sender?.name).toEqual(userName);
                    }
                    expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token");
                    expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token");
                }),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should throw error when /messages does not return a message", () => {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend.when("GET", "/rooms/!foo%3Abar/messages").respond(200, () => {
                return {
                    chunk: [
                        // No messages to return
                    ],
                };
            });

            return Promise.all([
                expect(client.getLatestTimeline(timelineSet)).rejects.toThrow(),
                httpBackend.flushAllExpected(),
            ]);
        });
    });

    describe("paginateEventTimeline", function () {
        it("should allow you to paginate backwards", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: EVENTS[0],
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/messages")
                .check(function (req) {
                    const params = req.queryParams!;
                    expect(params.dir).toEqual("b");
                    expect(params.from).toEqual("start_token0");
                    expect(params.limit).toEqual("30");
                })
                .respond(200, function () {
                    return {
                        chunk: [EVENTS[1], EVENTS[2]],
                        end: "start_token1",
                    };
                });

            let tl: EventTimeline;
            return Promise.all([
                client
                    .getEventTimeline(timelineSet, EVENTS[0].event_id!)
                    .then(function (tl0) {
                        tl = tl0!;
                        return client.paginateEventTimeline(tl, { backwards: true });
                    })
                    .then(function (success) {
                        expect(success).toBeTruthy();
                        expect(tl!.getEvents().length).toEqual(3);
                        expect(tl!.getEvents()[0].event).toEqual(EVENTS[2]);
                        expect(tl!.getEvents()[1].event).toEqual(EVENTS[1]);
                        expect(tl!.getEvents()[2].event).toEqual(EVENTS[0]);
                        expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token1");
                        expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token0");
                    }),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should stop paginating when it encounters no `end` token", () => {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, () => ({
                    start: "start_token0",
                    events_before: [],
                    event: EVENTS[0],
                    events_after: [],
                    end: "end_token0",
                    state: [],
                }));

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/messages")
                .check(function (req) {
                    const params = req.queryParams!;
                    expect(params.dir).toEqual("b");
                    expect(params.from).toEqual("start_token0");
                    expect(params.limit).toEqual("30");
                })
                .respond(200, () => ({
                    start: "start_token0",
                    chunk: [],
                }));

            return Promise.all([
                (async () => {
                    const tl = await client.getEventTimeline(timelineSet, EVENTS[0].event_id!);
                    const success = await client.paginateEventTimeline(tl!, { backwards: true });
                    expect(success).toBeFalsy();
                    expect(tl!.getEvents().length).toEqual(1);
                    expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual(null);
                    expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token0");
                })(),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should allow you to paginate forwards", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: EVENTS[0],
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/messages")
                .check(function (req) {
                    const params = req.queryParams!;
                    expect(params.dir).toEqual("f");
                    expect(params.from).toEqual("end_token0");
                    expect(params.limit).toEqual("20");
                })
                .respond(200, function () {
                    return {
                        chunk: [EVENTS[1], EVENTS[2]],
                        end: "end_token1",
                    };
                });

            let tl: EventTimeline;
            return Promise.all([
                client
                    .getEventTimeline(timelineSet, EVENTS[0].event_id!)
                    .then(function (tl0) {
                        tl = tl0!;
                        return client.paginateEventTimeline(tl, { backwards: false, limit: 20 });
                    })
                    .then(function (success) {
                        expect(success).toBeTruthy();
                        expect(tl!.getEvents().length).toEqual(3);
                        expect(tl!.getEvents()[0].event).toEqual(EVENTS[0]);
                        expect(tl!.getEvents()[1].event).toEqual(EVENTS[1]);
                        expect(tl!.getEvents()[2].event).toEqual(EVENTS[2]);
                        expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token0");
                        expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token1");
                    }),
                httpBackend.flushAllExpected(),
            ]);
        });

        it("should create threads for thread roots discovered", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(EVENTS[0].event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token0",
                        events_before: [],
                        event: EVENTS[0],
                        events_after: [],
                        end: "end_token0",
                        state: [],
                    };
                });

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/messages")
                .check(function (req) {
                    const params = req.queryParams!;
                    expect(params.dir).toEqual("b");
                    expect(params.from).toEqual("start_token0");
                    expect(params.limit).toEqual("30");
                })
                .respond(200, function () {
                    return {
                        chunk: [EVENTS[1], EVENTS[2], THREAD_ROOT],
                        end: "start_token1",
                    };
                });

            let tl: EventTimeline;
            return Promise.all([
                client
                    .getEventTimeline(timelineSet, EVENTS[0].event_id!)
                    .then(function (tl0) {
                        tl = tl0!;
                        return client.paginateEventTimeline(tl, { backwards: true });
                    })
                    .then(function (success) {
                        expect(success).toBeTruthy();
                        expect(tl!.getEvents().length).toEqual(4);
                        expect(tl!.getEvents()[0].event).toEqual(THREAD_ROOT);
                        expect(tl!.getEvents()[1].event).toEqual(EVENTS[2]);
                        expect(tl!.getEvents()[2].event).toEqual(EVENTS[1]);
                        expect(tl!.getEvents()[3].event).toEqual(EVENTS[0]);
                        expect(room.getThreads().map((it) => it.id)).toEqual([THREAD_ROOT.event_id!]);
                        expect(tl!.getPaginationToken(EventTimeline.BACKWARDS)).toEqual("start_token1");
                        expect(tl!.getPaginationToken(EventTimeline.FORWARDS)).toEqual("end_token0");
                    }),
                httpBackend.flushAllExpected(),
            ]);
        });
    });

    it("should ensure thread events are ordered correctly", async () => {
        // Test data for a second reply to the first thread
        const THREAD_REPLY2 = utils.mkEvent({
            room: roomId,
            user: userId,
            type: "m.room.message",
            content: {
                "body": "thread reply 2",
                "msgtype": "m.text",
                "m.relates_to": {
                    // We can't use the const here because we change server support mode for test
                    rel_type: "io.element.thread",
                    event_id: THREAD_ROOT.event_id,
                },
            },
            event: true,
        });
        THREAD_REPLY2.localTimestamp += 1000;

        // Test data for a second reply to the first thread
        const THREAD_REPLY3 = utils.mkEvent({
            room: roomId,
            user: userId,
            type: "m.room.message",
            content: {
                "body": "thread reply 3",
                "msgtype": "m.text",
                "m.relates_to": {
                    // We can't use the const here because we change server support mode for test
                    rel_type: "io.element.thread",
                    event_id: THREAD_ROOT.event_id,
                },
            },
            event: true,
        });
        THREAD_REPLY3.localTimestamp += 2000;

        // Test data for the first thread, with the second reply
        const THREAD_ROOT_UPDATED = {
            ...THREAD_ROOT,
            unsigned: {
                ...THREAD_ROOT.unsigned,
                "m.relations": {
                    ...THREAD_ROOT.unsigned!["m.relations"],
                    "io.element.thread": {
                        ...THREAD_ROOT.unsigned!["m.relations"]!["io.element.thread"],
                        count: 3,
                        latest_event: THREAD_REPLY3.event,
                    },
                },
            },
        };

        // @ts-ignore
        client.clientOpts.threadSupport = true;
        Thread.setServerSideSupport(FeatureSupport.Stable);
        Thread.setServerSideListSupport(FeatureSupport.Stable);
        Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);

        client.fetchRoomEvent = () => Promise.resolve(THREAD_ROOT_UPDATED);

        await client.stopClient(); // we don't need the client to be syncing at this time
        const room = client.getRoom(roomId)!;

        const prom = emitPromise(room, ThreadEvent.Update);
        // Assume we're seeing the reply while loading backlog
        await room.addLiveEvents([THREAD_REPLY2]);
        httpBackend
            .when(
                "GET",
                "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                    encodeURIComponent(THREAD_ROOT_UPDATED.event_id!) +
                    "/" +
                    encodeURIComponent(THREAD_RELATION_TYPE.name),
            )
            .respond(200, {
                chunk: [THREAD_REPLY3.event, THREAD_REPLY2.event, THREAD_REPLY],
            });
        await flushHttp(prom);
        // but while loading the metadata, a new reply has arrived
        await room.addLiveEvents([THREAD_REPLY3]);
        const thread = room.getThread(THREAD_ROOT_UPDATED.event_id!)!;
        // then the events should still be all in the right order
        expect(thread.events.map((it) => it.getId())).toEqual([
            THREAD_ROOT.event_id,
            THREAD_REPLY.event_id,
            THREAD_REPLY2.getId(),
            THREAD_REPLY3.getId(),
        ]);
    });

    it("should ensure thread events don't get reordered with recursive relations", async () => {
        // Test data for a second reply to the first thread
        const THREAD_REPLY2 = utils.mkEvent({
            room: roomId,
            user: userId,
            type: "m.room.message",
            content: {
                "body": "thread reply 2",
                "msgtype": "m.text",
                "m.relates_to": {
                    // We can't use the const here because we change server support mode for test
                    rel_type: "io.element.thread",
                    event_id: THREAD_ROOT.event_id,
                },
            },
            event: true,
        });
        THREAD_REPLY2.localTimestamp += 1000;
        const THREAD_ROOT_REACTION = utils.mkEvent({
            event: true,
            type: EventType.Reaction,
            user: userId,
            room: roomId,
            content: {
                "m.relates_to": {
                    rel_type: RelationType.Annotation,
                    event_id: THREAD_ROOT.event_id!,
                    key: Math.random().toString(),
                },
            },
        });
        THREAD_ROOT_REACTION.localTimestamp += 2000;

        // Test data for a second reply to the first thread
        const THREAD_REPLY3 = utils.mkEvent({
            room: roomId,
            user: userId,
            type: "m.room.message",
            content: {
                "body": "thread reply 3",
                "msgtype": "m.text",
                "m.relates_to": {
                    // We can't use the const here because we change server support mode for test
                    rel_type: "io.element.thread",
                    event_id: THREAD_ROOT.event_id,
                },
            },
            event: true,
        });
        THREAD_REPLY3.localTimestamp += 3000;

        // Test data for the first thread, with the second reply
        const THREAD_ROOT_UPDATED = {
            ...THREAD_ROOT,
            unsigned: {
                ...THREAD_ROOT.unsigned,
                "m.relations": {
                    ...THREAD_ROOT.unsigned!["m.relations"],
                    "io.element.thread": {
                        ...THREAD_ROOT.unsigned!["m.relations"]!["io.element.thread"],
                        count: 3,
                        latest_event: THREAD_REPLY3.event,
                    },
                },
            },
        };

        // @ts-ignore
        client.clientOpts.threadSupport = true;
        client.canSupport.set(Feature.RelationsRecursion, ServerSupport.Stable);
        Thread.setServerSideSupport(FeatureSupport.Stable);
        Thread.setServerSideListSupport(FeatureSupport.Stable);
        Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);

        client.fetchRoomEvent = () => Promise.resolve(THREAD_ROOT_UPDATED);

        await client.stopClient(); // we don't need the client to be syncing at this time
        const room = client.getRoom(roomId)!;

        const prom = emitPromise(room, ThreadEvent.Update);
        // Assume we're seeing the reply while loading backlog
        await room.addLiveEvents([THREAD_REPLY2]);
        httpBackend
            .when(
                "GET",
                "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                    encodeURIComponent(THREAD_ROOT_UPDATED.event_id!) +
                    "/" +
                    encodeURIComponent(THREAD_RELATION_TYPE.name) +
                    buildRelationPaginationQuery({
                        dir: Direction.Backward,
                        limit: 3,
                        recurse: true,
                    }),
            )
            .respond(200, {
                chunk: [THREAD_REPLY3.event, THREAD_ROOT_REACTION, THREAD_REPLY2.event, THREAD_REPLY],
            });
        await flushHttp(prom);
        // but while loading the metadata, a new reply has arrived
        await room.addLiveEvents([THREAD_REPLY3]);
        const thread = room.getThread(THREAD_ROOT_UPDATED.event_id!)!;
        // then the events should still be all in the right order
        expect(thread.events.map((it) => it.getId())).toEqual([
            THREAD_ROOT.event_id,
            THREAD_REPLY.event_id,
            THREAD_REPLY2.getId(),
            THREAD_ROOT_REACTION.getId(),
            THREAD_REPLY3.getId(),
        ]);
    });

    describe("paginateEventTimeline for thread list timeline", function () {
        const RANDOM_TOKEN = "7280349c7bee430f91defe2a38a0a08c";

        function respondToFilter(): ExpectedHttpRequest {
            const request = httpBackend.when("POST", "/filter");
            request.respond(200, { filter_id: "fid" });
            return request;
        }

        function respondToSync(): ExpectedHttpRequest {
            const request = httpBackend.when("GET", "/sync");
            request.respond(200, INITIAL_SYNC_DATA);
            return request;
        }

        function respondToThreads(
            response = {
                chunk: [THREAD_ROOT],
                state: [],
                next_batch: RANDOM_TOKEN as string | null,
            },
        ): ExpectedHttpRequest {
            const request = httpBackend.when(
                "GET",
                encodeUri("/_matrix/client/v1/rooms/$roomId/threads", {
                    $roomId: roomId,
                }),
            );
            request.respond(200, response);
            return request;
        }

        function respondToThread(root: Partial<IEvent>, replies: Partial<IEvent>[]): ExpectedHttpRequest {
            const request = httpBackend.when(
                "GET",
                "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                    encodeURIComponent(root.event_id!) +
                    "/" +
                    encodeURIComponent(THREAD_RELATION_TYPE.name) +
                    "?dir=b&limit=1",
            );
            request.respond(200, function () {
                return {
                    original_event: root,
                    chunk: replies,
                    // no next batch as this is the oldest end of the timeline
                };
            });
            return request;
        }

        function respondToContext(event: Partial<IEvent> = THREAD_ROOT): ExpectedHttpRequest {
            const request = httpBackend.when(
                "GET",
                encodeUri("/_matrix/client/r0/rooms/$roomId/context/$eventId", {
                    $roomId: roomId,
                    $eventId: event.event_id!,
                }),
            );
            request.respond(200, {
                end: `${Direction.Forward}${RANDOM_TOKEN}1`,
                start: `${Direction.Backward}${RANDOM_TOKEN}1`,
                state: [],
                events_before: [],
                events_after: [],
                event: event,
            });
            return request;
        }
        function respondToEvent(event: Partial<IEvent> = THREAD_ROOT): ExpectedHttpRequest {
            const request = httpBackend.when(
                "GET",
                encodeUri("/_matrix/client/r0/rooms/$roomId/event/$eventId", {
                    $roomId: roomId,
                    $eventId: event.event_id!,
                }),
            );
            request.respond(200, event);
            return request;
        }
        function respondToMessagesRequest(): ExpectedHttpRequest {
            const request = httpBackend.when(
                "GET",
                encodeUri("/_matrix/client/r0/rooms/$roomId/messages", {
                    $roomId: roomId,
                }),
            );
            request.respond(200, {
                chunk: [THREAD_ROOT],
                state: [],
                start: `${Direction.Forward}${RANDOM_TOKEN}2`,
                end: `${Direction.Backward}${RANDOM_TOKEN}2`,
            });
            return request;
        }

        describe("with server compatibility", function () {
            beforeEach(() => {
                // @ts-ignore
                client.clientOpts.threadSupport = true;
                Thread.setServerSideSupport(FeatureSupport.Stable);
                Thread.setServerSideListSupport(FeatureSupport.Stable);
                Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);
            });

            async function testPagination(timelineSet: EventTimelineSet, direction: Direction) {
                respondToContext();
                await flushHttp(client.getEventTimeline(timelineSet, THREAD_ROOT.event_id!));
                respondToThreads();
                const timeline = await flushHttp(client.getLatestTimeline(timelineSet));
                expect(timeline).not.toBeNull();

                respondToThreads();
                const success = await flushHttp(
                    client.paginateEventTimeline(timeline!, {
                        backwards: direction === Direction.Backward,
                    }),
                );
                expect(success).toBeTruthy();
                expect(timeline!.getEvents().map((it) => it.event)).toEqual([THREAD_ROOT]);
                expect(timeline!.getPaginationToken(direction)).toEqual(RANDOM_TOKEN);
            }

            it("should allow you to paginate all threads backwards", async function () {
                const room = client.getRoom(roomId);
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();
                const [allThreads, myThreads] = timelineSets!;
                await testPagination(allThreads, Direction.Backward);
                await testPagination(myThreads, Direction.Backward);
            });

            it("should allow you to paginate all threads forwards", async function () {
                const room = client.getRoom(roomId);
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();
                const [allThreads, myThreads] = timelineSets!;

                await testPagination(allThreads, Direction.Forward);
                await testPagination(myThreads, Direction.Forward);
            });

            it("should allow fetching all threads", async function () {
                const room = client.getRoom(roomId)!;
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();
                respondToThreads();
                respondToThreads();
                httpBackend.when("GET", "/sync").respond(200, INITIAL_SYNC_DATA);
                await flushHttp(room.fetchRoomThreads());
            });

            it("should prevent displaying pending events", async function () {
                const room = new Room("room123", client, "john", {
                    pendingEventOrdering: PendingEventOrdering.Detached,
                });
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();

                const event = utils.mkMessage({
                    room: roomId,
                    user: userId,
                    msg: "a body",
                    event: true,
                });
                event.status = EventStatus.SENDING;
                room.addPendingEvent(event, "txn");

                const [allThreads, myThreads] = timelineSets!;
                expect(allThreads.getPendingEvents()).toHaveLength(0);
                expect(myThreads.getPendingEvents()).toHaveLength(0);
                expect(room.getPendingEvents()).toHaveLength(1);
            });

            it("should handle new thread replies by reordering the thread list", async () => {
                // Test data for a second thread
                const THREAD2_ROOT = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.room.message",
                    content: {
                        body: "thread root",
                        msgtype: "m.text",
                    },
                    unsigned: {
                        "m.relations": {
                            "io.element.thread": {
                                //"latest_event": undefined,
                                count: 1,
                                current_user_participated: true,
                            },
                        },
                    },
                    event: false,
                });

                const THREAD2_REPLY = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.room.message",
                    content: {
                        "body": "thread2 reply",
                        "msgtype": "m.text",
                        "m.relates_to": {
                            // We can't use the const here because we change server support mode for test
                            rel_type: "io.element.thread",
                            event_id: THREAD_ROOT.event_id,
                        },
                    },
                    event: false,
                });

                // @ts-ignore we know this is a defined path for THREAD ROOT
                THREAD2_ROOT.unsigned["m.relations"]["io.element.thread"].latest_event = THREAD2_REPLY;

                // Test data for a second reply to the first thread
                const THREAD_REPLY2 = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.room.message",
                    content: {
                        "body": "thread reply2",
                        "msgtype": "m.text",
                        "m.relates_to": {
                            // We can't use the const here because we change server support mode for test
                            rel_type: "io.element.thread",
                            event_id: THREAD_ROOT.event_id,
                        },
                    },
                    event: true,
                });
                THREAD_REPLY2.localTimestamp += 1000;

                // Test data for the first thread, with the second reply
                const THREAD_ROOT_UPDATED = {
                    ...THREAD_ROOT,
                    unsigned: {
                        ...THREAD_ROOT.unsigned,
                        "m.relations": {
                            ...THREAD_ROOT.unsigned!["m.relations"],
                            "io.element.thread": {
                                ...THREAD_ROOT.unsigned!["m.relations"]!["io.element.thread"],
                                count: 2,
                                latest_event: THREAD_REPLY2.event,
                            },
                        },
                    },
                };

                // Response with test data for the thread list request
                const threadsResponse = {
                    chunk: [THREAD2_ROOT, THREAD_ROOT],
                    state: [],
                    next_batch: RANDOM_TOKEN as string | null,
                };

                // @ts-ignore
                client.clientOpts.threadSupport = true;
                Thread.setServerSideSupport(FeatureSupport.Stable);
                Thread.setServerSideListSupport(FeatureSupport.Stable);
                Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);

                await client.stopClient(); // we don't need the client to be syncing at this time
                const room = client.getRoom(roomId)!;

                // Setup room threads
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();
                respondToThreads(threadsResponse);
                respondToThreads(threadsResponse);
                respondToEvent(THREAD_ROOT);
                respondToEvent(THREAD2_ROOT);
                respondToThread(THREAD_ROOT, [THREAD_REPLY]);
                respondToThread(THREAD2_ROOT, [THREAD2_REPLY]);
                await flushHttp(room.fetchRoomThreads());
                const threadIds = room.getThreads().map((thread) => thread.id);
                expect(threadIds).toContain(THREAD_ROOT.event_id);
                expect(threadIds).toContain(THREAD2_ROOT.event_id);
                const [allThreads] = timelineSets!;
                const timeline = allThreads.getLiveTimeline()!;
                // Test threads are in chronological order
                expect(timeline.getEvents().map((it) => it.event.event_id)).toEqual([
                    THREAD_ROOT.event_id,
                    THREAD2_ROOT.event_id,
                ]);

                // Test adding a second event to the first thread
                const thread = room.getThread(THREAD_ROOT.event_id!)!;
                thread.initialEventsFetched = true;
                const prom = emitPromise(room, ThreadEvent.NewReply);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD2_ROOT);
                await room.addLiveEvents([THREAD_REPLY2]);
                await httpBackend.flushAllExpected();
                await prom;
                expect(thread.length).toBe(2);
                // Test threads are in chronological order
                expect(timeline!.getEvents().map((it) => it.event.event_id)).toEqual([
                    THREAD2_ROOT.event_id,
                    THREAD_ROOT.event_id,
                ]);
            });

            it("should not reorder the thread list on other thread updates", async () => {
                // Test data for a second thread
                const THREAD2_ROOT = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.room.message",
                    content: {
                        body: "thread root",
                        msgtype: "m.text",
                    },
                    unsigned: {
                        "m.relations": {
                            "io.element.thread": {
                                //"latest_event": undefined,
                                count: 1,
                                current_user_participated: true,
                            },
                        },
                    },
                    event: false,
                });

                const THREAD2_REPLY = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.room.message",
                    content: {
                        "body": "thread2 reply",
                        "msgtype": "m.text",
                        "m.relates_to": {
                            // We can't use the const here because we change server support mode for test
                            rel_type: "io.element.thread",
                            event_id: THREAD_ROOT.event_id,
                        },
                    },
                    event: false,
                });

                // @ts-ignore we know this is a defined path for THREAD ROOT
                THREAD2_ROOT.unsigned["m.relations"]["io.element.thread"].latest_event = THREAD2_REPLY;

                const THREAD_REPLY_REACTION = utils.mkEvent({
                    room: roomId,
                    user: userId,
                    type: "m.reaction",
                    content: {
                        "m.relates_to": {
                            rel_type: RelationType.Annotation,
                            event_id: THREAD_REPLY.event_id,
                            key: "🪿",
                        },
                    },
                    event: true,
                });
                THREAD_REPLY_REACTION.localTimestamp += 1000;

                // Modified thread root event containing latest thread reply in its unsigned
                const THREAD_ROOT_UPDATED = {
                    ...THREAD_ROOT,
                    unsigned: {
                        ...THREAD_ROOT.unsigned,
                        "m.relations": {
                            ...THREAD_ROOT.unsigned!["m.relations"],
                            "io.element.thread": {
                                ...THREAD_ROOT.unsigned!["m.relations"]!["io.element.thread"],
                                count: 2,
                                latest_event: THREAD_REPLY,
                            },
                        },
                    },
                };

                // Response with test data for the thread list request
                const threadsResponse = {
                    chunk: [THREAD2_ROOT, THREAD_ROOT],
                    state: [],
                    next_batch: RANDOM_TOKEN as string | null,
                };

                // @ts-ignore
                client.clientOpts.threadSupport = true;
                Thread.setServerSideSupport(FeatureSupport.Stable);
                Thread.setServerSideListSupport(FeatureSupport.Stable);
                Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);

                await client.stopClient(); // we don't need the client to be syncing at this time
                const room = client.getRoom(roomId)!;

                // Set up room threads
                const timelineSets = await room!.createThreadsTimelineSets();
                expect(timelineSets).not.toBeNull();
                respondToThreads(threadsResponse);
                respondToThreads(threadsResponse);
                respondToEvent(THREAD_ROOT);
                respondToEvent(THREAD2_ROOT);
                respondToThread(THREAD_ROOT, [THREAD_REPLY]);
                respondToThread(THREAD2_ROOT, [THREAD2_REPLY]);
                await flushHttp(room.fetchRoomThreads());
                const threadIds = room.getThreads().map((thread) => thread.id);
                expect(threadIds).toContain(THREAD_ROOT.event_id);
                expect(threadIds).toContain(THREAD2_ROOT.event_id);
                const [allThreads] = timelineSets!;
                const timeline = allThreads.getLiveTimeline()!;
                // Test threads are in chronological order
                expect(timeline.getEvents().map((it) => it.event.event_id)).toEqual([
                    THREAD_ROOT.event_id,
                    THREAD2_ROOT.event_id,
                ]);

                // Test adding a second event to the first thread
                const thread = room.getThread(THREAD_ROOT.event_id!)!;
                thread.initialEventsFetched = true;
                const prom = emitPromise(room, ThreadEvent.Update);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD_ROOT_UPDATED);
                respondToEvent(THREAD2_ROOT);
                await room.addLiveEvents([THREAD_REPLY_REACTION]);
                await httpBackend.flushAllExpected();
                await prom;
                expect(thread.length).toBe(2);
                // Test thread order is unchanged
                expect(timeline!.getEvents().map((it) => it.event.event_id)).toEqual([
                    THREAD_ROOT.event_id,
                    THREAD2_ROOT.event_id,
                ]);
            });
        });

        describe("without server compatibility", function () {
            beforeEach(() => {
                // @ts-ignore
                client.clientOpts.threadSupport = true;
                Thread.setServerSideSupport(FeatureSupport.Experimental);
                Thread.setServerSideListSupport(FeatureSupport.None);
            });

            async function testPagination(timelineSet: EventTimelineSet, direction: Direction) {
                respondToContext();
                respondToSync();
                await flushHttp(client.getEventTimeline(timelineSet, THREAD_ROOT.event_id!));

                respondToMessagesRequest();
                const timeline = await flushHttp(client.getLatestTimeline(timelineSet));
                expect(timeline).not.toBeNull();

                respondToMessagesRequest();
                const success = await flushHttp(
                    client.paginateEventTimeline(timeline!, {
                        backwards: direction === Direction.Backward,
                    }),
                );

                expect(success).toBeTruthy();
                expect(timeline!.getEvents().map((it) => it.event)).toEqual([THREAD_ROOT]);
                expect(timeline!.getPaginationToken(direction)).toEqual(`${direction}${RANDOM_TOKEN}2`);
            }

            it("should allow you to paginate all threads", async function () {
                const room = client.getRoom(roomId);

                respondToFilter();
                respondToSync();
                respondToFilter();
                respondToSync();

                const timelineSetsPromise = room?.createThreadsTimelineSets();
                expect(timelineSetsPromise).not.toBeNull();
                const timelineSets = await flushHttp(timelineSetsPromise!);
                expect(timelineSets).not.toBeNull();
                const [allThreads, myThreads] = timelineSets!;

                await testPagination(allThreads, Direction.Backward);
                await testPagination(myThreads, Direction.Backward);
            });

            it("should allow fetching all threads", async function () {
                const room = client.getRoom(roomId)!;

                respondToFilter();
                respondToSync();
                respondToFilter();
                respondToSync();

                const timelineSetsPromise = room.createThreadsTimelineSets();
                expect(timelineSetsPromise).not.toBeNull();
                await flushHttp(timelineSetsPromise!);
                respondToFilter();
                respondToSync();
                respondToSync();
                respondToSync();
                respondToMessagesRequest();
                await flushHttp(room.fetchRoomThreads());
            });
        });

        it("should add lazy loading filter", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            Thread.setServerSideListSupport(FeatureSupport.Stable);
            // @ts-ignore
            client.clientOpts.lazyLoadMembers = true;

            const room = client.getRoom(roomId);
            const timelineSets = await room?.createThreadsTimelineSets();
            expect(timelineSets).not.toBeNull();
            const [allThreads] = timelineSets!;

            respondToThreads().check((request) => {
                expect(request.queryParams?.filter).toEqual(
                    JSON.stringify({
                        lazy_load_members: true,
                    }),
                );
            });

            await flushHttp(
                client.paginateEventTimeline(allThreads.getLiveTimeline(), {
                    backwards: true,
                }),
            );
        });

        it("should correctly pass pagination token", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            Thread.setServerSideListSupport(FeatureSupport.Stable);

            const room = client.getRoom(roomId);
            const timelineSets = await room?.createThreadsTimelineSets();
            expect(timelineSets).not.toBeNull();
            const [allThreads] = timelineSets!;

            respondToThreads({
                chunk: [THREAD_ROOT],
                state: [],
                next_batch: null,
            }).check((request) => {
                expect(request.queryParams?.from).toEqual(RANDOM_TOKEN);
            });

            allThreads.getLiveTimeline().setPaginationToken(RANDOM_TOKEN, Direction.Backward);
            await flushHttp(
                client.paginateEventTimeline(allThreads.getLiveTimeline(), {
                    backwards: true,
                }),
            );
        });
    });

    describe("event timeline for sent events", function () {
        const TXN_ID = "txn1";
        const event = utils.mkMessage({
            room: roomId,
            user: userId,
            msg: "a body",
        });
        event.unsigned = { transaction_id: TXN_ID };

        beforeEach(function () {
            // set up handlers for both the message send, and the
            // /sync
            httpBackend.when("PUT", "/send/m.room.message/" + TXN_ID).respond(200, {
                event_id: event.event_id,
            });
            httpBackend.when("GET", "/sync").respond(200, {
                next_batch: "s_5_4",
                rooms: {
                    join: {
                        "!foo:bar": {
                            timeline: {
                                events: [withoutRoomId(event)],
                                prev_batch: "f_1_1",
                            },
                        },
                    },
                },
            });
        });

        it("should work when /send returns before /sync", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0]!;

            return Promise.all([
                client
                    .sendTextMessage(roomId, "a body", TXN_ID)
                    .then(function (res) {
                        expect(res.event_id).toEqual(event.event_id!);
                        return client.getEventTimeline(timelineSet, event.event_id!);
                    })
                    .then(function (tl) {
                        // 2 because the initial sync contained an event
                        expect(tl!.getEvents().length).toEqual(2);
                        expect(tl!.getEvents()[1].getContent().body).toEqual("a body");

                        // now let the sync complete, and check it again
                        return Promise.all([httpBackend.flush("/sync", 1), utils.syncPromise(client)]);
                    })
                    .then(function () {
                        return client.getEventTimeline(timelineSet, event.event_id!);
                    })
                    .then(function (tl) {
                        expect(tl!.getEvents().length).toEqual(2);
                        expect(tl!.getEvents()[1].event).toEqual(event);
                    }),

                httpBackend.flush("/send/m.room.message/" + TXN_ID, 1),
            ]);
        });

        it("should work when /send returns after /sync", function () {
            const room = client.getRoom(roomId)!;
            const timelineSet = room.getTimelineSets()[0];

            return Promise.all([
                // initiate the send, and set up checks to be done when it completes
                // - but note that it won't complete until after the /sync does, below.
                client
                    .sendTextMessage(roomId, "a body", TXN_ID)
                    .then(function (res) {
                        logger.log("sendTextMessage completed");
                        expect(res.event_id).toEqual(event.event_id!);
                        return client.getEventTimeline(timelineSet, event.event_id!);
                    })
                    .then(function (tl) {
                        logger.log("getEventTimeline completed (2)");
                        expect(tl!.getEvents().length).toEqual(2);
                        expect(tl!.getEvents()[1].getContent().body).toEqual("a body");
                    }),

                Promise.all([httpBackend.flush("/sync", 1), utils.syncPromise(client)])
                    .then(function () {
                        return client.getEventTimeline(timelineSet, event.event_id!);
                    })
                    .then(function (tl) {
                        logger.log("getEventTimeline completed (1)");
                        expect(tl!.getEvents().length).toEqual(2);
                        expect(tl!.getEvents()[1].event).toEqual(event);

                        // now let the send complete.
                        return httpBackend.flush("/send/m.room.message/" + TXN_ID, 1);
                    }),
            ]);
        });
    });

    it("should handle gappy syncs after redactions", function () {
        // https://github.com/vector-im/vector-web/issues/1389

        // a state event, followed by a redaction thereof
        const event = utils.mkMembership({
            mship: "join",
            user: otherUserId,
        });
        const redaction = utils.mkEvent({
            type: "m.room.redaction",
            sender: otherUserId,
            content: {},
        });
        redaction.redacts = event.event_id;

        const syncData = {
            next_batch: "batch1",
            rooms: {
                join: {
                    [roomId]: {
                        timeline: {
                            events: [event, redaction],
                            limited: false,
                        },
                    },
                },
            },
        };
        httpBackend.when("GET", "/sync").respond(200, syncData);

        return Promise.all([httpBackend.flushAllExpected(), utils.syncPromise(client)])
            .then(function () {
                const room = client.getRoom(roomId)!;
                const tl = room.getLiveTimeline()!;
                expect(tl!.getEvents().length).toEqual(3);
                expect(tl!.getEvents()[1].isRedacted()).toBe(true);

                const sync2 = {
                    next_batch: "batch2",
                    rooms: {
                        join: {
                            [roomId]: {
                                timeline: {
                                    events: [
                                        utils.mkMessage({
                                            user: otherUserId,
                                            msg: "world",
                                        }),
                                    ],
                                    limited: true,
                                    prev_batch: "newerTok",
                                },
                            },
                        },
                    },
                };
                httpBackend.when("GET", "/sync").respond(200, sync2);

                return Promise.all([httpBackend.flushAllExpected(), utils.syncPromise(client)]);
            })
            .then(function () {
                const room = client.getRoom(roomId)!;
                const tl = room.getLiveTimeline()!;
                expect(tl.getEvents().length).toEqual(1);
            });
    });

    describe("should re-insert room IDs for bundled thread relation events", () => {
        async function doTest() {
            httpBackend.when("GET", "/sync").respond(200, {
                next_batch: "s_5_4",
                rooms: {
                    join: {
                        [roomId]: {
                            timeline: {
                                events: [SYNC_THREAD_ROOT],
                                prev_batch: "f_1_1",
                            },
                        },
                    },
                },
            });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when(
                    "GET",
                    "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                        encodeURIComponent(THREAD_ROOT.event_id!) +
                        "/" +
                        encodeURIComponent(THREAD_RELATION_TYPE.name) +
                        buildRelationPaginationQuery({ dir: Direction.Backward, limit: 1 }),
                )
                .respond(200, function () {
                    return {
                        chunk: [THREAD_REPLY],
                    };
                });
            await Promise.all([httpBackend.flushAllExpected(), utils.syncPromise(client)]);

            const room = client.getRoom(roomId)!;
            const thread = room.getThread(THREAD_ROOT.event_id!)!;
            expect(thread.initialEventsFetched).toBeTruthy();
            const timelineSet = thread.timelineSet;

            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/event/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return THREAD_ROOT;
                });
            httpBackend
                .when("GET", "/rooms/!foo%3Abar/context/" + encodeURIComponent(THREAD_ROOT.event_id!))
                .respond(200, function () {
                    return {
                        start: "start_token",
                        events_before: [],
                        event: THREAD_ROOT,
                        events_after: [],
                        end: "end_token",
                        state: [],
                    };
                });
            httpBackend
                .when(
                    "GET",
                    "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                        encodeURIComponent(THREAD_ROOT.event_id!) +
                        "/" +
                        encodeURIComponent(THREAD_RELATION_TYPE.name) +
                        buildRelationPaginationQuery({
                            dir: Direction.Backward,
                            from: "start_token",
                        }),
                )
                .respond(200, function () {
                    return {
                        chunk: [],
                    };
                });
            httpBackend
                .when(
                    "GET",
                    "/_matrix/client/v1/rooms/!foo%3Abar/relations/" +
                        encodeURIComponent(THREAD_ROOT.event_id!) +
                        "/" +
                        encodeURIComponent(THREAD_RELATION_TYPE.name) +
                        buildRelationPaginationQuery({ dir: Direction.Forward, from: "end_token" }),
                )
                .respond(200, function () {
                    return {
                        chunk: [THREAD_REPLY],
                    };
                });

            const timeline = await flushHttp(client.getEventTimeline(timelineSet, THREAD_ROOT.event_id!));

            httpBackend.when("GET", "/sync").respond(200, {
                next_batch: "s_5_5",
                rooms: {
                    join: {
                        [roomId]: {
                            timeline: {
                                events: [SYNC_THREAD_REPLY],
                                prev_batch: "f_1_2",
                            },
                        },
                    },
                },
            });

            await Promise.all([httpBackend.flushAllExpected(), utils.syncPromise(client)]);

            expect(timeline!.getEvents()[1]!.event).toEqual(THREAD_REPLY);
        }

        it("in stable mode", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Stable);
            Thread.setServerSideListSupport(FeatureSupport.Stable);
            Thread.setServerSideFwdPaginationSupport(FeatureSupport.Stable);

            return doTest();
        });

        it("in backwards compatible unstable mode", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            Thread.setServerSideListSupport(FeatureSupport.Experimental);
            Thread.setServerSideFwdPaginationSupport(FeatureSupport.Experimental);

            return doTest();
        });

        it("in backwards compatible mode", async () => {
            // @ts-ignore
            client.clientOpts.threadSupport = true;
            Thread.setServerSideSupport(FeatureSupport.Experimental);
            Thread.setServerSideListSupport(FeatureSupport.None);
            Thread.setServerSideFwdPaginationSupport(FeatureSupport.None);

            return doTest();
        });
    });
});
