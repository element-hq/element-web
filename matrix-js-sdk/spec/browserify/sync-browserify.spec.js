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

// load XmlHttpRequest mock
import "./setupTests";
import "../../dist/browser-matrix"; // uses browser-matrix instead of the src
import MockHttpBackend from "matrix-mock-request";

import { MockStorageApi } from "../MockStorageApi";
import { WebStorageSessionStore } from "../../src/store/session/webstorage";
import { LocalStorageCryptoStore } from "../../src/crypto/store/localStorage-crypto-store";
import * as utils from "../test-utils";

const USER_ID = "@user:test.server";
const DEVICE_ID = "device_id";
const ACCESS_TOKEN = "access_token";
const ROOM_ID = "!room_id:server.test";

/* global matrixcs */

describe("Browserify Test", function() {
    let client;
    let httpBackend;

    async function createTestClient() {
        const sessionStoreBackend = new MockStorageApi();
        const sessionStore = new WebStorageSessionStore(sessionStoreBackend);
        const httpBackend = new MockHttpBackend();

        const options = {
            baseUrl: "http://" + USER_ID + ".test.server",
            userId: USER_ID,
            accessToken: ACCESS_TOKEN,
            deviceId: DEVICE_ID,
            sessionStore: sessionStore,
            request: httpBackend.requestFn,
            cryptoStore: new LocalStorageCryptoStore(sessionStoreBackend),
        };

        const client = matrixcs.createClient(options);

        httpBackend.when("GET", "/pushrules").respond(200, {});
        httpBackend.when("POST", "/filter").respond(200, { filter_id: "fid" });

        return { client, httpBackend };
    }

    beforeEach(async () => {
        ({ client, httpBackend } = await createTestClient());
        await client.startClient();
    });

    afterEach(async () => {
        client.stopClient();
        await httpBackend.stop();
    });

    it("Sync", async function() {
        const event = utils.mkMembership({
            room: ROOM_ID,
            mship: "join",
            user: "@other_user:server.test",
            name: "Displayname",
        });

        const syncData = {
            next_batch: "batch1",
            rooms: {
                join: {},
            },
        };
        syncData.rooms.join[ROOM_ID] = {
            timeline: {
                events: [
                    event,
                ],
                limited: false,
            },
        };

        httpBackend.when("GET", "/sync").respond(200, syncData);
        await Promise.race([
            Promise.all([
                httpBackend.flushAllExpected(),
            ]),
            new Promise((_, reject) => {
                client.once("sync.unexpectedError", reject);
            }),
        ]);
    }, 20000); // additional timeout as this test can take quite a while
});
