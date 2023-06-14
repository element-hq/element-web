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

// eslint-disable-next-line no-restricted-imports
import EventEmitter from "events";
import MockHttpBackend from "matrix-mock-request";

import {
    SlidingSync,
    SlidingSyncState,
    ExtensionState,
    SlidingSyncEvent,
    Extension,
    SlidingSyncEventHandlerMap,
    MSC3575RoomData,
} from "../../src/sliding-sync";
import { TestClient } from "../TestClient";
import { logger } from "../../src/logger";
import { MatrixClient } from "../../src";

/**
 * Tests for sliding sync. These tests are broken down into sub-tests which are reliant upon one another.
 * Each test suite (describe block) uses a single MatrixClient/HTTPBackend and a single SlidingSync class.
 * Each test will call different functions on SlidingSync which may depend on state from previous tests.
 */
describe("SlidingSync", () => {
    let client: MatrixClient | undefined;
    let httpBackend: MockHttpBackend | undefined;
    const selfUserId = "@alice:localhost";
    const selfAccessToken = "aseukfgwef";
    const proxyBaseUrl = "http://localhost:8008";
    const syncUrl = proxyBaseUrl + "/_matrix/client/unstable/org.matrix.msc3575/sync";

    // assign client/httpBackend globals
    const setupClient = () => {
        const testClient = new TestClient(selfUserId, "DEVICE", selfAccessToken);
        httpBackend = testClient.httpBackend;
        client = testClient.client;
    };

    // tear down client/httpBackend globals
    const teardownClient = () => {
        httpBackend!.verifyNoOutstandingExpectation();
        client!.stopClient();
        return httpBackend!.stop();
    };

    describe("start/stop", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);
        let slidingSync: SlidingSync;

        it("should start the sync loop upon calling start()", async () => {
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), {}, client!, 1);
            const fakeResp = {
                pos: "a",
                lists: {},
                rooms: {},
                extensions: {},
            };
            httpBackend!.when("POST", syncUrl).respond(200, fakeResp);
            const p = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state, resp, err) => {
                expect(state).toEqual(SlidingSyncState.RequestFinished);
                expect(resp).toEqual(fakeResp);
                expect(err).toBeFalsy();
                return true;
            });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            await p;
        });

        it("should stop the sync loop upon calling stop()", () => {
            slidingSync.stop();
            httpBackend!.verifyNoOutstandingExpectation();
        });

        it("should reset the connection on HTTP 400 and send everything again", async () => {
            // seed the connection with some lists, extensions and subscriptions to verify they are sent again
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), {}, client!, 1);
            const roomId = "!sub:localhost";
            const subInfo = {
                timeline_limit: 42,
                required_state: [["m.room.create", ""]],
            };
            const listInfo = {
                ranges: [[0, 10]],
                filters: {
                    is_dm: true,
                },
            };
            const ext: Extension<any, any> = {
                name: () => "custom_extension",
                onRequest: (initial) => {
                    return { initial: initial };
                },
                onResponse: (res) => {
                    return {};
                },
                when: () => ExtensionState.PreProcess,
            };
            slidingSync.modifyRoomSubscriptions(new Set([roomId]));
            slidingSync.modifyRoomSubscriptionInfo(subInfo);
            slidingSync.setList("a", listInfo);
            slidingSync.registerExtension(ext);
            slidingSync.start();

            // expect everything to be sent
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toEqual({
                        [roomId]: subInfo,
                    });
                    expect(body.lists["a"]).toEqual(listInfo);
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions["custom_extension"]).toEqual({ initial: true });
                    expect(req.queryParams!["pos"]).toBeUndefined();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "11",
                        lists: { a: { count: 5 } },
                        extensions: {},
                        txn_id: txnId,
                    };
                });
            await httpBackend!.flushAllExpected();

            // expect nothing but ranges and non-initial extensions to be sent
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeFalsy();
                    expect(body.lists["a"]).toEqual({
                        ranges: [[0, 10]],
                    });
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions["custom_extension"]).toEqual({ initial: false });
                    expect(req.queryParams!["pos"]).toEqual("11");
                })
                .respond(200, function () {
                    return {
                        pos: "12",
                        lists: { a: { count: 5 } },
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();

            // now we expire the session
            httpBackend!.when("POST", syncUrl).respond(400, function () {
                logger.debug("sending session expired 400");
                return {
                    error: "HTTP 400 : session expired",
                };
            });
            await httpBackend!.flushAllExpected();

            // ...and everything should be sent again
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toEqual({
                        [roomId]: subInfo,
                    });
                    expect(body.lists["a"]).toEqual(listInfo);
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions["custom_extension"]).toEqual({ initial: true });
                    expect(req.queryParams!["pos"]).toBeUndefined();
                })
                .respond(200, function () {
                    return {
                        pos: "1",
                        lists: { a: { count: 6 } },
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();
            slidingSync.stop();
        });
    });

    describe("room subscriptions", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);
        const roomId = "!foo:bar";
        const anotherRoomID = "!another:room";
        let roomSubInfo = {
            timeline_limit: 1,
            required_state: [["m.room.name", ""]],
        };
        const wantRoomData = {
            name: "foo bar",
            required_state: [],
            timeline: [],
        };

        let slidingSync: SlidingSync;

        it("should be able to subscribe to a room", async () => {
            // add the subscription
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), roomSubInfo, client!, 1);
            slidingSync.modifyRoomSubscriptions(new Set([roomId]));
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("room sub", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomId]).toEqual(roomSubInfo);
                })
                .respond(200, {
                    pos: "a",
                    lists: {},
                    extensions: {},
                    rooms: {
                        [roomId]: wantRoomData,
                    },
                });

            const p = listenUntil(slidingSync, "SlidingSync.RoomData", (gotRoomId, gotRoomData) => {
                expect(gotRoomId).toEqual(roomId);
                expect(gotRoomData).toEqual(wantRoomData);
                return true;
            });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            await p;
        });

        it("should be possible to adjust room subscription info whilst syncing", async () => {
            // listen for updated request
            const newSubInfo = {
                timeline_limit: 100,
                required_state: [["m.room.member", "*"]],
            };
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("adjusted sub", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomId]).toEqual(newSubInfo);
                })
                .respond(200, {
                    pos: "a",
                    lists: {},
                    extensions: {},
                    rooms: {
                        [roomId]: wantRoomData,
                    },
                });

            const p = listenUntil(slidingSync, "SlidingSync.RoomData", (gotRoomId, gotRoomData) => {
                expect(gotRoomId).toEqual(roomId);
                expect(gotRoomData).toEqual(wantRoomData);
                return true;
            });

            slidingSync.modifyRoomSubscriptionInfo(newSubInfo);
            await httpBackend!.flushAllExpected();
            await p;
            // need to set what the new subscription info is for subsequent tests
            roomSubInfo = newSubInfo;
        });

        it("should be possible to add room subscriptions whilst syncing", async () => {
            // listen for updated request
            const anotherRoomData = {
                name: "foo bar 2",
                room_id: anotherRoomID,
                // we should not fall over if fields are missing.
                // required_state: [],
                // timeline: [],
            };
            const anotherRoomDataFixed = {
                name: anotherRoomData.name,
                room_id: anotherRoomID,
                required_state: [],
                timeline: [],
            };
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("new subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    // only the new room is sent, the other is sticky
                    expect(body.room_subscriptions[anotherRoomID]).toEqual(roomSubInfo);
                    expect(body.room_subscriptions[roomId]).toBeUndefined();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {
                        [anotherRoomID]: anotherRoomData,
                    },
                });

            const p = listenUntil(slidingSync, "SlidingSync.RoomData", (gotRoomId, gotRoomData) => {
                expect(gotRoomId).toEqual(anotherRoomID);
                expect(gotRoomData).toEqual(anotherRoomDataFixed);
                return true;
            });

            const subs = slidingSync.getRoomSubscriptions();
            subs.add(anotherRoomID);
            slidingSync.modifyRoomSubscriptions(subs);
            await httpBackend!.flushAllExpected();
            await p;
        });

        it("should be able to unsubscribe from a room", async () => {
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("unsub request", body);
                    expect(body.room_subscriptions).toBeFalsy();
                    expect(body.unsubscribe_rooms).toEqual([roomId]);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                });

            const p = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });

            // remove the subscription for the first room
            slidingSync.modifyRoomSubscriptions(new Set([anotherRoomID]));

            await httpBackend!.flushAllExpected();
            await p;

            slidingSync.stop();
        });
    });

    describe("lists", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);

        const roomA = "!a:localhost";
        const roomB = "!b:localhost";
        const roomC = "!c:localhost";
        const rooms = {
            [roomA]: {
                name: "A",
                required_state: [],
                timeline: [],
            },
            [roomB]: {
                name: "B",
                required_state: [],
                timeline: [],
            },
            [roomC]: {
                name: "C",
                required_state: [],
                timeline: [],
            },
        };
        const newRanges = [
            [0, 2],
            [3, 5],
        ];

        let slidingSync: SlidingSync;
        it("should be possible to subscribe to a list", async () => {
            // request first 3 rooms
            const listReq = {
                ranges: [[0, 2]],
                sort: ["by_name"],
                timeline_limit: 1,
                required_state: [["m.room.topic", ""]],
                filters: {
                    is_dm: true,
                },
            };
            slidingSync = new SlidingSync(proxyBaseUrl, new Map([["a", listReq]]), {}, client!, 1);
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("list", body);
                    expect(body.lists).toBeTruthy();
                    expect(body.lists["a"]).toEqual(listReq);
                })
                .respond(200, {
                    pos: "a",
                    lists: {
                        a: {
                            count: 500,
                            ops: [
                                {
                                    op: "SYNC",
                                    range: [0, 2],
                                    room_ids: Object.keys(rooms),
                                },
                            ],
                        },
                    },
                    rooms: rooms,
                });
            const listenerData: Record<string, MSC3575RoomData> = {};
            const dataListener: SlidingSyncEventHandlerMap[SlidingSyncEvent.RoomData] = (roomId, roomData) => {
                expect(listenerData[roomId]).toBeFalsy();
                listenerData[roomId] = roomData;
            };
            slidingSync.on(SlidingSyncEvent.RoomData, dataListener);
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            await responseProcessed;

            expect(listenerData[roomA]).toEqual(rooms[roomA]);
            expect(listenerData[roomB]).toEqual(rooms[roomB]);
            expect(listenerData[roomC]).toEqual(rooms[roomC]);

            slidingSync.off(SlidingSyncEvent.RoomData, dataListener);
        });

        it("should be possible to retrieve list data", () => {
            expect(slidingSync.getListParams("a")).toBeDefined();
            expect(slidingSync.getListParams("b")).toBeNull();
            expect(slidingSync.getListData("b")).toBeNull();
            const syncData = slidingSync.getListData("a")!;
            expect(syncData.joinedCount).toEqual(500); // from previous test
            expect(syncData.roomIndexToRoomId).toEqual({
                0: roomA,
                1: roomB,
                2: roomC,
            });
        });

        it("should be possible to adjust list ranges", async () => {
            // modify the list ranges
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("next ranges", body.lists["a"].ranges);
                    expect(body.lists).toBeTruthy();
                    expect(body.lists["a"]).toEqual({
                        // only the ranges should be sent as the rest are unchanged and sticky
                        ranges: newRanges,
                    });
                })
                .respond(200, {
                    pos: "b",
                    lists: {
                        a: {
                            count: 500,
                            ops: [
                                {
                                    op: "SYNC",
                                    range: [0, 2],
                                    room_ids: Object.keys(rooms),
                                },
                            ],
                        },
                    },
                });

            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.RequestFinished;
            });
            slidingSync.setListRanges("a", newRanges);
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            // setListRanges for an invalid list key returns an error
            await expect(slidingSync.setListRanges("idontexist", newRanges)).rejects.toBeTruthy();
        });

        it("should be possible to add an extra list", async () => {
            // add extra list
            const extraListReq = {
                ranges: [[0, 100]],
                sort: ["by_name"],
                filters: {
                    is_dm: true,
                },
            };
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("extra list", body);
                    expect(body.lists).toBeTruthy();
                    expect(body.lists["a"]).toEqual({
                        // only the ranges should be sent as the rest are unchanged and sticky
                        ranges: newRanges,
                    });
                    expect(body.lists["b"]).toEqual(extraListReq);
                })
                .respond(200, {
                    pos: "c",
                    lists: {
                        a: {
                            count: 500,
                        },
                        b: {
                            count: 50,
                            ops: [
                                {
                                    op: "SYNC",
                                    range: [0, 2],
                                    room_ids: Object.keys(rooms),
                                },
                            ],
                        },
                    },
                });
            listenUntil(slidingSync, "SlidingSync.List", (listKey, joinedCount, roomIndexToRoomId) => {
                expect(listKey).toEqual("b");
                expect(joinedCount).toEqual(50);
                expect(roomIndexToRoomId).toEqual({
                    0: roomA,
                    1: roomB,
                    2: roomC,
                });
                return true;
            });
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            slidingSync.setList("b", extraListReq);
            await httpBackend!.flushAllExpected();
            await responseProcessed;
        });

        it("should be possible to get list DELETE/INSERTs", async () => {
            // move C (2) to A (0)
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "e",
                lists: {
                    a: {
                        count: 500,
                        ops: [
                            {
                                op: "DELETE",
                                index: 2,
                            },
                            {
                                op: "INSERT",
                                index: 0,
                                room_id: roomC,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            let listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(500);
                    expect(roomIndexToRoomId).toEqual({
                        0: roomC,
                        1: roomA,
                        2: roomB,
                    });
                    return true;
                },
            );
            let responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;

            // move C (0) back to A (2)
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "f",
                lists: {
                    a: {
                        count: 500,
                        ops: [
                            {
                                op: "DELETE",
                                index: 0,
                            },
                            {
                                op: "INSERT",
                                index: 2,
                                room_id: roomC,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            listPromise = listenUntil(slidingSync, "SlidingSync.List", (listKey, joinedCount, roomIndexToRoomId) => {
                expect(listKey).toEqual("a");
                expect(joinedCount).toEqual(500);
                expect(roomIndexToRoomId).toEqual({
                    0: roomA,
                    1: roomB,
                    2: roomC,
                });
                return true;
            });
            responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
        });

        it("should ignore invalid list indexes", async () => {
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "e",
                lists: {
                    a: {
                        count: 500,
                        ops: [
                            {
                                op: "DELETE",
                                index: 2324324,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            const listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(500);
                    expect(roomIndexToRoomId).toEqual({
                        0: roomA,
                        1: roomB,
                        2: roomC,
                    });
                    return true;
                },
            );
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
        });

        it("should be possible to update a list", async () => {
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "g",
                lists: {
                    a: {
                        count: 42,
                        ops: [
                            {
                                op: "INVALIDATE",
                                range: [0, 2],
                            },
                            {
                                op: "SYNC",
                                range: [0, 1],
                                room_ids: [roomB, roomC],
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            // update the list with a new filter
            slidingSync.setList("a", {
                filters: {
                    is_encrypted: true,
                },
                ranges: [[0, 100]],
            });
            const listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(42);
                    expect(roomIndexToRoomId).toEqual({
                        0: roomB,
                        1: roomC,
                    });
                    return true;
                },
            );
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
        });

        // this refers to a set of operations where the end result is no change.
        it("should handle net zero operations correctly", async () => {
            const indexToRoomId = {
                0: roomB,
                1: roomC,
            };
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual(indexToRoomId);
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "f",
                // currently the list is [B,C] so we will insert D then immediately delete it
                lists: {
                    a: {
                        count: 500,
                        ops: [
                            {
                                op: "DELETE",
                                index: 2,
                            },
                            {
                                op: "INSERT",
                                index: 0,
                                room_id: roomA,
                            },
                            {
                                op: "DELETE",
                                index: 0,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            const listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(500);
                    expect(roomIndexToRoomId).toEqual(indexToRoomId);
                    return true;
                },
            );
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
        });

        it("should handle deletions correctly", async () => {
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({
                0: roomB,
                1: roomC,
            });
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "g",
                lists: {
                    a: {
                        count: 499,
                        ops: [
                            {
                                op: "DELETE",
                                index: 0,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            const listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(499);
                    expect(roomIndexToRoomId).toEqual({
                        0: roomC,
                    });
                    return true;
                },
            );
            const responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
        });

        it("should handle insertions correctly", async () => {
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({
                0: roomC,
            });
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "h",
                lists: {
                    a: {
                        count: 500,
                        ops: [
                            {
                                op: "INSERT",
                                index: 1,
                                room_id: roomA,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            let listPromise = listenUntil(
                slidingSync,
                "SlidingSync.List",
                (listKey, joinedCount, roomIndexToRoomId) => {
                    expect(listKey).toEqual("a");
                    expect(joinedCount).toEqual(500);
                    expect(roomIndexToRoomId).toEqual({
                        0: roomC,
                        1: roomA,
                    });
                    return true;
                },
            );
            let responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;

            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "h",
                lists: {
                    a: {
                        count: 501,
                        ops: [
                            {
                                op: "INSERT",
                                index: 1,
                                room_id: roomB,
                            },
                        ],
                    },
                    b: {
                        count: 50,
                    },
                },
            });
            listPromise = listenUntil(slidingSync, "SlidingSync.List", (listKey, joinedCount, roomIndexToRoomId) => {
                expect(listKey).toEqual("a");
                expect(joinedCount).toEqual(501);
                expect(roomIndexToRoomId).toEqual({
                    0: roomC,
                    1: roomB,
                    2: roomA,
                });
                return true;
            });
            responseProcessed = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await responseProcessed;
            await listPromise;
            slidingSync.stop();
        });

        // Regression test to make sure things like DELETE 0 INSERT 0 work correctly and we don't
        // end up losing room IDs.
        it("should handle insertions with a spurious DELETE correctly", async () => {
            slidingSync = new SlidingSync(
                proxyBaseUrl,
                new Map([
                    [
                        "a",
                        {
                            ranges: [[0, 20]],
                        },
                    ],
                ]),
                {},
                client!,
                1,
            );
            // initially start with nothing
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "a",
                lists: {
                    a: {
                        count: 0,
                        ops: [],
                    },
                },
            });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({});

            // insert a room
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "b",
                lists: {
                    a: {
                        count: 1,
                        ops: [
                            {
                                op: "DELETE",
                                index: 0,
                            },
                            {
                                op: "INSERT",
                                index: 0,
                                room_id: roomA,
                            },
                        ],
                    },
                },
            });
            await httpBackend!.flushAllExpected();
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({
                0: roomA,
            });

            // insert another room
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "c",
                lists: {
                    a: {
                        count: 1,
                        ops: [
                            {
                                op: "DELETE",
                                index: 1,
                            },
                            {
                                op: "INSERT",
                                index: 0,
                                room_id: roomB,
                            },
                        ],
                    },
                },
            });
            await httpBackend!.flushAllExpected();
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({
                0: roomB,
                1: roomA,
            });

            // insert a final room
            httpBackend!.when("POST", syncUrl).respond(200, {
                pos: "c",
                lists: {
                    a: {
                        count: 1,
                        ops: [
                            {
                                op: "DELETE",
                                index: 2,
                            },
                            {
                                op: "INSERT",
                                index: 0,
                                room_id: roomC,
                            },
                        ],
                    },
                },
            });
            await httpBackend!.flushAllExpected();
            expect(slidingSync.getListData("a")!.roomIndexToRoomId).toEqual({
                0: roomC,
                1: roomB,
                2: roomA,
            });
            slidingSync.stop();
        });
    });

    describe("transaction IDs", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);
        const roomId = "!foo:bar";

        let slidingSync: SlidingSync;

        // really this applies to them all but it's easier to just test one
        it("should resolve modifyRoomSubscriptions after SlidingSync.start() is called", async () => {
            const roomSubInfo = {
                timeline_limit: 1,
                required_state: [["m.room.name", ""]],
            };
            // add the subscription
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), roomSubInfo, client!, 1);
            // modification before SlidingSync.start()
            const subscribePromise = slidingSync.modifyRoomSubscriptions(new Set([roomId]));
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomId]).toEqual(roomSubInfo);
                    expect(body.txn_id).toBeTruthy();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "aaa",
                        txn_id: txnId,
                        lists: {},
                        extensions: {},
                        rooms: {
                            [roomId]: {
                                name: "foo bar",
                                required_state: [],
                                timeline: [],
                            },
                        },
                    };
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            await subscribePromise;
        });
        it("should resolve setList during a connection", async () => {
            const newList = {
                ranges: [[0, 20]],
            };
            const promise = slidingSync.setList("a", newList);
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeFalsy();
                    expect(body.lists["a"]).toEqual(newList);
                    expect(body.txn_id).toBeTruthy();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "bbb",
                        txn_id: txnId,
                        lists: { a: { count: 5 } },
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();
            await promise;
            expect(txnId).toBeDefined();
        });
        it("should resolve setListRanges during a connection", async () => {
            const promise = slidingSync.setListRanges("a", [[20, 40]]);
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeFalsy();
                    expect(body.lists["a"]).toEqual({
                        ranges: [[20, 40]],
                    });
                    expect(body.txn_id).toBeTruthy();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "ccc",
                        txn_id: txnId,
                        lists: { a: { count: 5 } },
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();
            await promise;
            expect(txnId).toBeDefined();
        });
        it("should resolve modifyRoomSubscriptionInfo during a connection", async () => {
            const promise = slidingSync.modifyRoomSubscriptionInfo({
                timeline_limit: 99,
            });
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomId]).toEqual({
                        timeline_limit: 99,
                    });
                    expect(body.txn_id).toBeTruthy();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "ddd",
                        txn_id: txnId,
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();
            await promise;
            expect(txnId).toBeDefined();
        });
        it("should reject earlier pending promises if a later transaction is acknowledged", async () => {
            // i.e if we have [A,B,C] and see txn_id=C then A,B should be rejected.
            const gotTxnIds: any[] = [];
            const pushTxn = function (req: MockHttpBackend["requests"][0]) {
                gotTxnIds.push(req.data.txn_id);
            };
            const failPromise = slidingSync.setListRanges("a", [[20, 40]]);
            httpBackend!.when("POST", syncUrl).check(pushTxn).respond(200, { pos: "e" }); // missing txn_id
            await httpBackend!.flushAllExpected();
            const failPromise2 = slidingSync.setListRanges("a", [[60, 70]]);
            httpBackend!.when("POST", syncUrl).check(pushTxn).respond(200, { pos: "f" }); // missing txn_id
            await httpBackend!.flushAllExpected();

            // attach rejection handlers now else if we do it later Jest treats that as an unhandled rejection
            // which is a fail.
            expect(failPromise).rejects.toEqual(gotTxnIds[0]);
            expect(failPromise2).rejects.toEqual(gotTxnIds[1]);

            const okPromise = slidingSync.setListRanges("a", [[0, 20]]);
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check((req) => {
                    txnId = req.data.txn_id;
                })
                .respond(200, () => {
                    // include the txn_id, earlier requests should now be reject()ed.
                    return {
                        pos: "g",
                        txn_id: txnId,
                    };
                });
            await httpBackend!.flushAllExpected();
            await okPromise;

            expect(txnId).toBeDefined();
        });
        it("should not reject later pending promises if an earlier transaction is acknowledged", async () => {
            // i.e if we have [A,B,C] and see txn_id=B then C should not be rejected but A should.
            const gotTxnIds: any[] = [];
            const pushTxn = function (req: MockHttpBackend["requests"][0]) {
                gotTxnIds.push(req.data?.txn_id);
            };
            const A = slidingSync.setListRanges("a", [[20, 40]]);
            httpBackend!.when("POST", syncUrl).check(pushTxn).respond(200, { pos: "A" });
            await httpBackend!.flushAllExpected();
            const B = slidingSync.setListRanges("a", [[60, 70]]);
            httpBackend!.when("POST", syncUrl).check(pushTxn).respond(200, { pos: "B" }); // missing txn_id
            await httpBackend!.flushAllExpected();

            // attach rejection handlers now else if we do it later Jest treats that as an unhandled rejection
            // which is a fail.
            expect(A).rejects.toEqual(gotTxnIds[0]);

            const C = slidingSync.setListRanges("a", [[0, 20]]);
            let pendingC = true;
            C.finally(() => {
                pendingC = false;
            });
            httpBackend!
                .when("POST", syncUrl)
                .check(pushTxn)
                .respond(200, () => {
                    // include the txn_id for B, so C's promise is outstanding
                    return {
                        pos: "C",
                        txn_id: gotTxnIds[1],
                    };
                });
            await httpBackend!.flushAllExpected();
            // A is rejected, see above
            expect(B).resolves.toEqual(gotTxnIds[1]); // B is resolved
            expect(pendingC).toBe(true); // C is pending still
        });
        it("should do nothing for unknown txn_ids", async () => {
            const promise = slidingSync.setListRanges("a", [[20, 40]]);
            let pending = true;
            promise.finally(() => {
                pending = false;
            });
            let txnId: string | undefined;
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.debug("got ", body);
                    expect(body.room_subscriptions).toBeFalsy();
                    expect(body.lists["a"]).toEqual({
                        ranges: [[20, 40]],
                    });
                    expect(body.txn_id).toBeTruthy();
                    txnId = body.txn_id;
                })
                .respond(200, function () {
                    return {
                        pos: "ccc",
                        txn_id: "bogus transaction id",
                        lists: { a: { count: 5 } },
                        extensions: {},
                    };
                });
            await httpBackend!.flushAllExpected();
            expect(txnId).toBeDefined();
            expect(pending).toBe(true);
            slidingSync.stop();
        });
    });

    describe("custom room subscriptions", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);

        const roomA = "!a";
        const roomB = "!b";
        const roomC = "!c";
        const roomD = "!d";

        const defaultSub = {
            timeline_limit: 1,
            required_state: [["m.room.create", ""]],
        };

        const customSubName1 = "sub1";
        const customSub1 = {
            timeline_limit: 2,
            required_state: [["*", "*"]],
        };

        const customSubName2 = "sub2";
        const customSub2 = {
            timeline_limit: 3,
            required_state: [["*", "*"]],
        };

        it("should be possible to use custom subscriptions on startup", async () => {
            const slidingSync = new SlidingSync(proxyBaseUrl, new Map(), defaultSub, client!, 1);
            // the intention is for clients to set this up at startup
            slidingSync.addCustomSubscription(customSubName1, customSub1);
            slidingSync.addCustomSubscription(customSubName2, customSub2);
            // then call these depending on the kind of room / context
            slidingSync.useCustomSubscription(roomA, customSubName1);
            slidingSync.useCustomSubscription(roomB, customSubName1);
            slidingSync.useCustomSubscription(roomC, customSubName2);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA, roomB, roomC, roomD]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(customSub1);
                    expect(body.room_subscriptions[roomB]).toEqual(customSub1);
                    expect(body.room_subscriptions[roomC]).toEqual(customSub2);
                    expect(body.room_subscriptions[roomD]).toEqual(defaultSub);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            slidingSync.stop();
        });

        it("should be possible to use custom subscriptions mid-connection", async () => {
            const slidingSync = new SlidingSync(proxyBaseUrl, new Map(), defaultSub, client!, 1);
            // the intention is for clients to set this up at startup
            slidingSync.addCustomSubscription(customSubName1, customSub1);
            slidingSync.addCustomSubscription(customSubName2, customSub2);
            // initially no subs
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeFalsy();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();

            // now the user clicks on a room which uses the default sub
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(defaultSub);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));
            await httpBackend!.flushAllExpected();

            // now the user clicks on a room which uses a custom sub
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomB]).toEqual(customSub1);
                    expect(body.unsubscribe_rooms).toEqual([roomA]);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.useCustomSubscription(roomB, customSubName1);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomB]));
            await httpBackend!.flushAllExpected();

            // now the user uses a different sub for the same room: we don't unsub but just resend
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomB]).toEqual(customSub2);
                    expect(body.unsubscribe_rooms).toBeFalsy();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.useCustomSubscription(roomB, customSubName2);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomB]));
            await httpBackend!.flushAllExpected();

            slidingSync.stop();
        });

        it("uses the default subscription for unknown subscription names", async () => {
            const slidingSync = new SlidingSync(proxyBaseUrl, new Map(), defaultSub, client!, 1);
            slidingSync.addCustomSubscription(customSubName1, customSub1);
            slidingSync.useCustomSubscription(roomA, "unknown name");
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(defaultSub);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            slidingSync.stop();
        });

        it("should not be possible to add/modify an already added custom subscription", async () => {
            const slidingSync = new SlidingSync(proxyBaseUrl, new Map(), defaultSub, client!, 1);
            slidingSync.addCustomSubscription(customSubName1, customSub1);
            slidingSync.addCustomSubscription(customSubName1, customSub2);
            slidingSync.useCustomSubscription(roomA, customSubName1);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(customSub1);
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            slidingSync.stop();
        });

        it("should change the custom subscription if they are different", async () => {
            const slidingSync = new SlidingSync(proxyBaseUrl, new Map(), defaultSub, client!, 1);
            slidingSync.addCustomSubscription(customSubName1, customSub1);
            slidingSync.addCustomSubscription(customSubName2, customSub2);
            slidingSync.useCustomSubscription(roomA, customSubName1);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(customSub1);
                    expect(body.unsubscribe_rooms).toBeUndefined();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();

            // using the same subscription doesn't unsub nor changes subscriptions
            slidingSync.useCustomSubscription(roomA, customSubName1);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeUndefined();
                    expect(body.unsubscribe_rooms).toBeUndefined();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();

            // Changing the subscription works
            slidingSync.useCustomSubscription(roomA, customSubName2);
            slidingSync.modifyRoomSubscriptions(new Set<string>([roomA]));

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("custom subs", body);
                    expect(body.room_subscriptions).toBeTruthy();
                    expect(body.room_subscriptions[roomA]).toEqual(customSub2);
                    expect(body.unsubscribe_rooms).toBeUndefined();
                })
                .respond(200, {
                    pos: "b",
                    lists: {},
                    extensions: {},
                    rooms: {},
                });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            slidingSync.stop();
        });
    });

    describe("extensions", () => {
        beforeAll(setupClient);
        afterAll(teardownClient);
        let slidingSync: SlidingSync;
        const extReq = {
            foo: "bar",
        };
        const extResp = {
            baz: "quuz",
        };

        // Pre-extensions get called BEFORE processing the sync response
        const preExtName = "foobar";
        let onPreExtensionRequest: Extension<any, any>["onRequest"];
        let onPreExtensionResponse: Extension<any, any>["onResponse"];

        // Post-extensions get called AFTER processing the sync response
        const postExtName = "foobar2";
        let onPostExtensionRequest: Extension<any, any>["onRequest"];
        let onPostExtensionResponse: Extension<any, any>["onResponse"];

        const extPre: Extension<any, any> = {
            name: () => preExtName,
            onRequest: (initial) => {
                return onPreExtensionRequest(initial);
            },
            onResponse: (res) => {
                return onPreExtensionResponse(res);
            },
            when: () => ExtensionState.PreProcess,
        };
        const extPost: Extension<any, any> = {
            name: () => postExtName,
            onRequest: (initial) => {
                return onPostExtensionRequest(initial);
            },
            onResponse: (res) => {
                return onPostExtensionResponse(res);
            },
            when: () => ExtensionState.PostProcess,
        };

        it("should be able to register an extension", async () => {
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), {}, client!, 1);
            slidingSync.registerExtension(extPre);

            const callbackOrder: string[] = [];
            let extensionOnResponseCalled = false;
            onPreExtensionRequest = () => {
                return extReq;
            };
            onPreExtensionResponse = (resp) => {
                extensionOnResponseCalled = true;
                callbackOrder.push("onPreExtensionResponse");
                expect(resp).toEqual(extResp);
            };

            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("ext req", body);
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions[preExtName]).toEqual(extReq);
                })
                .respond(200, {
                    pos: "a",
                    ops: [],
                    counts: [],
                    extensions: {
                        [preExtName]: extResp,
                    },
                });

            const p = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state, resp, err) => {
                if (state === SlidingSyncState.Complete) {
                    callbackOrder.push("Lifecycle");
                    return true;
                }
            });
            slidingSync.start();
            await httpBackend!.flushAllExpected();
            await p;
            expect(extensionOnResponseCalled).toBe(true);
            expect(callbackOrder).toEqual(["onPreExtensionResponse", "Lifecycle"]);
        });

        it("should be able to send nothing in an extension request/response", async () => {
            onPreExtensionRequest = () => {
                return undefined;
            };
            let responseCalled = false;
            onPreExtensionResponse = (resp) => {
                responseCalled = true;
            };
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("ext req nothing", body);
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions[preExtName]).toBeUndefined();
                })
                .respond(200, {
                    pos: "a",
                    ops: [],
                    counts: [],
                    extensions: {},
                });
            // we need to resend as sliding sync will already have a buffered request with the old
            // extension values from the previous test.
            slidingSync.resend();

            const p = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state, resp, err) => {
                return state === SlidingSyncState.Complete;
            });
            await httpBackend!.flushAllExpected();
            await p;
            expect(responseCalled).toBe(false);
        });

        it("is possible to register extensions after start() has been called", async () => {
            slidingSync.registerExtension(extPost);
            onPostExtensionRequest = () => {
                return extReq;
            };
            let responseCalled = false;
            const callbackOrder: string[] = [];
            onPostExtensionResponse = (resp) => {
                expect(resp).toEqual(extResp);
                responseCalled = true;
                callbackOrder.push("onPostExtensionResponse");
            };
            httpBackend!
                .when("POST", syncUrl)
                .check(function (req) {
                    const body = req.data;
                    logger.log("ext req after start", body);
                    expect(body.extensions).toBeTruthy();
                    expect(body.extensions[preExtName]).toBeUndefined(); // from the earlier test
                    expect(body.extensions[postExtName]).toEqual(extReq);
                })
                .respond(200, {
                    pos: "c",
                    ops: [],
                    counts: [],
                    extensions: {
                        [postExtName]: extResp,
                    },
                });
            // we need to resend as sliding sync will already have a buffered request with the old
            // extension values from the previous test.
            slidingSync.resend();

            const p = listenUntil(slidingSync, "SlidingSync.Lifecycle", (state, resp, err) => {
                if (state === SlidingSyncState.Complete) {
                    callbackOrder.push("Lifecycle");
                    return true;
                }
            });
            await httpBackend!.flushAllExpected();
            await p;
            expect(responseCalled).toBe(true);
            expect(callbackOrder).toEqual(["Lifecycle", "onPostExtensionResponse"]);
            slidingSync.stop();
        });

        it("is not possible to register the same extension name twice", async () => {
            slidingSync = new SlidingSync(proxyBaseUrl, new Map(), {}, client!, 1);
            slidingSync.registerExtension(extPre);
            expect(() => {
                slidingSync.registerExtension(extPre);
            }).toThrow();
        });
    });
});

