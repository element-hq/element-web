import HttpBackend from "matrix-mock-request";

import * as utils from "../test-utils/test-utils";
import { ClientEvent, MatrixClient } from "../../src/matrix";
import { MatrixScheduler } from "../../src/scheduler";
import { MemoryStore } from "../../src/store/memory";
import { MatrixError } from "../../src/http-api";
import { IStore } from "../../src/store";

describe("MatrixClient opts", function () {
    const baseUrl = "http://localhost.or.something";
    let httpBackend = new HttpBackend();
    const userId = "@alice:localhost";
    const userB = "@bob:localhost";
    const accessToken = "aseukfgwef";
    const roomId = "!foo:bar";
    const syncData = {
        next_batch: "s_5_3",
        presence: {},
        rooms: {
            join: {
                "!foo:bar": {
                    // roomId
                    timeline: {
                        events: [
                            utils.mkMessage({
                                room: roomId,
                                user: userB,
                                msg: "hello",
                            }),
                        ],
                        prev_batch: "f_1_1",
                    },
                    state: {
                        events: [
                            utils.mkEvent({
                                type: "m.room.name",
                                room: roomId,
                                user: userB,
                                content: {
                                    name: "Old room name",
                                },
                            }),
                            utils.mkMembership({
                                room: roomId,
                                mship: "join",
                                user: userB,
                                name: "Bob",
                            }),
                            utils.mkMembership({
                                room: roomId,
                                mship: "join",
                                user: userId,
                                name: "Alice",
                            }),
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

    beforeEach(function () {
        httpBackend = new HttpBackend();
    });

    afterEach(function () {
        httpBackend.verifyNoOutstandingExpectation();
        return httpBackend.stop();
    });

    describe("without opts.store", function () {
        let client: MatrixClient;
        beforeEach(function () {
            client = new MatrixClient({
                fetchFn: httpBackend.fetchFn as typeof global.fetch,
                store: undefined,
                baseUrl: baseUrl,
                userId: userId,
                accessToken: accessToken,
                scheduler: new MatrixScheduler(),
            });
        });

        afterEach(function () {
            client.stopClient();
        });

        it("should be able to send messages", async () => {
            const eventId = "$flibble:wibble";
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: eventId,
            });
            const [res] = await Promise.all([
                client.sendTextMessage("!foo:bar", "a body", "txn1"),
                httpBackend.flush("/txn1", 1),
            ]);
            expect(res.event_id).toEqual(eventId);
        });

        it("should be able to sync / get new events", async function () {
            const expectedEventTypes = [
                // from /initialSync
                "m.room.message",
                "m.room.name",
                "m.room.member",
                "m.room.member",
                "m.room.create",
            ];
            client.on(ClientEvent.Event, function (event) {
                expect(expectedEventTypes.indexOf(event.getType())).not.toEqual(-1);
                expectedEventTypes.splice(expectedEventTypes.indexOf(event.getType()), 1);
            });
            httpBackend.when("GET", "/versions").respond(200, {});
            httpBackend.when("GET", "/pushrules").respond(200, {});
            httpBackend.when("POST", "/filter").respond(200, { filter_id: "foo" });
            httpBackend.when("GET", "/sync").respond(200, syncData);
            client.startClient();
            await httpBackend.flush("/versions", 1);
            await httpBackend.flush("/pushrules", 1);
            await httpBackend.flush("/filter", 1);
            await Promise.all([httpBackend.flush("/sync", 1), utils.syncPromise(client)]);
            expect(expectedEventTypes.length).toEqual(0);
        });
    });

    describe("without opts.scheduler", function () {
        let client: MatrixClient;
        beforeEach(function () {
            client = new MatrixClient({
                fetchFn: httpBackend.fetchFn as typeof global.fetch,
                store: new MemoryStore() as IStore,
                baseUrl: baseUrl,
                userId: userId,
                accessToken: accessToken,
                scheduler: undefined,
            });
        });

        afterEach(function () {
            client.stopClient();
        });

        it("shouldn't retry sending events", async () => {
            httpBackend.when("PUT", "/txn1").respond(
                500,
                new MatrixError({
                    errcode: "M_SOMETHING",
                    error: "Ruh roh",
                }),
            );

            await expect(
                Promise.all([client.sendTextMessage("!foo:bar", "a body", "txn1"), httpBackend.flush("/txn1", 1)]),
            ).rejects.toThrow("MatrixError: [500] Unknown message");
        });

        it("shouldn't queue events", async () => {
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: "AAA",
            });
            httpBackend.when("PUT", "/txn2").respond(200, {
                event_id: "BBB",
            });
            let sentA = false;
            let sentB = false;
            const messageASendPromise = client.sendTextMessage("!foo:bar", "a body", "txn1").then(function (res) {
                sentA = true;
                // We expect messageB to be sent before messageA to ensure as we're
                // testing that there is no queueing that blocks each other
                expect(sentB).toBe(true);
            });
            const messageBSendPromise = client.sendTextMessage("!foo:bar", "b body", "txn2").then(function (res) {
                sentB = true;
                // We expect messageB to be sent before messageA to ensure as we're
                // testing that there is no queueing that blocks each other
                expect(sentA).toBe(false);
            });
            // Allow messageB to succeed first
            await httpBackend.flush("/txn2", 1);
            // Then allow messageA to succeed
            await httpBackend.flush("/txn1", 1);

            // Now await the message send promises to
            await messageBSendPromise;
            await messageASendPromise;
        });

        it("should be able to send messages", async () => {
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: "foo",
            });
            const [res] = await Promise.all([
                client.sendTextMessage("!foo:bar", "a body", "txn1"),
                httpBackend.flush("/txn1", 1),
            ]);

            expect(res.event_id).toEqual("foo");
        });
    });
});
