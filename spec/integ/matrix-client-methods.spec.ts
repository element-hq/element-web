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
import HttpBackend from "matrix-mock-request";
import { Mocked } from "jest-mock";

import * as utils from "../test-utils/test-utils";
import { CRYPTO_ENABLED, IStoredClientOpts, MatrixClient } from "../../src/client";
import { MatrixEvent } from "../../src/models/event";
import { Filter, MemoryStore, Method, Room, SERVICE_TYPES } from "../../src/matrix";
import { TestClient } from "../TestClient";
import { THREAD_RELATION_TYPE } from "../../src/models/thread";
import { IFilterDefinition } from "../../src/filter";
import { ISearchResults } from "../../src/@types/search";
import { IStore } from "../../src/store";
import { CryptoBackend } from "../../src/common-crypto/CryptoBackend";

describe("MatrixClient", function () {
    const userId = "@alice:localhost";
    const accessToken = "aseukfgwef";
    const idServerDomain = "identity.localhost"; // not a real server
    const identityAccessToken = "woop-i-am-a-secret";
    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;
    let store: MemoryStore | undefined;

    const defaultClientOpts: IStoredClientOpts = {
        threadSupport: false,
    };
    const setupTests = (): [MatrixClient, HttpBackend, MemoryStore] => {
        const store = new MemoryStore();

        const testClient = new TestClient(userId, "aliceDevice", accessToken, undefined, {
            store: store as IStore,
            identityServer: {
                getAccessToken: () => Promise.resolve(identityAccessToken),
            },
            idBaseUrl: `https://${idServerDomain}`,
        });

        return [testClient.client, testClient.httpBackend, store];
    };

    beforeEach(function () {
        [client, httpBackend, store] = setupTests();
    });

    afterEach(function () {
        httpBackend!.verifyNoOutstandingExpectation();
        return httpBackend!.stop();
    });

    describe("uploadContent", function () {
        const buf = Buffer.from("hello world");
        const file = buf;
        const opts = {
            type: "text/plain",
            name: "hi.txt",
        };

        it("should upload the file", function () {
            httpBackend!
                .when("POST", "/_matrix/media/r0/upload")
                .check(function (req) {
                    expect(req.rawData).toEqual(buf);
                    expect(req.queryParams?.filename).toEqual("hi.txt");
                    expect(req.headers["Authorization"]).toBe("Bearer " + accessToken);
                    expect(req.headers["Content-Type"]).toEqual("text/plain");
                    // @ts-ignore private property
                    expect(req.opts.json).toBeFalsy();
                    // @ts-ignore private property
                    expect(req.opts.timeout).toBe(undefined);
                })
                .respond(200, '{"content_uri": "content"}', true);

            const prom = client!.uploadContent(file, opts);

            expect(prom).toBeTruthy();

            const uploads = client!.getCurrentUploads();
            expect(uploads.length).toEqual(1);
            expect(uploads[0].promise).toBe(prom);
            expect(uploads[0].loaded).toEqual(0);

            const prom2 = prom.then(function (response) {
                expect(response.content_uri).toEqual("content");

                const uploads = client!.getCurrentUploads();
                expect(uploads.length).toEqual(0);
            });

            httpBackend!.flush("");
            return prom2;
        });

        it("should parse errors into a MatrixError", function () {
            httpBackend!
                .when("POST", "/_matrix/media/r0/upload")
                .check(function (req) {
                    expect(req.rawData).toEqual(buf);
                    // @ts-ignore private property
                    expect(req.opts.json).toBeFalsy();
                })
                .respond(400, {
                    errcode: "M_SNAFU",
                    error: "broken",
                });

            const prom = client!.uploadContent(file, opts).then(
                function (response) {
                    throw Error("request not failed");
                },
                function (error) {
                    expect(error.httpStatus).toEqual(400);
                    expect(error.errcode).toEqual("M_SNAFU");
                    expect(error.message).toEqual("MatrixError: [400] broken");
                },
            );

            httpBackend!.flush("");
            return prom;
        });

        it("should return a promise which can be cancelled", async () => {
            const prom = client!.uploadContent(file, opts);

            const uploads = client!.getCurrentUploads();
            expect(uploads.length).toEqual(1);
            expect(uploads[0].promise).toBe(prom);
            expect(uploads[0].loaded).toEqual(0);

            const r = client!.cancelUpload(prom);
            expect(r).toBe(true);
            await expect(prom).rejects.toThrow("Aborted");
            expect(client!.getCurrentUploads()).toHaveLength(0);
        });
    });

    describe("joinRoom", function () {
        it("should no-op if you've already joined a room", function () {
            const roomId = "!foo:bar";
            const room = new Room(roomId, client!, userId);
            client!.fetchRoomEvent = () =>
                Promise.resolve({
                    type: "test",
                    content: {},
                });
            room.addLiveEvents([
                utils.mkMembership({
                    user: userId,
                    room: roomId,
                    mship: "join",
                    event: true,
                }),
            ]);
            httpBackend!.verifyNoOutstandingRequests();
            store!.storeRoom(room);
            client!.joinRoom(roomId);
            httpBackend!.verifyNoOutstandingRequests();
        });

        it("should send request to inviteSignUrl if specified", async () => {
            const roomId = "!roomId:server";
            const inviteSignUrl = "https://id.server/sign/this/for/me";
            const viaServers = ["a", "b", "c"];
            const signature = {
                sender: "sender",
                mxid: "@sender:foo",
                token: "token",
                signatures: {},
            };

            httpBackend!
                .when("POST", inviteSignUrl)
                .check((request) => {
                    expect(request.queryParams?.mxid).toEqual(client!.getUserId());
                })
                .respond(200, signature);
            httpBackend!
                .when("POST", "/join/" + encodeURIComponent(roomId))
                .check((request) => {
                    expect(request.data.third_party_signed).toEqual(signature);
                })
                .respond(200, { room_id: roomId });

            const prom = client!.joinRoom(roomId, {
                inviteSignUrl,
                viaServers,
            });
            await httpBackend!.flushAllExpected();
            expect((await prom).roomId).toBe(roomId);
        });
    });

    describe("getFilter", function () {
        const filterId = "f1lt3r1d";

        it("should return a filter from the store if allowCached", async () => {
            const filter = Filter.fromJson(userId, filterId, {
                event_format: "client",
            });
            store!.storeFilter(filter);
            const gotFilter = await client!.getFilter(userId, filterId, true);
            expect(gotFilter).toEqual(filter);
            httpBackend!.verifyNoOutstandingRequests();
        });

        it("should do an HTTP request if !allowCached even if one exists", async () => {
            const httpFilterDefinition = {
                event_format: "federation",
            };

            httpBackend!
                .when("GET", "/user/" + encodeURIComponent(userId) + "/filter/" + filterId)
                .respond(200, httpFilterDefinition);

            const storeFilter = Filter.fromJson(userId, filterId, {
                event_format: "client",
            });
            store!.storeFilter(storeFilter);
            const [gotFilter] = await Promise.all([client!.getFilter(userId, filterId, false), httpBackend!.flush("")]);
            expect(gotFilter.getDefinition()).toEqual(httpFilterDefinition);
        });

        it("should do an HTTP request if nothing is in the cache and then store it", async () => {
            const httpFilterDefinition = {
                event_format: "federation",
            };
            expect(store!.getFilter(userId, filterId)).toBe(null);

            httpBackend!
                .when("GET", "/user/" + encodeURIComponent(userId) + "/filter/" + filterId)
                .respond(200, httpFilterDefinition);
            const [gotFilter] = await Promise.all([client!.getFilter(userId, filterId, true), httpBackend!.flush("")]);
            expect(gotFilter.getDefinition()).toEqual(httpFilterDefinition);
            expect(store!.getFilter(userId, filterId)).toBeTruthy();
        });
    });

    describe("createFilter", function () {
        const filterId = "f1llllllerid";

        it("should do an HTTP request and then store the filter", async () => {
            expect(store!.getFilter(userId, filterId)).toBe(null);

            const filterDefinition = {
                event_format: "client" as IFilterDefinition["event_format"],
            };

            httpBackend!
                .when("POST", "/user/" + encodeURIComponent(userId) + "/filter")
                .check(function (req) {
                    expect(req.data).toEqual(filterDefinition);
                })
                .respond(200, {
                    filter_id: filterId,
                });

            const [gotFilter] = await Promise.all([client!.createFilter(filterDefinition), httpBackend!.flush("")]);
            expect(gotFilter.getDefinition()).toEqual(filterDefinition);
            expect(store!.getFilter(userId, filterId)).toEqual(gotFilter);
        });
    });

    describe("searching", function () {
        it("searchMessageText should perform a /search for room_events", function () {
            const response = {
                search_categories: {
                    room_events: {
                        count: 24,
                        results: [
                            {
                                rank: 0.1,
                                result: {
                                    event_id: "$flibble:localhost",
                                    type: "m.room.message",
                                    user_id: "@alice:localhost",
                                    room_id: "!feuiwhf:localhost",
                                    content: {
                                        body: "a result",
                                        msgtype: "m.text",
                                    },
                                },
                            },
                        ],
                    },
                },
            };

            client!.searchMessageText({
                query: "monkeys",
            });
            httpBackend!
                .when("POST", "/search")
                .check(function (req) {
                    expect(req.data).toEqual({
                        search_categories: {
                            room_events: {
                                search_term: "monkeys",
                            },
                        },
                    });
                })
                .respond(200, response);

            return httpBackend!.flush("");
        });

        describe("should filter out context from different timelines (threads)", () => {
            it("filters out thread replies when result is in the main timeline", async () => {
                const response = {
                    search_categories: {
                        room_events: {
                            count: 24,
                            highlights: [],
                            results: [
                                {
                                    rank: 0.1,
                                    result: {
                                        event_id: "$flibble:localhost",
                                        type: "m.room.message",
                                        sender: "@test:locahost",
                                        origin_server_ts: 123,
                                        user_id: "@alice:localhost",
                                        room_id: "!feuiwhf:localhost",
                                        content: {
                                            body: "main timeline",
                                            msgtype: "m.text",
                                        },
                                    },
                                    context: {
                                        profile_info: {},
                                        events_after: [
                                            {
                                                event_id: "$ev-after:server",
                                                type: "m.room.message",
                                                sender: "@test:locahost",
                                                origin_server_ts: 123,
                                                user_id: "@alice:localhost",
                                                room_id: "!feuiwhf:localhost",
                                                content: {
                                                    "body": "thread reply",
                                                    "msgtype": "m.text",
                                                    "m.relates_to": {
                                                        event_id: "$some-thread:server",
                                                        rel_type: THREAD_RELATION_TYPE.name,
                                                    },
                                                },
                                            },
                                        ],
                                        events_before: [
                                            {
                                                event_id: "$ev-before:server",
                                                type: "m.room.message",
                                                sender: "@test:locahost",
                                                origin_server_ts: 123,
                                                user_id: "@alice:localhost",
                                                room_id: "!feuiwhf:localhost",
                                                content: {
                                                    body: "main timeline again",
                                                    msgtype: "m.text",
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                };

                const data: ISearchResults = {
                    results: [],
                    highlights: [],
                };
                client!.processRoomEventsSearch(data, response);

                expect(data.results).toHaveLength(1);
                expect(data.results[0].context.getTimeline()).toHaveLength(2);
                expect(data.results[0].context.getTimeline().find((e) => e.getId() === "$ev-after:server")).toBeFalsy();
            });

            it("filters out thread replies from threads other than the thread the result replied to", () => {
                const response = {
                    search_categories: {
                        room_events: {
                            count: 24,
                            highlights: [],
                            results: [
                                {
                                    rank: 0.1,
                                    result: {
                                        event_id: "$flibble:localhost",
                                        type: "m.room.message",
                                        sender: "@test:locahost",
                                        origin_server_ts: 123,
                                        user_id: "@alice:localhost",
                                        room_id: "!feuiwhf:localhost",
                                        content: {
                                            "body": "thread 1 reply 1",
                                            "msgtype": "m.text",
                                            "m.relates_to": {
                                                event_id: "$thread1:server",
                                                rel_type: THREAD_RELATION_TYPE.name,
                                            },
                                        },
                                    },
                                    context: {
                                        profile_info: {},
                                        events_after: [
                                            {
                                                event_id: "$ev-after:server",
                                                type: "m.room.message",
                                                sender: "@test:locahost",
                                                origin_server_ts: 123,
                                                user_id: "@alice:localhost",
                                                room_id: "!feuiwhf:localhost",
                                                content: {
                                                    "body": "thread 2 reply 2",
                                                    "msgtype": "m.text",
                                                    "m.relates_to": {
                                                        event_id: "$thread2:server",
                                                        rel_type: THREAD_RELATION_TYPE.name,
                                                    },
                                                },
                                            },
                                        ],
                                        events_before: [],
                                    },
                                },
                            ],
                        },
                    },
                };

                const data: ISearchResults = {
                    results: [],
                    highlights: [],
                };
                client!.processRoomEventsSearch(data, response);

                expect(data.results).toHaveLength(1);
                expect(data.results[0].context.getTimeline()).toHaveLength(1);
                expect(
                    data.results[0].context.getTimeline().find((e) => e.getId() === "$flibble:localhost"),
                ).toBeTruthy();
            });

            it("filters out main timeline events when result is a thread reply", () => {
                const response = {
                    search_categories: {
                        room_events: {
                            count: 24,
                            highlights: [],
                            results: [
                                {
                                    rank: 0.1,
                                    result: {
                                        event_id: "$flibble:localhost",
                                        sender: "@test:locahost",
                                        origin_server_ts: 123,
                                        type: "m.room.message",
                                        user_id: "@alice:localhost",
                                        room_id: "!feuiwhf:localhost",
                                        content: {
                                            "body": "thread 1 reply 1",
                                            "msgtype": "m.text",
                                            "m.relates_to": {
                                                event_id: "$thread1:server",
                                                rel_type: THREAD_RELATION_TYPE.name,
                                            },
                                        },
                                    },
                                    context: {
                                        events_after: [
                                            {
                                                event_id: "$ev-after:server",
                                                sender: "@test:locahost",
                                                origin_server_ts: 123,
                                                type: "m.room.message",
                                                user_id: "@alice:localhost",
                                                room_id: "!feuiwhf:localhost",
                                                content: {
                                                    body: "main timeline",
                                                    msgtype: "m.text",
                                                },
                                            },
                                        ],
                                        events_before: [],
                                        profile_info: {},
                                    },
                                },
                            ],
                        },
                    },
                };

                const data: ISearchResults = {
                    results: [],
                    highlights: [],
                };
                client!.processRoomEventsSearch(data, response);

                expect(data.results).toHaveLength(1);
                expect(data.results[0].context.getTimeline()).toHaveLength(1);
                expect(
                    data.results[0].context.getTimeline().find((e) => e.getId() === "$flibble:localhost"),
                ).toBeTruthy();
            });
        });
    });

    describe("downloadKeys", function () {
        if (!CRYPTO_ENABLED) {
            return;
        }

        beforeEach(function () {
            // running initCrypto should trigger a key upload
            httpBackend!.when("POST", "/keys/upload").respond(200, {});
            return Promise.all([client!.initCrypto(), httpBackend!.flush("/keys/upload", 1)]);
        });

        afterEach(() => {
            client!.stopClient();
        });

        it("should do an HTTP request and then store the keys", function () {
            const ed25519key = "7wG2lzAqbjcyEkOP7O4gU7ItYcn+chKzh5sT/5r2l78";
            // ed25519key = client!.getDeviceEd25519Key();
            const borisKeys = {
                dev1: {
                    algorithms: ["1"],
                    device_id: "dev1",
                    keys: { "ed25519:dev1": ed25519key },
                    signatures: {
                        boris: {
                            "ed25519:dev1":
                                "RAhmbNDq1efK3hCpBzZDsKoGSsrHUxb25NW5/WbEV9R" +
                                "JVwLdP032mg5QsKt/pBDUGtggBcnk43n3nBWlA88WAw",
                        },
                    },
                    unsigned: { abc: "def" },
                    user_id: "boris",
                },
            };
            const chazKeys = {
                dev2: {
                    algorithms: ["2"],
                    device_id: "dev2",
                    keys: { "ed25519:dev2": ed25519key },
                    signatures: {
                        chaz: {
                            "ed25519:dev2":
                                "FwslH/Q7EYSb7swDJbNB5PSzcbEO1xRRBF1riuijqvL" +
                                "EkrK9/XVN8jl4h7thGuRITQ01siBQnNmMK9t45QfcCQ",
                        },
                    },
                    unsigned: { ghi: "def" },
                    user_id: "chaz",
                },
            };

            /*
            function sign(o) {
                var anotherjson = require('another-json');
                var b = JSON.parse(JSON.stringify(o));
                delete(b.signatures);
                delete(b.unsigned);
                return client!.crypto.olmDevice.sign(anotherjson.stringify(b));
            };

            logger.log("Ed25519: " + ed25519key);
            logger.log("boris:", sign(borisKeys.dev1));
            logger.log("chaz:", sign(chazKeys.dev2));
            */

            httpBackend!
                .when("POST", "/keys/query")
                .check(function (req) {
                    expect(req.data).toEqual({
                        device_keys: {
                            boris: [],
                            chaz: [],
                        },
                    });
                })
                .respond(200, {
                    device_keys: {
                        boris: borisKeys,
                        chaz: chazKeys,
                    },
                });

            const prom = client!.downloadKeys(["boris", "chaz"]).then(function (res) {
                assertObjectContains(res.get("boris")!.get("dev1")!, {
                    verified: 0, // DeviceVerification.UNVERIFIED
                    keys: { "ed25519:dev1": ed25519key },
                    algorithms: ["1"],
                    unsigned: { abc: "def" },
                });

                assertObjectContains(res.get("chaz")!.get("dev2")!, {
                    verified: 0, // DeviceVerification.UNVERIFIED
                    keys: { "ed25519:dev2": ed25519key },
                    algorithms: ["2"],
                    unsigned: { ghi: "def" },
                });
            });

            httpBackend!.flush("");
            return prom;
        });
    });

    describe("deleteDevice", function () {
        const auth = { identifier: 1 };
        it("should pass through an auth dict", function () {
            httpBackend!
                .when("DELETE", "/_matrix/client/r0/devices/my_device")
                .check(function (req) {
                    expect(req.data).toEqual({ auth: auth });
                })
                .respond(200);

            const prom = client!.deleteDevice("my_device", auth);

            httpBackend!.flush("");
            return prom;
        });
    });

    describe("partitionThreadedEvents", function () {
        let room: Room;
        beforeEach(() => {
            room = new Room("!STrMRsukXHtqQdSeHa:matrix.org", client!, userId);
        });

        it("returns empty arrays when given an empty arrays", function () {
            const events: MatrixEvent[] = [];
            const [timeline, threaded] = room.partitionThreadedEvents(events);
            expect(timeline).toEqual([]);
            expect(threaded).toEqual([]);
        });

        it("copies pre-thread in-timeline vote events onto both timelines", function () {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const eventPollResponseReference = buildEventPollResponseReference();
            const eventPollStartThreadRoot = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(eventPollStartThreadRoot);

            const events = [eventPollStartThreadRoot, eventMessageInThread, eventPollResponseReference];
            // Vote has no threadId yet
            // @ts-ignore private property
            expect(eventPollResponseReference.threadId).toBeFalsy();

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([
                // The message that was sent in a thread is missing
                eventPollStartThreadRoot,
                eventPollResponseReference,
            ]);

            // The vote event has been copied into the thread
            const eventRefWithThreadId = withThreadId(eventPollResponseReference, eventPollStartThreadRoot.getId()!);
            expect(eventRefWithThreadId.threadRootId).toBeTruthy();

            expect(threaded).toEqual([eventPollStartThreadRoot, eventMessageInThread, eventRefWithThreadId]);
        });

        it("copies pre-thread in-timeline reactions onto both timelines", function () {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const eventPollStartThreadRoot = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(eventPollStartThreadRoot);
            const eventReaction = buildEventReaction(eventPollStartThreadRoot);

            const events = [eventPollStartThreadRoot, eventMessageInThread, eventReaction];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([eventPollStartThreadRoot, eventReaction]);

            expect(threaded).toEqual([
                eventPollStartThreadRoot,
                eventMessageInThread,
                withThreadId(eventReaction, eventPollStartThreadRoot.getId()!),
            ]);
        });

        it("copies post-thread in-timeline vote events onto both timelines", function () {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const eventPollResponseReference = buildEventPollResponseReference();
            const eventPollStartThreadRoot = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(eventPollStartThreadRoot);

            const events = [eventPollStartThreadRoot, eventPollResponseReference, eventMessageInThread];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([eventPollStartThreadRoot, eventPollResponseReference]);

            expect(threaded).toEqual([
                eventPollStartThreadRoot,
                withThreadId(eventPollResponseReference, eventPollStartThreadRoot.getId()!),
                eventMessageInThread,
            ]);
        });

        it("copies post-thread in-timeline reactions onto both timelines", function () {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const eventPollStartThreadRoot = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(eventPollStartThreadRoot);
            const eventReaction = buildEventReaction(eventPollStartThreadRoot);

            const events = [eventPollStartThreadRoot, eventMessageInThread, eventReaction];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([eventPollStartThreadRoot, eventReaction]);

            expect(threaded).toEqual([
                eventPollStartThreadRoot,
                eventMessageInThread,
                withThreadId(eventReaction, eventPollStartThreadRoot.getId()!),
            ]);
        });

        it("sends room state events to the main timeline only", function () {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };
            // This is based on recording the events in a real room:

            const eventPollStartThreadRoot = buildEventPollStartThreadRoot();
            const eventPollResponseReference = buildEventPollResponseReference();
            const eventMessageInThread = buildEventMessageInThread(eventPollStartThreadRoot);
            const eventRoomName = buildEventRoomName();
            const eventEncryption = buildEventEncryption();
            const eventGuestAccess = buildEventGuestAccess();
            const eventHistoryVisibility = buildEventHistoryVisibility();
            const eventJoinRules = buildEventJoinRules();
            const eventPowerLevels = buildEventPowerLevels();
            const eventMember = buildEventMember();
            const eventCreate = buildEventCreate();

            const events = [
                eventPollStartThreadRoot,
                eventPollResponseReference,
                eventMessageInThread,
                eventRoomName,
                eventEncryption,
                eventGuestAccess,
                eventHistoryVisibility,
                eventJoinRules,
                eventPowerLevels,
                eventMember,
                eventCreate,
            ];
            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([
                // The message that was sent in a thread is missing
                eventPollStartThreadRoot,
                eventPollResponseReference,
                eventRoomName,
                eventEncryption,
                eventGuestAccess,
                eventHistoryVisibility,
                eventJoinRules,
                eventPowerLevels,
                eventMember,
                eventCreate,
            ]);

            // Thread should contain only stuff that happened in the thread - no room state events
            expect(threaded).toEqual([
                eventPollStartThreadRoot,
                withThreadId(eventPollResponseReference, eventPollStartThreadRoot.getId()!),
                eventMessageInThread,
            ]);
        });

        it("sends redactions of reactions to thread responses to thread timeline only", () => {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const threadRootEvent = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(threadRootEvent);
            const threadedReaction = buildEventReaction(eventMessageInThread);
            const threadedReactionRedaction = buildEventRedaction(threadedReaction);

            const events = [threadRootEvent, eventMessageInThread, threadedReaction, threadedReactionRedaction];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([threadRootEvent]);

            expect(threaded).toEqual([
                threadRootEvent,
                eventMessageInThread,
                threadedReaction,
                threadedReactionRedaction,
            ]);
        });

        it("sends reply to reply to thread root outside of thread to main timeline only", () => {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const threadRootEvent = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(threadRootEvent);
            const directReplyToThreadRoot = buildEventReply(threadRootEvent);
            const replyToReply = buildEventReply(directReplyToThreadRoot);

            const events = [threadRootEvent, eventMessageInThread, directReplyToThreadRoot, replyToReply];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([threadRootEvent, directReplyToThreadRoot, replyToReply]);

            expect(threaded).toEqual([threadRootEvent, eventMessageInThread]);
        });

        it("sends reply to thread responses to main timeline only", () => {
            // @ts-ignore setting private property
            client!.clientOpts = {
                ...defaultClientOpts,
                threadSupport: true,
            };

            const threadRootEvent = buildEventPollStartThreadRoot();
            const eventMessageInThread = buildEventMessageInThread(threadRootEvent);
            const replyToThreadResponse = buildEventReply(eventMessageInThread);

            const events = [threadRootEvent, eventMessageInThread, replyToThreadResponse];

            const [timeline, threaded] = room.partitionThreadedEvents(events);

            expect(timeline).toEqual([threadRootEvent, replyToThreadResponse]);

            expect(threaded).toEqual([threadRootEvent, eventMessageInThread]);
        });
    });

    describe("getThirdpartyUser", () => {
        it("should hit the expected API endpoint", async () => {
            const response = [
                {
                    userid: "@Bob",
                    protocol: "irc",
                    fields: {},
                },
            ];

            const prom = client!.getThirdpartyUser("irc", {});
            httpBackend!.when("GET", "/thirdparty/user/irc").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getThirdpartyLocation", () => {
        it("should hit the expected API endpoint", async () => {
            const response = [
                {
                    alias: "#alias",
                    protocol: "irc",
                    fields: {},
                },
            ];

            const prom = client!.getThirdpartyLocation("irc", {});
            httpBackend!.when("GET", "/thirdparty/location/irc").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getPushers", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                pushers: [],
            };

            const prom = client!.getPushers();
            httpBackend!.when("GET", "/_matrix/client/versions").respond(200, {});
            httpBackend!.when("GET", "/pushers").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getKeyChanges", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                changed: [],
                left: [],
            };

            const prom = client!.getKeyChanges("old", "new");
            httpBackend!
                .when("GET", "/keys/changes")
                .check((req) => {
                    expect(req.queryParams?.from).toEqual("old");
                    expect(req.queryParams?.to).toEqual("new");
                })
                .respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getDevices", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                devices: [],
            };

            const prom = client!.getDevices();
            httpBackend!.when("GET", "/devices").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getDevice", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                device_id: "DEADBEEF",
                display_name: "NotAPhone",
                last_seen_ip: "127.0.0.1",
                last_seen_ts: 1,
            };

            const prom = client!.getDevice("DEADBEEF");
            httpBackend!.when("GET", "/devices/DEADBEEF").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getThreePids", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                threepids: [],
            };

            const prom = client!.getThreePids();
            httpBackend!.when("GET", "/account/3pid").respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("deleteAlias", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {};
            const prom = client!.deleteAlias("#foo:bar");
            httpBackend!.when("DELETE", "/directory/room/" + encodeURIComponent("#foo:bar")).respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("deleteRoomTag", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {};
            const prom = client!.deleteRoomTag("!roomId:server", "u.tag");
            const url = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent("!roomId:server")}/tags/u.tag`;
            httpBackend!.when("DELETE", url).respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("getRoomTags", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                tags: {
                    "u.tag": {
                        order: 0.5,
                    },
                },
            };

            const prom = client!.getRoomTags("!roomId:server");
            const url = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent("!roomId:server")}/tags`;
            httpBackend!.when("GET", url).respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("requestRegisterEmailToken", () => {
        it("should hit the expected API endpoint", async () => {
            const response = {
                sid: "random_sid",
                submit_url: "https://foobar.matrix/_matrix/matrix",
            };

            httpBackend!.when("GET", "/_matrix/client/versions").respond(200, {
                versions: ["r0.6.0"],
            });

            const prom = client!.requestRegisterEmailToken("bob@email", "secret", 1);
            httpBackend!
                .when("POST", "/register/email/requestToken")
                .check((req) => {
                    expect(req.data).toStrictEqual({
                        email: "bob@email",
                        client_secret: "secret",
                        send_attempt: 1,
                    });
                })
                .respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("inviteByThreePid", () => {
        it("should supply an id_access_token", async () => {
            const targetEmail = "gerald@example.org";

            httpBackend!.when("GET", "/_matrix/client/versions").respond(200, {
                versions: ["r0.6.0"],
            });

            httpBackend!
                .when("POST", "/invite")
                .check((req) => {
                    expect(req.data).toStrictEqual({
                        id_server: idServerDomain,
                        id_access_token: identityAccessToken,
                        medium: "email",
                        address: targetEmail,
                    });
                })
                .respond(200, {});

            const prom = client!.inviteByThreePid("!room:example.org", "email", targetEmail);
            await httpBackend!.flush("");
            await prom; // returns empty object, so no validation needed
        });
    });

    describe("createRoom", () => {
        it("should populate id_access_token on 3pid invites", async () => {
            const targetEmail = "gerald@example.org";
            const response = {
                room_id: "!room:localhost",
            };
            const input = {
                invite_3pid: [
                    {
                        // we intentionally exclude the access token here, so it can be populated for us
                        id_server: idServerDomain,
                        medium: "email",
                        address: targetEmail,
                    },
                ],
            };

            httpBackend!.when("GET", "/_matrix/client/versions").respond(200, {
                versions: ["r0.6.0"],
            });

            httpBackend!
                .when("POST", "/createRoom")
                .check((req) => {
                    expect(req.data).toMatchObject({
                        invite_3pid: expect.arrayContaining([
                            {
                                ...input.invite_3pid[0],
                                id_access_token: identityAccessToken,
                            },
                        ]),
                    });
                    expect(req.data.invite_3pid.length).toBe(1);
                })
                .respond(200, response);

            const prom = client!.createRoom(input);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });
    });

    describe("requestLoginToken", () => {
        it("should hit the expected API endpoint with UIA", async () => {
            httpBackend!
                .when("GET", "/capabilities")
                .respond(200, { capabilities: { "org.matrix.msc3882.get_login_token": { enabled: true } } });
            const response = {};
            const uiaData = {};
            const prom = client!.requestLoginToken(uiaData);
            httpBackend!
                .when("POST", "/unstable/org.matrix.msc3882/login/get_token", { auth: uiaData })
                .respond(200, response);
            await httpBackend!.flush("");
            expect(await prom).toStrictEqual(response);
        });

        it("should hit the expected API endpoint without UIA", async () => {
            httpBackend!
                .when("GET", "/capabilities")
                .respond(200, { capabilities: { "org.matrix.msc3882.get_login_token": { enabled: true } } });
            const response = { login_token: "xyz", expires_in_ms: 5000 };
            const prom = client!.requestLoginToken();
            httpBackend!.when("POST", "/unstable/org.matrix.msc3882/login/get_token", {}).respond(200, response);
            await httpBackend!.flush("");
            // check that expires_in has been populated for compatibility with r0
            expect(await prom).toStrictEqual({ ...response, expires_in: 5 });
        });

        it("should hit the r1 endpoint when capability is disabled", async () => {
            httpBackend!
                .when("GET", "/capabilities")
                .respond(200, { capabilities: { "org.matrix.msc3882.get_login_token": { enabled: false } } });
            const response = { login_token: "xyz", expires_in_ms: 5000 };
            const prom = client!.requestLoginToken();
            httpBackend!.when("POST", "/unstable/org.matrix.msc3882/login/get_token", {}).respond(200, response);
            await httpBackend!.flush("");
            // check that expires_in has been populated for compatibility with r0
            expect(await prom).toStrictEqual({ ...response, expires_in: 5 });
        });

        it("should hit the r0 endpoint for fallback", async () => {
            httpBackend!.when("GET", "/capabilities").respond(200, {});
            const response = { login_token: "xyz", expires_in: 5 };
            const prom = client!.requestLoginToken();
            httpBackend!.when("POST", "/unstable/org.matrix.msc3882/login/token", {}).respond(200, response);
            await httpBackend!.flush("");
            // check that expires_in has been populated for compatibility with r1
            expect(await prom).toStrictEqual({ ...response, expires_in_ms: 5000 });
        });
    });

    describe("logout", () => {
        it("should abort pending requests when called with stopClient=true", async () => {
            httpBackend!.when("POST", "/logout").respond(200, {});
            const fn = jest.fn();
            client!.http.request(Method.Get, "/test").catch(fn);
            client!.logout(true);
            await httpBackend!.flush(undefined);
            expect(fn).toHaveBeenCalled();
        });
    });

    describe("sendHtmlEmote", () => {
        it("should send valid html emote", async () => {
            httpBackend!
                .when("PUT", "/send")
                .check((req) => {
                    expect(req.data).toStrictEqual({
                        msgtype: "m.emote",
                        body: "Body",
                        formatted_body: "<h1>Body</h1>",
                        format: "org.matrix.custom.html",
                    });
                })
                .respond(200, { event_id: "$foobar" });
            const prom = client!.sendHtmlEmote("!room:server", "Body", "<h1>Body</h1>");
            await httpBackend!.flush(undefined);
            await expect(prom).resolves.toStrictEqual({ event_id: "$foobar" });
        });
    });

    describe("sendHtmlMessage", () => {
        it("should send valid html message", async () => {
            httpBackend!
                .when("PUT", "/send")
                .check((req) => {
                    expect(req.data).toStrictEqual({
                        msgtype: "m.text",
                        body: "Body",
                        formatted_body: "<h1>Body</h1>",
                        format: "org.matrix.custom.html",
                    });
                })
                .respond(200, { event_id: "$foobar" });
            const prom = client!.sendHtmlMessage("!room:server", "Body", "<h1>Body</h1>");
            await httpBackend!.flush(undefined);
            await expect(prom).resolves.toStrictEqual({ event_id: "$foobar" });
        });
    });

    describe("forget", () => {
        it("should remove from store by default", async () => {
            const room = new Room("!roomId:server", client!, userId);
            client!.store.storeRoom(room);
            expect(client!.store.getRooms()).toContain(room);

            httpBackend!.when("POST", "/forget").respond(200, {});
            await Promise.all([client!.forget(room.roomId), httpBackend!.flushAllExpected()]);
            expect(client!.store.getRooms()).not.toContain(room);
        });
    });

    describe("getCapabilities", () => {
        it("should cache by default", async () => {
            httpBackend!.when("GET", "/capabilities").respond(200, {
                capabilities: {
                    "m.change_password": false,
                },
            });
            const prom = httpBackend!.flushAllExpected();
            const capabilities1 = await client!.getCapabilities();
            const capabilities2 = await client!.getCapabilities();
            await prom;

            expect(capabilities1).toStrictEqual(capabilities2);
        });
    });

    describe("getTerms", () => {
        it("should return Identity Server terms", async () => {
            httpBackend!.when("GET", "/terms").respond(200, { foo: "bar" });
            const prom = client!.getTerms(SERVICE_TYPES.IS, "http://identity.server");
            await httpBackend!.flushAllExpected();
            await expect(prom).resolves.toEqual({ foo: "bar" });
        });

        it("should return Integrations Manager terms", async () => {
            httpBackend!.when("GET", "/terms").respond(200, { foo: "bar" });
            const prom = client!.getTerms(SERVICE_TYPES.IM, "http://im.server");
            await httpBackend!.flushAllExpected();
            await expect(prom).resolves.toEqual({ foo: "bar" });
        });
    });

    describe("agreeToTerms", () => {
        it("should send `user_accepts` via body of POST request", async () => {
            const terms = ["https://vector.im/notice-1"];

            httpBackend!
                .when("POST", "/terms")
                .check((req) => {
                    expect(req.data.user_accepts).toStrictEqual(terms);
                })
                .respond(200, {});

            const prom = client!.agreeToTerms(SERVICE_TYPES.IS, "https://vector.im", "at", terms);
            await httpBackend!.flushAllExpected();
            await prom;
        });
    });

    describe("publicRooms", () => {
        it("should use GET request if no server or filter is specified", () => {
            httpBackend!.when("GET", "/publicRooms").respond(200, {});
            client!.publicRooms({});
            return httpBackend!.flushAllExpected();
        });

        it("should use GET request if only server is specified", () => {
            httpBackend!
                .when("GET", "/publicRooms")
                .check((request) => {
                    expect(request.queryParams?.server).toBe("server1");
                })
                .respond(200, {});
            client!.publicRooms({ server: "server1" });
            return httpBackend!.flushAllExpected();
        });

        it("should use POST request if filter is specified", () => {
            httpBackend!
                .when("POST", "/publicRooms")
                .check((request) => {
                    expect(request.data.filter.generic_search_term).toBe("foobar");
                })
                .respond(200, {});
            client!.publicRooms({ filter: { generic_search_term: "foobar" } });
            return httpBackend!.flushAllExpected();
        });
    });

    describe("login", () => {
        it("should persist values to the client opts", async () => {
            const token = "!token&";
            const userId = "@m:t";

            httpBackend!.when("POST", "/login").respond(200, {
                access_token: token,
                user_id: userId,
            });
            const prom = client!.login("fake.login", {});
            await httpBackend!.flushAllExpected();
            const resp = await prom;
            expect(resp.access_token).toBe(token);
            expect(resp.user_id).toBe(userId);
            expect(client!.getUserId()).toBe(userId);
            expect(client!.http.opts.accessToken).toBe(token);
        });
    });

    describe("registerWithIdentityServer", () => {
        it("should pass data to POST request", async () => {
            const token = {
                access_token: "access_token",
                token_type: "Bearer",
                matrix_server_name: "server_name",
                expires_in: 12345,
            };

            httpBackend!
                .when("POST", "/account/register")
                .check((req) => {
                    expect(req.data).toStrictEqual(token);
                })
                .respond(200, {
                    access_token: "at",
                    token: "tt",
                });

            const prom = client!.registerWithIdentityServer(token);
            await httpBackend!.flushAllExpected();
            const resp = await prom;
            expect(resp.access_token).toBe("at");
            expect(resp.token).toBe("tt");
        });
    });

    describe("setPowerLevel", () => {
        it.each([
            {
                userId: "alice@localhost",
                powerLevel: 100,
                expectation: {
                    "alice@localhost": 100,
                },
            },
            {
                userId: ["alice@localhost", "bob@localhost"],
                powerLevel: 100,
                expectation: {
                    "alice@localhost": 100,
                    "bob@localhost": 100,
                },
            },
            {
                userId: "alice@localhost",
                powerLevel: undefined,
                expectation: {},
            },
        ])("should modify power levels of $userId correctly", async ({ userId, powerLevel, expectation }) => {
            const event = {
                getType: () => "m.room.power_levels",
                getContent: () => ({
                    users: {
                        "alice@localhost": 50,
                    },
                }),
            } as MatrixEvent;

            httpBackend!
                .when("PUT", "/state/m.room.power_levels")
                .check((req) => {
                    expect(req.data.users).toStrictEqual(expectation);
                })
                .respond(200, {});

            const prom = client!.setPowerLevel("!room_id:server", userId, powerLevel, event);
            await httpBackend!.flushAllExpected();
            await prom;
        });
    });

    describe("uploadKeys", () => {
        // uploadKeys() is a no-op nowadays, so there's not much to test here.
        it("should complete successfully", async () => {
            await client!.uploadKeys();
        });
    });

    describe("getCryptoTrustCrossSignedDevices", () => {
        it("should throw if e2e is disabled", () => {
            expect(() => client!.getCryptoTrustCrossSignedDevices()).toThrow("End-to-end encryption disabled");
        });

        it("should proxy to the crypto backend", async () => {
            const mockBackend = {
                getTrustCrossSignedDevices: jest.fn().mockReturnValue(true),
            } as unknown as Mocked<CryptoBackend>;
            client!["cryptoBackend"] = mockBackend;

            expect(client!.getCryptoTrustCrossSignedDevices()).toBe(true);
            mockBackend.getTrustCrossSignedDevices.mockReturnValue(false);
            expect(client!.getCryptoTrustCrossSignedDevices()).toBe(false);
        });
    });

    describe("setCryptoTrustCrossSignedDevices", () => {
        it("should throw if e2e is disabled", () => {
            expect(() => client!.setCryptoTrustCrossSignedDevices(false)).toThrow("End-to-end encryption disabled");
        });

        it("should proxy to the crypto backend", async () => {
            const mockBackend = {
                setTrustCrossSignedDevices: jest.fn(),
            } as unknown as Mocked<CryptoBackend>;
            client!["cryptoBackend"] = mockBackend;

            client!.setCryptoTrustCrossSignedDevices(true);
            expect(mockBackend.setTrustCrossSignedDevices).toHaveBeenLastCalledWith(true);

            client!.setCryptoTrustCrossSignedDevices(false);
            expect(mockBackend.setTrustCrossSignedDevices).toHaveBeenLastCalledWith(false);
        });
    });
});

function withThreadId(event: MatrixEvent, newThreadId: string): MatrixEvent {
    const ret = event.toSnapshot();
    ret.setThreadId(newThreadId);
    return ret;
}

const buildEventMessageInThread = (root: MatrixEvent) =>
    new MatrixEvent({
        age: 80098509,
        content: {
            "algorithm": "m.megolm.v1.aes-sha2",
            "ciphertext": "ENCRYPTEDSTUFF",
            "device_id": "XISFUZSKHH",
            "m.relates_to": {
                "event_id": root.getId(),
                "m.in_reply_to": {
                    event_id: root.getId()!,
                },
                "rel_type": "m.thread",
            },
            "sender_key": "i3N3CtG/CD2bGB8rA9fW6adLYSDvlUhf2iuU73L65Vg",
            "session_id": "Ja11R/KG6ua0wdk8zAzognrxjio1Gm/RK2Gn6lFL804",
        },
        event_id: "$W4chKIGYowtBblVLkRimeIg8TcdjETnxhDPGfi6NpDg",
        origin_server_ts: 1643815466378,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        type: "m.room.encrypted",
        unsigned: { age: 80098509 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventPollResponseReference = () =>
    new MatrixEvent({
        age: 80098509,
        content: {
            "algorithm": "m.megolm.v1.aes-sha2",
            "ciphertext": "ENCRYPTEDSTUFF",
            "device_id": "XISFUZSKHH",
            "m.relates_to": {
                event_id: "$VLS2ojbPmxb6x8ECetn45hmND6cRDcjgv-j-to9m7Vo",
                rel_type: "m.reference",
            },
            "sender_key": "i3N3CtG/CD2bGB8rA9fW6adLYSDvlUhf2iuU73L65Vg",
            "session_id": "Ja11R/KG6ua0wdk8zAzognrxjio1Gm/RK2Gn6lFL804",
        },
        event_id: "$91JvpezvsF0cKgav3g8W-uEVS4WkDHgxbJZvL3uMR1g",
        origin_server_ts: 1643815458650,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        type: "m.room.encrypted",
        unsigned: { age: 80106237 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventReaction = (event: MatrixEvent) =>
    new MatrixEvent({
        content: {
            "m.relates_to": {
                event_id: event.getId(),
                key: "🤗",
                rel_type: "m.annotation",
            },
        },
        origin_server_ts: 1643977249238,
        sender: "@andybalaam-test1:matrix.org",
        type: "m.reaction",
        unsigned: {
            age: 22598,
            transaction_id: "m1643977249073.16",
        },
        event_id: "$86B2b-x3LgE4DlV4y24b7UHnt72LIA3rzjvMysTtAfA",
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
    });

const buildEventRedaction = (event: MatrixEvent) =>
    new MatrixEvent({
        content: {},
        origin_server_ts: 1643977249239,
        sender: "@andybalaam-test1:matrix.org",
        redacts: event.getId(),
        type: "m.room.redaction",
        unsigned: {
            age: 22597,
            transaction_id: "m1643977249073.17",
        },
        event_id: "$86B2b-x3LgE4DlV4y24b7UHnt72LIA3rzjvMysTtAfB",
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
    });

const buildEventPollStartThreadRoot = () =>
    new MatrixEvent({
        age: 80108647,
        content: {
            algorithm: "m.megolm.v1.aes-sha2",
            ciphertext: "ENCRYPTEDSTUFF",
            device_id: "XISFUZSKHH",
            sender_key: "i3N3CtG/CD2bGB8rA9fW6adLYSDvlUhf2iuU73L65Vg",
            session_id: "Ja11R/KG6ua0wdk8zAzognrxjio1Gm/RK2Gn6lFL804",
        },
        event_id: "$VLS2ojbPmxb6x8ECetn45hmND6cRDcjgv-j-to9m7Vo",
        origin_server_ts: 1643815456240,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        type: "m.room.encrypted",
        unsigned: { age: 80108647 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventReply = (target: MatrixEvent) =>
    new MatrixEvent({
        age: 80098509,
        content: {
            "algorithm": "m.megolm.v1.aes-sha2",
            "ciphertext": "ENCRYPTEDSTUFF",
            "device_id": "XISFUZSKHH",
            "m.relates_to": {
                "m.in_reply_to": {
                    event_id: target.getId()!,
                },
            },
            "sender_key": "i3N3CtG/CD2bGB8rA9fW6adLYSDvlUhf2iuU73L65Vg",
            "session_id": "Ja11R/KG6ua0wdk8zAzognrxjio1Gm/RK2Gn6lFL804",
        },
        event_id: target.getId()! + Math.random(),
        origin_server_ts: 1643815466378,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        type: "m.room.encrypted",
        unsigned: { age: 80098509 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventRoomName = () =>
    new MatrixEvent({
        age: 80123249,
        content: {
            name: "1 poll, 1 vote, 1 thread",
        },
        event_id: "$QAdyNJtKnl1j7or2yMycbOCvb6bCgvHs5lg3ZMd5xWk",
        origin_server_ts: 1643815441638,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.name",
        unsigned: { age: 80123249 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventEncryption = () =>
    new MatrixEvent({
        age: 80123383,
        content: {
            algorithm: "m.megolm.v1.aes-sha2",
        },
        event_id: "$1hGykogKQkXbHw8bVuyE3BjHnFBEJBcUWnakd0ck2K0",
        origin_server_ts: 1643815441504,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.encryption",
        unsigned: { age: 80123383 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventGuestAccess = () =>
    new MatrixEvent({
        age: 80123473,
        content: {
            guest_access: "can_join",
        },
        event_id: "$4_2n-H6K9-0nPbnjjtIue2SU44tGJsnuTmi6UuSrh-U",
        origin_server_ts: 1643815441414,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.guest_access",
        unsigned: { age: 80123473 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventHistoryVisibility = () =>
    new MatrixEvent({
        age: 80123556,
        content: {
            history_visibility: "shared",
        },
        event_id: "$W6kp44CTnvciOiHSPyhp8dh4n2v1_9kclUPddeaQj0E",
        origin_server_ts: 1643815441331,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.history_visibility",
        unsigned: { age: 80123556 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventJoinRules = () =>
    new MatrixEvent({
        age: 80123696,
        content: {
            join_rule: "invite",
        },
        event_id: "$6JDDeDp7fEc0F6YnTWMruNcKWFltR3e9wk7wWDDJrAU",
        origin_server_ts: 1643815441191,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.join_rules",
        unsigned: { age: 80123696 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventPowerLevels = () =>
    new MatrixEvent({
        age: 80124105,
        content: {
            ban: 50,
            events: {
                "m.room.avatar": 50,
                "m.room.canonical_alias": 50,
                "m.room.encryption": 100,
                "m.room.history_visibility": 100,
                "m.room.name": 50,
                "m.room.power_levels": 100,
                "m.room.server_acl": 100,
                "m.room.tombstone": 100,
            },
            events_default: 0,
            historical: 100,
            invite: 0,
            kick: 50,
            redact: 50,
            state_default: 50,
            users: {
                "@andybalaam-test1:matrix.org": 100,
            },
            users_default: 0,
        },
        event_id: "$XZY2YgQhXskpc7gmJJG3S0VmS9_QjjCUVeeFTfgfC2E",
        origin_server_ts: 1643815440782,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.power_levels",
        unsigned: { age: 80124105 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventMember = () =>
    new MatrixEvent({
        age: 80125279,
        content: {
            avatar_url: "mxc://matrix.org/aNtbVcFfwotudypZcHsIcPOc",
            displayname: "andybalaam-test1",
            membership: "join",
        },
        event_id: "$Ex5eVmMs_ti784mo8bgddynbwLvy6231lCycJr7Cl9M",
        origin_server_ts: 1643815439608,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "@andybalaam-test1:matrix.org",
        type: "m.room.member",
        unsigned: { age: 80125279 },
        user_id: "@andybalaam-test1:matrix.org",
    });

const buildEventCreate = () =>
    new MatrixEvent({
        age: 80126105,
        content: {
            creator: "@andybalaam-test1:matrix.org",
            room_version: "6",
        },
        event_id: "$e7j2Gt37k5NPwB6lz2N3V9lO5pUdNK8Ai7i2FPEK-oI",
        origin_server_ts: 1643815438782,
        room_id: "!STrMRsukXHtqQdSeHa:matrix.org",
        sender: "@andybalaam-test1:matrix.org",
        state_key: "",
        type: "m.room.create",
        unsigned: { age: 80126105 },
        user_id: "@andybalaam-test1:matrix.org",
    });

function assertObjectContains(obj: Record<string, any>, expected: any): void {
    for (const k in expected) {
        if (expected.hasOwnProperty(k)) {
            expect(obj[k]).toEqual(expected[k]);
        }
    }
}