function timeout(delayMs: number, reason: string): { promise: Promise<never>; cancel: () => void } {
    let timeoutId: ReturnType<typeof setTimeout>;
    return {
        promise: new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`timeout: ${delayMs}ms - ${reason}`));
            }, delayMs);
        }),
        cancel: () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        },
    };
}

/**
 * Listen until a callback returns data.
 * @param emitter - The event emitter
 * @param eventName - The event to listen for
 * @param callback - The callback which will be invoked when events fire. Return something truthy from this to resolve the promise.
 * @param timeoutMs - The number of milliseconds to wait for the callback to return data. Default: 500ms.
 * @returns A promise which will be resolved when the callback returns data. If the callback throws or the timeout is reached,
 * the promise is rejected.
 */
function listenUntil<T>(
    emitter: EventEmitter,
    eventName: string,
    callback: (...args: any[]) => T,
    timeoutMs = 500,
): Promise<T> {
    const trace = new Error().stack?.split(`\n`)[2];
    const t = timeout(timeoutMs, "timed out waiting for event " + eventName + " " + trace);
    return Promise.race([
        new Promise<T>((resolve, reject) => {
            const wrapper = (...args: any[]) => {
                try {
                    const data = callback(...args);
                    if (data) {
                        emitter.off(eventName, wrapper);
                        t.cancel();
                        resolve(data);
                    }
                } catch (err) {
                    reject(err);
                    t.cancel();
                }
            };
            emitter.on(eventName, wrapper);
        }),
        t.promise,
    ]);
}
