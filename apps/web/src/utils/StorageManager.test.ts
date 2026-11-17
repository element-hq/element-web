/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import "fake-indexeddb/auto";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { logger } from "matrix-js-sdk/src/logger";

import * as StorageManager from "./StorageManager";

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
            indexedDB = new IDBFactory();
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

        it("should not be ok if a legacy crypto store is the only crypto store", async () => {
            await createDB(LEGACY_CRYPTO_STORE_NAME);

            const result = await StorageManager.checkConsistency();
            expect(result.healthy).toBe(true);
            expect(result.dataInCryptoStore).toBe(false);
        });

        it("should not be healthy if no indexeddb", async () => {
            indexedDB = {} as IDBFactory;

            const result = await StorageManager.checkConsistency();
            expect(result.healthy).toBe(false);

            indexedDB = new IDBFactory();
        });
    });

    describe("hasUnmigratedLegacyCryptoStore", () => {
        beforeEach(() => {
            indexedDB = new IDBFactory();
        });

        it("should be false when there are no crypto stores", async () => {
            await expect(StorageManager.hasUnmigratedLegacyCryptoStore()).resolves.toBe(false);
        });

        it("should be false when there is only a rust crypto store", async () => {
            await createDB(RUST_CRYPTO_STORE_NAME);

            await expect(StorageManager.hasUnmigratedLegacyCryptoStore()).resolves.toBe(false);
        });

        it("should be true when there is only a legacy crypto store", async () => {
            await createDB(LEGACY_CRYPTO_STORE_NAME);

            await expect(StorageManager.hasUnmigratedLegacyCryptoStore()).resolves.toBe(true);
        });

        it("should be false when a migrated session has both stores", async () => {
            await createDB(LEGACY_CRYPTO_STORE_NAME);
            await createDB(RUST_CRYPTO_STORE_NAME);

            await expect(StorageManager.hasUnmigratedLegacyCryptoStore()).resolves.toBe(false);
        });

        it("should be false if indexeddb is inaccessible", async () => {
            vi.spyOn(logger, "error").mockImplementation(() => {});
            indexedDB = {} as IDBFactory;

            await expect(StorageManager.hasUnmigratedLegacyCryptoStore()).resolves.toBe(false);

            indexedDB = new IDBFactory();
            vi.restoreAllMocks();
        });
    });

    describe("tryPersistStorage", () => {
        // node/happy-dom do not implement navigator.storage, so stub it per-test; vi.replaceProperty (aka
        // jest.replaceProperty) cannot be used as it refuses to replace a property that does not exist.
        function setStorage(value: unknown): void {
            Object.defineProperty(navigator, "storage", { value, configurable: true });
        }

        beforeEach(() => {
            vi.spyOn(logger, "log").mockImplementation(() => {});
            vi.spyOn(logger, "warn").mockImplementation(() => {});
            vi.spyOn(logger, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            delete (navigator as unknown as { storage?: unknown }).storage;
            vi.restoreAllMocks();
        });

        it("returns true and does not re-request when storage is already persisted", async () => {
            const persist = vi.fn().mockResolvedValue(true);
            const persisted = vi.fn().mockResolvedValue(true);
            setStorage({ persist, persisted });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(true);
            expect(persisted).toHaveBeenCalled();
            expect(persist).not.toHaveBeenCalled();
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it("requests persistence and returns true when granted", async () => {
            const persist = vi.fn().mockResolvedValue(true);
            const persisted = vi.fn().mockResolvedValue(false);
            setStorage({ persist, persisted });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(true);
            expect(persist).toHaveBeenCalled();
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it("requests persistence directly when persisted() is unavailable", async () => {
            const persist = vi.fn().mockResolvedValue(true);
            setStorage({ persist });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(true);
            expect(persist).toHaveBeenCalledTimes(1);
        });

        it("still requests persistence and logs the failure when querying the persisted state fails", async () => {
            const queryError = new Error("query failed");
            const persisted = vi.fn().mockRejectedValue(queryError);
            const persist = vi.fn().mockResolvedValue(true);
            setStorage({ persist, persisted });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(true);
            expect(persist).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Could not query"), queryError);
        });

        it("returns false and warns when persistence is denied", async () => {
            const persist = vi.fn().mockResolvedValue(false);
            const persisted = vi.fn().mockResolvedValue(false);
            setStorage({ persist, persisted });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Persistent storage"));
        });

        it("returns false when navigator.storage lacks persist()", async () => {
            setStorage({ persisted: vi.fn().mockResolvedValue(false) });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(false);
            expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("unsupported"));
        });

        it("returns false without throwing when persistence is unsupported", async () => {
            await expect(StorageManager.tryPersistStorage()).resolves.toBe(false);
        });

        it("does not reject but logs an error if requesting persistence throws", async () => {
            const persist = vi.fn().mockRejectedValue(new Error("boom"));
            const persisted = vi.fn().mockResolvedValue(false);
            setStorage({ persist, persisted });

            await expect(StorageManager.tryPersistStorage()).resolves.toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
