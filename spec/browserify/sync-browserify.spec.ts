/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import "./setupTests"; // uses browser-matrix instead of the src
import type { MatrixClient } from "../../src";

const USER_ID = "@user:test.server";
const DEVICE_ID = "device_id";
const ACCESS_TOKEN = "access_token";
const ROOM_ID = "!room_id:server.test";

describe("Browserify Test", function () {
    let client: MatrixClient;
    let httpBackend: HttpBackend;

    beforeEach(() => {
        httpBackend = new HttpBackend();
        client = new global.matrixcs.MatrixClient({
            baseUrl: "http://test.server",
            userId: USER_ID,
            accessToken: ACCESS_TOKEN,
            deviceId: DEVICE_ID,
            fetchFn: httpBackend.fetchFn as typeof global.fetch,
        });

        httpBackend.when("GET", "/versions").respond(200, {});
        httpBackend.when("GET", "/pushrules").respond(200, {});
        httpBackend.when("POST", "/filter").respond(200, { filter_id: "fid" });
    });

    afterEach(async () => {
        client.stopClient();
        client.http.abort();
        httpBackend.verifyNoOutstandingRequests();
        httpBackend.verifyNoOutstandingExpectation();
        await httpBackend.stop();
    });

    it("Sync", async () => {
        const event = {
            type: "m.room.member",
            room_id: ROOM_ID,
            content: {
                membership: "join",
                name: "Displayname",
            },
            event_id: "$foobar",
        };

        const syncData = {
            next_batch: "batch1",
            rooms: {
                join: {
                    [ROOM_ID]: {
                        timeline: {
                            events: [event],
                            limited: false,
                        },
                    },
                },
            },
        };

        httpBackend.when("GET", "/sync").respond(200, syncData);
        httpBackend.when("GET", "/sync").respond(200, syncData);

        const syncPromise = new Promise((r) => client.once(global.matrixcs.ClientEvent.Sync, r));
        const unexpectedErrorFn = jest.fn();
        client.once(global.matrixcs.ClientEvent.SyncUnexpectedError, unexpectedErrorFn);

        client.startClient();

        await httpBackend.flushAllExpected();
        await syncPromise;
        expect(unexpectedErrorFn).not.toHaveBeenCalled();
    }, 20000); // additional timeout as this test can take quite a while
});
