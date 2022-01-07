import HttpBackend from "matrix-mock-request";

import * as utils from "../test-utils";
import { MatrixClient } from "../../src/matrix";
import { MatrixScheduler } from "../../src/scheduler";
import { MemoryStore } from "../../src/store/memory";
import { MatrixError } from "../../src/http-api";

describe("MatrixClient opts", function() {
    const baseUrl = "http://localhost.or.something";
    let client = null;
    let httpBackend = null;
    const userId = "@alice:localhost";
    const userB = "@bob:localhost";
    const accessToken = "aseukfgwef";
    const roomId = "!foo:bar";
    const syncData = {
        next_batch: "s_5_3",
        presence: {},
        rooms: {
            join: {
                "!foo:bar": { // roomId
                    timeline: {
                        events: [
                            utils.mkMessage({
                                room: roomId, user: userB, msg: "hello",
                            }),
                        ],
                        prev_batch: "f_1_1",
                    },
                    state: {
                        events: [
                            utils.mkEvent({
                                type: "m.room.name", room: roomId, user: userB,
                                content: {
                                    name: "Old room name",
                                },
                            }),
                            utils.mkMembership({
                                room: roomId, mship: "join", user: userB, name: "Bob",
                            }),
                            utils.mkMembership({
                                room: roomId, mship: "join", user: userId, name: "Alice",
                            }),
                            utils.mkEvent({
                                type: "m.room.create", room: roomId, user: userId,
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

    beforeEach(function() {
        httpBackend = new HttpBackend();
    });

    afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
        return httpBackend.stop();
    });

    describe("without opts.store", function() {
        beforeEach(function() {
            client = new MatrixClient({
                request: httpBackend.requestFn,
                store: undefined,
                baseUrl: baseUrl,
                userId: userId,
                accessToken: accessToken,
                scheduler: new MatrixScheduler(),
            });
        });

        afterEach(function() {
            client.stopClient();
        });

        it("should be able to send messages", function(done) {
            const eventId = "$flibble:wibble";
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: eventId,
            });
            client.sendTextMessage("!foo:bar", "a body", "txn1").then(function(res) {
                expect(res.event_id).toEqual(eventId);
                done();
            });
            httpBackend.flush("/txn1", 1);
        });

        it("should be able to sync / get new events", async function() {
            const expectedEventTypes = [ // from /initialSync
                "m.room.message", "m.room.name", "m.room.member", "m.room.member",
                "m.room.create",
            ];
            client.on("event", function(event) {
                expect(expectedEventTypes.indexOf(event.getType())).not.toEqual(
                    -1, "Recv unexpected event type: " + event.getType(),
                );
                expectedEventTypes.splice(
                    expectedEventTypes.indexOf(event.getType()), 1,
                );
            });
            httpBackend.when("GET", "/pushrules").respond(200, {});
            httpBackend.when("POST", "/filter").respond(200, { filter_id: "foo" });
            httpBackend.when("GET", "/sync").respond(200, syncData);
            await client.startClient();
            await httpBackend.flush("/pushrules", 1);
            await httpBackend.flush("/filter", 1);
            await Promise.all([
                httpBackend.flush("/sync", 1),
                utils.syncPromise(client),
            ]);
            expect(expectedEventTypes.length).toEqual(
                0, "Expected to see event types: " + expectedEventTypes,
            );
        });
    });

    describe("without opts.scheduler", function() {
        beforeEach(function() {
            client = new MatrixClient({
                request: httpBackend.requestFn,
                store: new MemoryStore(),
                baseUrl: baseUrl,
                userId: userId,
                accessToken: accessToken,
                scheduler: undefined,
            });
        });

        it("shouldn't retry sending events", function(done) {
            httpBackend.when("PUT", "/txn1").fail(500, new MatrixError({
                errcode: "M_SOMETHING",
                error: "Ruh roh",
            }));
            client.sendTextMessage("!foo:bar", "a body", "txn1").then(function(res) {
                expect(false).toBe(true, "sendTextMessage resolved but shouldn't");
            }, function(err) {
                expect(err.errcode).toEqual("M_SOMETHING");
                done();
            });
            httpBackend.flush("/txn1", 1);
        });

        it("shouldn't queue events", function(done) {
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: "AAA",
            });
            httpBackend.when("PUT", "/txn2").respond(200, {
                event_id: "BBB",
            });
            let sentA = false;
            let sentB = false;
            client.sendTextMessage("!foo:bar", "a body", "txn1").then(function(res) {
                sentA = true;
                expect(sentB).toBe(true);
            });
            client.sendTextMessage("!foo:bar", "b body", "txn2").then(function(res) {
                sentB = true;
                expect(sentA).toBe(false);
            });
            httpBackend.flush("/txn2", 1).then(function() {
                httpBackend.flush("/txn1", 1).then(function() {
                    done();
                });
            });
        });

        it("should be able to send messages", function(done) {
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: "foo",
            });
            client.sendTextMessage("!foo:bar", "a body", "txn1").then(function(res) {
                expect(res.event_id).toEqual("foo");
                done();
            });
            httpBackend.flush("/txn1", 1);
        });
    });
});
