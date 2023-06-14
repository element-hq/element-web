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

import { EventStatus, RoomEvent, MatrixClient, MatrixScheduler } from "../../src/matrix";
import { Room } from "../../src/models/room";
import { TestClient } from "../TestClient";

describe("MatrixClient retrying", function () {
    const userId = "@alice:localhost";
    const accessToken = "aseukfgwef";
    const roomId = "!room:here";
    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;
    let room: Room | undefined;

    const setupTests = (): [MatrixClient, HttpBackend, Room] => {
        const scheduler = new MatrixScheduler();
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { scheduler });
        const httpBackend = testClient.httpBackend;
        const client = testClient.client;
        const room = new Room(roomId, client, userId);
        client!.store.storeRoom(room);

        return [client, httpBackend, room];
    };

    beforeEach(function () {
        [client, httpBackend, room] = setupTests();
    });

    afterEach(function () {
        httpBackend!.verifyNoOutstandingExpectation();
        return httpBackend!.stop();
    });

    it.skip("should retry according to MatrixScheduler.retryFn", function () {});

    it.skip("should queue according to MatrixScheduler.queueFn", function () {});

    it.skip("should mark events as EventStatus.NOT_SENT when giving up", function () {});

    it.skip("should mark events as EventStatus.QUEUED when queued", function () {});

    it("should mark events as EventStatus.CANCELLED when cancelled", function () {
        // send a couple of events; the second will be queued
        const p1 = client!
            .sendMessage(roomId, {
                msgtype: "m.text",
                body: "m1",
            })
            .then(
                function () {
                    // we expect the first message to fail
                    throw new Error("Message 1 unexpectedly sent successfully");
                },
                () => {
                    // this is expected
                },
            );

        // XXX: it turns out that the promise returned by this message
        // never gets resolved.
        // https://github.com/matrix-org/matrix-js-sdk/issues/496
        client!.sendMessage(roomId, {
            msgtype: "m.text",
            body: "m2",
        });

        // both events should be in the timeline at this point
        const tl = room!.getLiveTimeline().getEvents();
        expect(tl.length).toEqual(2);
        const ev1 = tl[0];
        const ev2 = tl[1];

        expect(ev1.status).toEqual(EventStatus.SENDING);
        expect(ev2.status).toEqual(EventStatus.SENDING);

        // the first message should get sent, and the second should get queued
        httpBackend!
            .when("PUT", "/send/m.room.message/")
            .check(function () {
                // ev2 should now have been queued
                expect(ev2.status).toEqual(EventStatus.QUEUED);

                // now we can cancel the second and check everything looks sane
                client!.cancelPendingEvent(ev2);
                expect(ev2.status).toEqual(EventStatus.CANCELLED);
                expect(tl.length).toEqual(1);

                // shouldn't be able to cancel the first message yet
                expect(function () {
                    client!.cancelPendingEvent(ev1);
                }).toThrow();
            })
            .respond(400); // fail the first message

        // wait for the localecho of ev1 to be updated
        const p3 = new Promise<void>((resolve, reject) => {
            room!.on(RoomEvent.LocalEchoUpdated, (ev0) => {
                if (ev0 === ev1) {
                    resolve();
                }
            });
        }).then(function () {
            expect(ev1.status).toEqual(EventStatus.NOT_SENT);
            expect(tl.length).toEqual(1);

            // cancel the first message
            client!.cancelPendingEvent(ev1);
            expect(ev1.status).toEqual(EventStatus.CANCELLED);
            expect(tl.length).toEqual(0);
        });

        return Promise.all([p1, p3, httpBackend!.flushAllExpected()]);
    });

    describe("resending", function () {
        it.skip("should be able to resend a NOT_SENT event", function () {});
        it.skip("should be able to resend a sent event", function () {});
    });
});
