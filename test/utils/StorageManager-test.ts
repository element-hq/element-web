/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
import { IndexedDBCryptoStore } from "matrix-js-sdk/src/matrix";

import * as StorageManager from "../../src/utils/StorageManager";
import SettingsStore from "../../src/settings/SettingsStore";

const LEGACY_CRYPTO_STORE_NAME = "matrix-js-sdk:crypto";
const RUST_CRYPTO_STORE_NAME = "matrix-js-sdk::matrix-sdk-crypto";

describe("StorageManager", () => {
    async function createDB(name: string, withStores: string[] | undefined = undefined): Promise<IDBDatabase> {
        const request = indexedDB.open(name);
        return new Promise((resolve, reject) => {
            request.onupgradeneeded = function (event) {
                const db = request.result;
                if (withStores) {
                    withStores.forEach((storeName) => {
                        db.createObjectStore(storeName);
                    });
                }
            };
            request.onsuccess = function (event) {
                const db = request.result;
                resolve(db);
            };
            request.onerror = function (event) {
                reject(event);
            };
        });
    }

    async function populateLegacyStore(migrationState: number | undefined) {
        const db = await createDB(LEGACY_CRYPTO_STORE_NAME, [IndexedDBCryptoStore.STORE_ACCOUNT]);

        if (migrationState) {
            const transaction = db.transaction([IndexedDBCryptoStore.STORE_ACCOUNT], "readwrite");
            const store = transaction.objectStore(IndexedDBCryptoStore.STORE_ACCOUNT);
            store.put(migrationState, "migrationState");
            await new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        }
    }

    beforeEach(() => {
        global.structuredClone = (v) => JSON.parse(JSON.stringify(v));
    });

    describe("Crypto store checks", () => {
        async function populateHealthySession() {
            // Storage manager only check for the existence of the `riot-web-sync` store, so just create one.
            await createDB("riot-web-sync");
        }

        beforeEach(async () => {
            await populateHealthySession();
            // eslint-disable-next-line no-global-assign
            indexedDB = new IDBFactory();
        });

        describe("with `feature_rust_crypto` enabled", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation(async (key) => {
                    if (key === "feature_rust_crypto") {
                        return true;
                    }
                    throw new Error(`Unknown key ${key}`);
                });
            });

            it("should not be ok if sync store but no crypto store", async () => {
                const result = await StorageManager.checkConsistency();
                expect(result.healthy).toBe(true);
                expect(result.dataInCryptoStore).toBe(false);
            });

            it("should be ok if sync store and a rust crypto store", async () => {
                await createDB(RUST_CRYPTO_STORE_NAME);

                const result = await StorageManager.checkConsistency();
                expect(result.healthy).toBe(true);
                expect(result.dataInCryptoStore).toBe(true);
            });

            describe("without rust store", () => {
                it("should be ok if there is non migrated legacy crypto store", async () => {
                    await populateLegacyStore(undefined);

                    const result = await StorageManager.checkConsistency();
                    expect(result.healthy).toBe(true);
                    expect(result.dataInCryptoStore).toBe(true);
                });

                it("should be ok if legacy store in MigrationState `NOT_STARTED`", async () => {
                    await populateLegacyStore(0 /* MigrationState.NOT_STARTED*/);

                    const result = await StorageManager.checkConsistency();
                    expect(result.healthy).toBe(true);
                    expect(result.dataInCryptoStore).toBe(true);
                });

                it("should not be ok if MigrationState greater than `NOT_STARTED`", async () => {
                    await populateLegacyStore(1 /*INITIAL_DATA_MIGRATED*/);

                    const result = await StorageManager.checkConsistency();
                    expect(result.healthy).toBe(true);
                    expect(result.dataInCryptoStore).toBe(false);
                });

                it("should not be healthy if no indexeddb", async () => {
                    // eslint-disable-next-line no-global-assign
                    indexedDB = {} as IDBFactory;

                    const result = await StorageManager.checkConsistency();
                    expect(result.healthy).toBe(false);

                    // eslint-disable-next-line no-global-assign
                    indexedDB = new IDBFactory();
                });
            });
        });

        describe("with `feature_rust_crypto` disabled", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockImplementation(async (key) => {
                    if (key === "feature_rust_crypto") {
                        return false;
                    }
                    throw new Error(`Unknown key ${key}`);
                });
            });

            it("should not be ok if sync store but no crypto store", async () => {
                const result = await StorageManager.checkConsistency();
                expect(result.healthy).toBe(true);
                expect(result.dataInCryptoStore).toBe(false);
            });

            it("should not be ok if sync store but no crypto store and a rust store", async () => {
                await createDB(RUST_CRYPTO_STORE_NAME);

                const result = await StorageManager.checkConsistency();
                expect(result.healthy).toBe(true);
                expect(result.dataInCryptoStore).toBe(false);
            });

            it("should be healthy if sync store and a legacy crypto store", async () => {
                await createDB(LEGACY_CRYPTO_STORE_NAME);

                const result = await StorageManager.checkConsistency();
                expect(result.healthy).toBe(true);
                expect(result.dataInCryptoStore).toBe(true);
            });
        });
    });
});
