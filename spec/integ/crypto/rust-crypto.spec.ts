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

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { createClient } from "../../../src";

afterEach(() => {
    // reset fake-indexeddb after each test, to make sure we don't leak connections
    // cf https://github.com/dumbmatter/fakeIndexedDB#wipingresetting-the-indexeddb-for-a-fresh-state
    // eslint-disable-next-line no-global-assign
    indexedDB = new IDBFactory();
});

describe("MatrixClient.initRustCrypto", () => {
    it("should raise if userId or deviceId is unknown", async () => {
        const unknownUserClient = createClient({
            baseUrl: "http://test.server",
            deviceId: "aliceDevice",
        });
        await expect(() => unknownUserClient.initRustCrypto()).rejects.toThrow("unknown userId");

        const unknownDeviceClient = createClient({
            baseUrl: "http://test.server",
            userId: "@alice:test",
        });
        await expect(() => unknownDeviceClient.initRustCrypto()).rejects.toThrow("unknown deviceId");
    });

    it("should create the indexed dbs", async () => {
        const matrixClient = createClient({
            baseUrl: "http://test.server",
            userId: "@alice:localhost",
            deviceId: "aliceDevice",
        });

        // No databases.
        expect(await indexedDB.databases()).toHaveLength(0);

        await matrixClient.initRustCrypto();

        // should have two dbs now
        const databaseNames = (await indexedDB.databases()).map((db) => db.name);
        expect(databaseNames).toEqual(
            expect.arrayContaining(["matrix-js-sdk::matrix-sdk-crypto", "matrix-js-sdk::matrix-sdk-crypto-meta"]),
        );
    });

    it("should ignore a second call", async () => {
        const matrixClient = createClient({
            baseUrl: "http://test.server",
            userId: "@alice:localhost",
            deviceId: "aliceDevice",
        });

        await matrixClient.initRustCrypto();
        await matrixClient.initRustCrypto();
    });
});

describe("MatrixClient.clearStores", () => {
    it("should clear the indexeddbs", async () => {
        const matrixClient = createClient({
            baseUrl: "http://test.server",
            userId: "@alice:localhost",
            deviceId: "aliceDevice",
        });

        await matrixClient.initRustCrypto();
        expect(await indexedDB.databases()).toHaveLength(2);
        await matrixClient.stopClient();

        await matrixClient.clearStores();
        expect(await indexedDB.databases()).toHaveLength(0);
    });
});
