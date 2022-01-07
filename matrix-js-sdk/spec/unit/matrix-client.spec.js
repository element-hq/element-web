import { logger } from "../../src/logger";
import { MatrixClient } from "../../src/client";
import { Filter } from "../../src/filter";
import { DEFAULT_TREE_POWER_LEVELS_TEMPLATE } from "../../src/models/MSC3089TreeSpace";
import {
    EventType,
    RoomCreateTypeField,
    RoomType,
    UNSTABLE_MSC3088_ENABLED,
    UNSTABLE_MSC3088_PURPOSE,
    UNSTABLE_MSC3089_TREE_SUBTYPE,
} from "../../src/@types/event";
import { MEGOLM_ALGORITHM } from "../../src/crypto/olmlib";
import { MatrixEvent } from "../../src/models/event";
import { Preset } from "../../src/@types/partials";

jest.useFakeTimers();

describe("MatrixClient", function() {
    const userId = "@alice:bar";
    const identityServerUrl = "https://identity.server";
    const identityServerDomain = "identity.server";
    let client;
    let store;
    let scheduler;

    const KEEP_ALIVE_PATH = "/_matrix/client/versions";

    const PUSH_RULES_RESPONSE = {
        method: "GET",
        path: "/pushrules/",
        data: {},
    };

    const FILTER_PATH = "/user/" + encodeURIComponent(userId) + "/filter";

    const FILTER_RESPONSE = {
        method: "POST",
        path: FILTER_PATH,
        data: { filter_id: "f1lt3r" },
    };

    const SYNC_DATA = {
        next_batch: "s_5_3",
        presence: { events: [] },
        rooms: {},
    };

    const SYNC_RESPONSE = {
        method: "GET",
        path: "/sync",
        data: SYNC_DATA,
    };

    let httpLookups = [
        // items are objects which look like:
        // {
        //   method: "GET",
        //   path: "/initialSync",
        //   data: {},
        //   error: { errcode: M_FORBIDDEN } // if present will reject promise,
        //   expectBody: {} // additional expects on the body
        //   expectQueryParams: {} // additional expects on query params
        //   thenCall: function(){} // function to call *AFTER* returning response.
        // }
        // items are popped off when processed and block if no items left.
    ];
    let acceptKeepalives;
    let pendingLookup = null;
    function httpReq(cb, method, path, qp, data, prefix) {
        if (path === KEEP_ALIVE_PATH && acceptKeepalives) {
            return Promise.resolve();
        }
        const next = httpLookups.shift();
        const logLine = (
            "MatrixClient[UT] RECV " + method + " " + path + "  " +
            "EXPECT " + (next ? next.method : next) + " " + (next ? next.path : next)
        );
        logger.log(logLine);

        if (!next) { // no more things to return
            if (pendingLookup) {
                if (pendingLookup.method === method && pendingLookup.path === path) {
                    return pendingLookup.promise;
                }
                // >1 pending thing, and they are different, whine.
                expect(false).toBe(
                    true, ">1 pending request. You should probably handle them. " +
                    "PENDING: " + JSON.stringify(pendingLookup) + " JUST GOT: " +
                    method + " " + path,
                );
            }
            pendingLookup = {
                promise: new Promise(() => {}),
                method: method,
                path: path,
            };
            return pendingLookup.promise;
        }
        if (next.path === path && next.method === method) {
            logger.log(
                "MatrixClient[UT] Matched. Returning " +
                (next.error ? "BAD" : "GOOD") + " response",
            );
            if (next.expectBody) {
                expect(next.expectBody).toEqual(data);
            }
            if (next.expectQueryParams) {
                Object.keys(next.expectQueryParams).forEach(function(k) {
                    expect(qp[k]).toEqual(next.expectQueryParams[k]);
                });
            }

            if (next.thenCall) {
                process.nextTick(next.thenCall, 0); // next tick so we return first.
            }

            if (next.error) {
                return Promise.reject({
                    errcode: next.error.errcode,
                    httpStatus: next.error.httpStatus,
                    name: next.error.errcode,
                    message: "Expected testing error",
                    data: next.error,
                });
            }
            return Promise.resolve(next.data);
        }
        expect(true).toBe(false, "Expected different request. " + logLine);
        return new Promise(() => {});
    }

    beforeEach(function() {
        scheduler = [
            "getQueueForEvent", "queueEvent", "removeEventFromQueue",
            "setProcessFunction",
        ].reduce((r, k) => { r[k] = jest.fn(); return r; }, {});
        store = [
            "getRoom", "getRooms", "getUser", "getSyncToken", "scrollback",
            "save", "wantsSave", "setSyncToken", "storeEvents", "storeRoom", "storeUser",
            "getFilterIdByName", "setFilterIdByName", "getFilter", "storeFilter",
            "getSyncAccumulator", "startup", "deleteAllData",
        ].reduce((r, k) => { r[k] = jest.fn(); return r; }, {});
        store.getSavedSync = jest.fn().mockReturnValue(Promise.resolve(null));
        store.getSavedSyncToken = jest.fn().mockReturnValue(Promise.resolve(null));
        store.setSyncData = jest.fn().mockReturnValue(Promise.resolve(null));
        store.getClientOptions = jest.fn().mockReturnValue(Promise.resolve(null));
        store.storeClientOptions = jest.fn().mockReturnValue(Promise.resolve(null));
        store.isNewlyCreated = jest.fn().mockReturnValue(Promise.resolve(true));
        client = new MatrixClient({
            baseUrl: "https://my.home.server",
            idBaseUrl: identityServerUrl,
            accessToken: "my.access.token",
            request: function() {}, // NOP
            store: store,
            scheduler: scheduler,
            userId: userId,
        });
        // FIXME: We shouldn't be yanking http like this.
        client.http = [
            "authedRequest", "getContentUri", "request", "uploadContent",
        ].reduce((r, k) => { r[k] = jest.fn(); return r; }, {});
        client.http.authedRequest.mockImplementation(httpReq);
        client.http.request.mockImplementation(httpReq);

        // set reasonable working defaults
        acceptKeepalives = true;
        pendingLookup = null;
        httpLookups = [];
        httpLookups.push(PUSH_RULES_RESPONSE);
        httpLookups.push(FILTER_RESPONSE);
        httpLookups.push(SYNC_RESPONSE);
    });

    afterEach(function() {
        // need to re-stub the requests with NOPs because there are no guarantees
        // clients from previous tests will be GC'd before the next test. This
        // means they may call /events and then fail an expect() which will fail
        // a DIFFERENT test (pollution between tests!) - we return unresolved
        // promises to stop the client from continuing to run.
        client.http.authedRequest.mockImplementation(function() {
            return new Promise(() => {});
        });
    });

    it("should create (unstable) file trees", async () => {
        const userId = "@test:example.org";
        const roomId = "!room:example.org";
        const roomName = "Test Tree";
        const mockRoom = {};
        const fn = jest.fn().mockImplementation((opts) => {
            expect(opts).toMatchObject({
                name: roomName,
                preset: Preset.PrivateChat,
                power_level_content_override: {
                    ...DEFAULT_TREE_POWER_LEVELS_TEMPLATE,
                    users: {
                        [userId]: 100,
                    },
                },
                creation_content: {
                    [RoomCreateTypeField]: RoomType.Space,
                },
                initial_state: [
                    {
                        // We use `unstable` to ensure that the code is actually using the right identifier
                        type: UNSTABLE_MSC3088_PURPOSE.unstable,
                        state_key: UNSTABLE_MSC3089_TREE_SUBTYPE.unstable,
                        content: {
                            [UNSTABLE_MSC3088_ENABLED.unstable]: true,
                        },
                    },
                    {
                        type: EventType.RoomEncryption,
                        state_key: "",
                        content: {
                            algorithm: MEGOLM_ALGORITHM,
                        },
                    },
                ],
            });
            return { room_id: roomId };
        });
        client.getUserId = () => userId;
        client.createRoom = fn;
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return mockRoom;
        };
        const tree = await client.unstableCreateFileTree(roomName);
        expect(tree).toBeDefined();
        expect(tree.roomId).toEqual(roomId);
        expect(tree.room).toBe(mockRoom);
        expect(fn.mock.calls.length).toBe(1);
    });

    it("should get (unstable) file trees with valid state", async () => {
        const roomId = "!room:example.org";
        const mockRoom = {
            getMyMembership: () => "join",
            currentState: {
                getStateEvents: (eventType, stateKey) => {
                    if (eventType === EventType.RoomCreate) {
                        expect(stateKey).toEqual("");
                        return new MatrixEvent({
                            content: {
                                [RoomCreateTypeField]: RoomType.Space,
                            },
                        });
                    } else if (eventType === UNSTABLE_MSC3088_PURPOSE.unstable) {
                        // We use `unstable` to ensure that the code is actually using the right identifier
                        expect(stateKey).toEqual(UNSTABLE_MSC3089_TREE_SUBTYPE.unstable);
                        return new MatrixEvent({
                            content: {
                                [UNSTABLE_MSC3088_ENABLED.unstable]: true,
                            },
                        });
                    } else {
                        throw new Error("Unexpected event type or state key");
                    }
                },
            },
        };
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return mockRoom;
        };
        const tree = client.unstableGetFileTreeSpace(roomId);
        expect(tree).toBeDefined();
        expect(tree.roomId).toEqual(roomId);
        expect(tree.room).toBe(mockRoom);
    });

    it("should not get (unstable) file trees if not joined", async () => {
        const roomId = "!room:example.org";
        const mockRoom = {
            getMyMembership: () => "leave", // "not join"
        };
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return mockRoom;
        };
        const tree = client.unstableGetFileTreeSpace(roomId);
        expect(tree).toBeFalsy();
    });

    it("should not get (unstable) file trees for unknown rooms", async () => {
        const roomId = "!room:example.org";
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return null; // imply unknown
        };
        const tree = client.unstableGetFileTreeSpace(roomId);
        expect(tree).toBeFalsy();
    });

    it("should not get (unstable) file trees with invalid create contents", async () => {
        const roomId = "!room:example.org";
        const mockRoom = {
            getMyMembership: () => "join",
            currentState: {
                getStateEvents: (eventType, stateKey) => {
                    if (eventType === EventType.RoomCreate) {
                        expect(stateKey).toEqual("");
                        return new MatrixEvent({
                            content: {
                                [RoomCreateTypeField]: "org.example.not_space",
                            },
                        });
                    } else if (eventType === UNSTABLE_MSC3088_PURPOSE.unstable) {
                        // We use `unstable` to ensure that the code is actually using the right identifier
                        expect(stateKey).toEqual(UNSTABLE_MSC3089_TREE_SUBTYPE.unstable);
                        return new MatrixEvent({
                            content: {
                                [UNSTABLE_MSC3088_ENABLED.unstable]: true,
                            },
                        });
                    } else {
                        throw new Error("Unexpected event type or state key");
                    }
                },
            },
        };
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return mockRoom;
        };
        const tree = client.unstableGetFileTreeSpace(roomId);
        expect(tree).toBeFalsy();
    });

    it("should not get (unstable) file trees with invalid purpose/subtype contents", async () => {
        const roomId = "!room:example.org";
        const mockRoom = {
            getMyMembership: () => "join",
            currentState: {
                getStateEvents: (eventType, stateKey) => {
                    if (eventType === EventType.RoomCreate) {
                        expect(stateKey).toEqual("");
                        return new MatrixEvent({
                            content: {
                                [RoomCreateTypeField]: RoomType.Space,
                            },
                        });
                    } else if (eventType === UNSTABLE_MSC3088_PURPOSE.unstable) {
                        expect(stateKey).toEqual(UNSTABLE_MSC3089_TREE_SUBTYPE.unstable);
                        return new MatrixEvent({
                            content: {
                                [UNSTABLE_MSC3088_ENABLED.unstable]: false,
                            },
                        });
                    } else {
                        throw new Error("Unexpected event type or state key");
                    }
                },
            },
        };
        client.getRoom = (getRoomId) => {
            expect(getRoomId).toEqual(roomId);
            return mockRoom;
        };
        const tree = client.unstableGetFileTreeSpace(roomId);
        expect(tree).toBeFalsy();
    });

    it("should not POST /filter if a matching filter already exists", async function() {
        httpLookups = [];
        httpLookups.push(PUSH_RULES_RESPONSE);
        httpLookups.push(SYNC_RESPONSE);
        const filterId = "ehfewf";
        store.getFilterIdByName.mockReturnValue(filterId);
        const filter = new Filter(0, filterId);
        filter.setDefinition({ "room": { "timeline": { "limit": 8 } } });
        store.getFilter.mockReturnValue(filter);
        const syncPromise = new Promise((resolve, reject) => {
            client.on("sync", function syncListener(state) {
                if (state === "SYNCING") {
                    expect(httpLookups.length).toEqual(0);
                    client.removeListener("sync", syncListener);
                    resolve();
                } else if (state === "ERROR") {
                    reject(new Error("sync error"));
                }
            });
        });
        await client.startClient();
        await syncPromise;
    });

    describe("getSyncState", function() {
        it("should return null if the client isn't started", function() {
            expect(client.getSyncState()).toBe(null);
        });

        it("should return the same sync state as emitted sync events", async function() {
            const syncingPromise = new Promise((resolve) => {
                client.on("sync", function syncListener(state) {
                    expect(state).toEqual(client.getSyncState());
                    if (state === "SYNCING") {
                        client.removeListener("sync", syncListener);
                        resolve();
                    }
                });
            });
            await client.startClient();
            await syncingPromise;
        });
    });

    describe("getOrCreateFilter", function() {
        it("should POST createFilter if no id is present in localStorage", function() {
        });
        it("should use an existing filter if id is present in localStorage", function() {
        });
        it("should handle localStorage filterId missing from the server", function(done) {
            function getFilterName(userId, suffix) {
                // scope this on the user ID because people may login on many accounts
                // and they all need to be stored!
                return "FILTER_SYNC_" + userId + (suffix ? "_" + suffix : "");
            }
            const invalidFilterId = 'invalidF1lt3r';
            httpLookups = [];
            httpLookups.push({
                method: "GET",
                path: FILTER_PATH + '/' + invalidFilterId,
                error: {
                    errcode: "M_UNKNOWN",
                    name: "M_UNKNOWN",
                    message: "No row found",
                    data: { errcode: "M_UNKNOWN", error: "No row found" },
                    httpStatus: 404,
                },
            });
            httpLookups.push(FILTER_RESPONSE);
            store.getFilterIdByName.mockReturnValue(invalidFilterId);

            const filterName = getFilterName(client.credentials.userId);
            client.store.setFilterIdByName(filterName, invalidFilterId);
            const filter = new Filter(client.credentials.userId);

            client.getOrCreateFilter(filterName, filter).then(function(filterId) {
                expect(filterId).toEqual(FILTER_RESPONSE.data.filter_id);
                done();
            });
        });
    });

    describe("retryImmediately", function() {
        it("should return false if there is no request waiting", async function() {
            await client.startClient();
            expect(client.retryImmediately()).toBe(false);
        });

        it("should work on /filter", function(done) {
            httpLookups = [];
            httpLookups.push(PUSH_RULES_RESPONSE);
            httpLookups.push({
                method: "POST", path: FILTER_PATH, error: { errcode: "NOPE_NOPE_NOPE" },
            });
            httpLookups.push(FILTER_RESPONSE);
            httpLookups.push(SYNC_RESPONSE);

            client.on("sync", function syncListener(state) {
                if (state === "ERROR" && httpLookups.length > 0) {
                    expect(httpLookups.length).toEqual(2);
                    expect(client.retryImmediately()).toBe(true);
                    jest.advanceTimersByTime(1);
                } else if (state === "PREPARED" && httpLookups.length === 0) {
                    client.removeListener("sync", syncListener);
                    done();
                } else {
                    // unexpected state transition!
                    expect(state).toEqual(null);
                }
            });
            client.startClient();
        });

        it("should work on /sync", function(done) {
            httpLookups.push({
                method: "GET", path: "/sync", error: { errcode: "NOPE_NOPE_NOPE" },
            });
            httpLookups.push({
                method: "GET", path: "/sync", data: SYNC_DATA,
            });

            client.on("sync", function syncListener(state) {
                if (state === "ERROR" && httpLookups.length > 0) {
                    expect(httpLookups.length).toEqual(1);
                    expect(client.retryImmediately()).toBe(
                        true, "retryImmediately returned false",
                    );
                    jest.advanceTimersByTime(1);
                } else if (state === "RECONNECTING" && httpLookups.length > 0) {
                    jest.advanceTimersByTime(10000);
                } else if (state === "SYNCING" && httpLookups.length === 0) {
                    client.removeListener("sync", syncListener);
                    done();
                }
            });
            client.startClient();
        });

        it("should work on /pushrules", function(done) {
            httpLookups = [];
            httpLookups.push({
                method: "GET", path: "/pushrules/", error: { errcode: "NOPE_NOPE_NOPE" },
            });
            httpLookups.push(PUSH_RULES_RESPONSE);
            httpLookups.push(FILTER_RESPONSE);
            httpLookups.push(SYNC_RESPONSE);

            client.on("sync", function syncListener(state) {
                if (state === "ERROR" && httpLookups.length > 0) {
                    expect(httpLookups.length).toEqual(3);
                    expect(client.retryImmediately()).toBe(true);
                    jest.advanceTimersByTime(1);
                } else if (state === "PREPARED" && httpLookups.length === 0) {
                    client.removeListener("sync", syncListener);
                    done();
                } else {
                    // unexpected state transition!
                    expect(state).toEqual(null);
                }
            });
            client.startClient();
        });
    });

    describe("emitted sync events", function() {
        function syncChecker(expectedStates, done) {
            return function syncListener(state, old) {
                const expected = expectedStates.shift();
                logger.log(
                    "'sync' curr=%s old=%s EXPECT=%s", state, old, expected,
                );
                if (!expected) {
                    done();
                    return;
                }
                expect(state).toEqual(expected[0]);
                expect(old).toEqual(expected[1]);
                if (expectedStates.length === 0) {
                    client.removeListener("sync", syncListener);
                    done();
                }
                // standard retry time is 5 to 10 seconds
                jest.advanceTimersByTime(10000);
            };
        }

        it("should transition null -> PREPARED after the first /sync", function(done) {
            const expectedStates = [];
            expectedStates.push(["PREPARED", null]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition null -> ERROR after a failed /filter", function(done) {
            const expectedStates = [];
            httpLookups = [];
            httpLookups.push(PUSH_RULES_RESPONSE);
            httpLookups.push({
                method: "POST", path: FILTER_PATH, error: { errcode: "NOPE_NOPE_NOPE" },
            });
            expectedStates.push(["ERROR", null]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition ERROR -> CATCHUP after /sync if prev failed",
        function(done) {
            const expectedStates = [];
            acceptKeepalives = false;
            httpLookups = [];
            httpLookups.push(PUSH_RULES_RESPONSE);
            httpLookups.push(FILTER_RESPONSE);
            httpLookups.push({
                method: "GET", path: "/sync", error: { errcode: "NOPE_NOPE_NOPE" },
            });
            httpLookups.push({
                method: "GET", path: KEEP_ALIVE_PATH,
                error: { errcode: "KEEPALIVE_FAIL" },
            });
            httpLookups.push({
                method: "GET", path: KEEP_ALIVE_PATH, data: {},
            });
            httpLookups.push({
                method: "GET", path: "/sync", data: SYNC_DATA,
            });

            expectedStates.push(["RECONNECTING", null]);
            expectedStates.push(["ERROR", "RECONNECTING"]);
            expectedStates.push(["CATCHUP", "ERROR"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition PREPARED -> SYNCING after /sync", function(done) {
            const expectedStates = [];
            expectedStates.push(["PREPARED", null]);
            expectedStates.push(["SYNCING", "PREPARED"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition SYNCING -> ERROR after a failed /sync", function(done) {
            acceptKeepalives = false;
            const expectedStates = [];
            httpLookups.push({
                method: "GET", path: "/sync", error: { errcode: "NONONONONO" },
            });
            httpLookups.push({
                method: "GET", path: KEEP_ALIVE_PATH,
                error: { errcode: "KEEPALIVE_FAIL" },
            });

            expectedStates.push(["PREPARED", null]);
            expectedStates.push(["SYNCING", "PREPARED"]);
            expectedStates.push(["RECONNECTING", "SYNCING"]);
            expectedStates.push(["ERROR", "RECONNECTING"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        xit("should transition ERROR -> SYNCING after /sync if prev failed",
        function(done) {
            const expectedStates = [];
            httpLookups.push({
                method: "GET", path: "/sync", error: { errcode: "NONONONONO" },
            });
            httpLookups.push(SYNC_RESPONSE);

            expectedStates.push(["PREPARED", null]);
            expectedStates.push(["SYNCING", "PREPARED"]);
            expectedStates.push(["ERROR", "SYNCING"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition SYNCING -> SYNCING on subsequent /sync successes",
        function(done) {
            const expectedStates = [];
            httpLookups.push(SYNC_RESPONSE);
            httpLookups.push(SYNC_RESPONSE);

            expectedStates.push(["PREPARED", null]);
            expectedStates.push(["SYNCING", "PREPARED"]);
            expectedStates.push(["SYNCING", "SYNCING"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });

        it("should transition ERROR -> ERROR if keepalive keeps failing", function(done) {
            acceptKeepalives = false;
            const expectedStates = [];
            httpLookups.push({
                method: "GET", path: "/sync", error: { errcode: "NONONONONO" },
            });
            httpLookups.push({
                method: "GET", path: KEEP_ALIVE_PATH,
                error: { errcode: "KEEPALIVE_FAIL" },
            });
            httpLookups.push({
                method: "GET", path: KEEP_ALIVE_PATH,
                error: { errcode: "KEEPALIVE_FAIL" },
            });

            expectedStates.push(["PREPARED", null]);
            expectedStates.push(["SYNCING", "PREPARED"]);
            expectedStates.push(["RECONNECTING", "SYNCING"]);
            expectedStates.push(["ERROR", "RECONNECTING"]);
            expectedStates.push(["ERROR", "ERROR"]);
            client.on("sync", syncChecker(expectedStates, done));
            client.startClient();
        });
    });

    describe("inviteByEmail", function() {
        const roomId = "!foo:bar";

        it("should send an invite HTTP POST", function() {
            httpLookups = [{
                method: "POST",
                path: "/rooms/!foo%3Abar/invite",
                data: {},
                expectBody: {
                    id_server: identityServerDomain,
                    medium: "email",
                    address: "alice@gmail.com",
                },
            }];
            client.inviteByEmail(roomId, "alice@gmail.com");
            expect(httpLookups.length).toEqual(0);
        });
    });

    describe("guest rooms", function() {
        it("should only do /sync calls (without filter/pushrules)", function(done) {
            httpLookups = []; // no /pushrules or /filter
            httpLookups.push({
                method: "GET",
                path: "/sync",
                data: SYNC_DATA,
                thenCall: function() {
                    done();
                },
            });
            client.setGuest(true);
            client.startClient();
        });

        xit("should be able to peek into a room using peekInRoom", function(done) {
        });
    });

    describe("getPresence", function() {
        it("should send a presence HTTP GET", function() {
            httpLookups = [{
                method: "GET",
                path: `/presence/${encodeURIComponent(userId)}/status`,
                data: {
                    "presence": "unavailable",
                    "last_active_ago": 420845,
                },
            }];
            client.getPresence(userId);
            expect(httpLookups.length).toEqual(0);
        });
    });
});
