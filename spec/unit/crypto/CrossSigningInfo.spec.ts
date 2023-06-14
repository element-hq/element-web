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

import "../../olm-loader";
import { CrossSigningInfo, createCryptoStoreCacheCallbacks } from "../../../src/crypto/CrossSigning";
import { IndexedDBCryptoStore } from "../../../src/crypto/store/indexeddb-crypto-store";
import { MemoryCryptoStore } from "../../../src/crypto/store/memory-crypto-store";
import "fake-indexeddb/auto";
import "jest-localstorage-mock";
import { OlmDevice } from "../../../src/crypto/OlmDevice";
import { logger } from "../../../src/logger";

const userId = "@alice:example.com";

// Private key for tests only
const testKey = new Uint8Array([
    0xda, 0x5a, 0x27, 0x60, 0xe3, 0x3a, 0xc5, 0x82, 0x9d, 0x12, 0xc3, 0xbe, 0xe8, 0xaa, 0xc2, 0xef, 0xae, 0xb1, 0x05,
    0xc1, 0xe7, 0x62, 0x78, 0xa6, 0xd7, 0x1f, 0xf8, 0x2c, 0x51, 0x85, 0xf0, 0x1d,
]);

const types = [
    { type: "master", shouldCache: true },
    { type: "self_signing", shouldCache: true },
    { type: "user_signing", shouldCache: true },
    { type: "invalid", shouldCache: false },
];

const badKey = Uint8Array.from(testKey);
badKey[0] ^= 1;

const masterKeyPub = "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk";

describe("CrossSigningInfo.getCrossSigningKey", function () {
    if (!global.Olm) {
        logger.warn("Not running megolm backup unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return global.Olm.init();
    });

    it("should throw if no callback is provided", async () => {
        const info = new CrossSigningInfo(userId);
        await expect(info.getCrossSigningKey("master")).rejects.toThrow();
    });

    it.each(types)("should throw if the callback returns falsey", async ({ type, shouldCache }) => {
        const info = new CrossSigningInfo(userId, {
            getCrossSigningKey: async () => false as unknown as Uint8Array,
        });
        await expect(info.getCrossSigningKey(type)).rejects.toThrow("falsey");
    });

    it("should throw if the expected key doesn't come back", async () => {
        const info = new CrossSigningInfo(userId, {
            getCrossSigningKey: async () => masterKeyPub as unknown as Uint8Array,
        });
        await expect(info.getCrossSigningKey("master", "")).rejects.toThrow();
    });

    it("should return a key from its callback", async () => {
        const info = new CrossSigningInfo(userId, {
            getCrossSigningKey: async () => testKey,
        });
        const [pubKey, pkSigning] = await info.getCrossSigningKey("master", masterKeyPub);
        expect(pubKey).toEqual(masterKeyPub);
        // check that the pkSigning object corresponds to the pubKey
        const signature = pkSigning.sign("message");
        const util = new global.Olm.Utility();
        try {
            util.ed25519_verify(pubKey, "message", signature);
        } finally {
            util.free();
        }
    });

    it.each(types)(
        "should request a key from the cache callback (if set)" + " and does not call app if one is found" + " %o",
        async ({ type, shouldCache }) => {
            const getCrossSigningKey = jest.fn().mockImplementation(() => {
                if (shouldCache) {
                    return Promise.reject(new Error("Regular callback called"));
                } else {
                    return Promise.resolve(testKey);
                }
            });
            const getCrossSigningKeyCache = jest.fn().mockResolvedValue(testKey);
            const info = new CrossSigningInfo(userId, { getCrossSigningKey }, { getCrossSigningKeyCache });
            const [pubKey] = await info.getCrossSigningKey(type, masterKeyPub);
            expect(pubKey).toEqual(masterKeyPub);
            expect(getCrossSigningKeyCache).toHaveBeenCalledTimes(shouldCache ? 1 : 0);
            if (shouldCache) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(getCrossSigningKeyCache).toHaveBeenLastCalledWith(type, expect.any(String));
            }
        },
    );

    it.each(types)("should store a key with the cache callback (if set)", async ({ type, shouldCache }) => {
        const getCrossSigningKey = jest.fn().mockResolvedValue(testKey);
        const storeCrossSigningKeyCache = jest.fn().mockResolvedValue(undefined);
        const info = new CrossSigningInfo(userId, { getCrossSigningKey }, { storeCrossSigningKeyCache });
        const [pubKey] = await info.getCrossSigningKey(type, masterKeyPub);
        expect(pubKey).toEqual(masterKeyPub);
        expect(storeCrossSigningKeyCache).toHaveBeenCalledTimes(shouldCache ? 1 : 0);
        if (shouldCache) {
            // eslint-disable-next-line jest/no-conditional-expect
            expect(storeCrossSigningKeyCache).toHaveBeenLastCalledWith(type, testKey);
        }
    });

    it.each(types)("does not store a bad key to the cache", async ({ type, shouldCache }) => {
        const getCrossSigningKey = jest.fn().mockResolvedValue(badKey);
        const storeCrossSigningKeyCache = jest.fn().mockResolvedValue(undefined);
        const info = new CrossSigningInfo(userId, { getCrossSigningKey }, { storeCrossSigningKeyCache });
        await expect(info.getCrossSigningKey(type, masterKeyPub)).rejects.toThrow();
        expect(storeCrossSigningKeyCache.mock.calls.length).toEqual(0);
    });

    it.each(types)("does not store a value to the cache if it came from the cache", async ({ type, shouldCache }) => {
        const getCrossSigningKey = jest.fn().mockImplementation(() => {
            if (shouldCache) {
                return Promise.reject(new Error("Regular callback called"));
            } else {
                return Promise.resolve(testKey);
            }
        });
        const getCrossSigningKeyCache = jest.fn().mockResolvedValue(testKey);
        const storeCrossSigningKeyCache = jest.fn().mockRejectedValue(new Error("Tried to store a value from cache"));
        const info = new CrossSigningInfo(
            userId,
            { getCrossSigningKey },
            { getCrossSigningKeyCache, storeCrossSigningKeyCache },
        );
        expect(storeCrossSigningKeyCache.mock.calls.length).toBe(0);
        const [pubKey] = await info.getCrossSigningKey(type, masterKeyPub);
        expect(pubKey).toEqual(masterKeyPub);
    });

    it.each(types)(
        "requests a key from the cache callback (if set) and then calls app" + " if one is not found",
        async ({ type, shouldCache }) => {
            const getCrossSigningKey = jest.fn().mockResolvedValue(testKey);
            const getCrossSigningKeyCache = jest.fn().mockResolvedValue(undefined);
            const storeCrossSigningKeyCache = jest.fn();
            const info = new CrossSigningInfo(
                userId,
                { getCrossSigningKey },
                { getCrossSigningKeyCache, storeCrossSigningKeyCache },
            );
            const [pubKey] = await info.getCrossSigningKey(type, masterKeyPub);
            expect(pubKey).toEqual(masterKeyPub);
            expect(getCrossSigningKey.mock.calls.length).toBe(1);
            expect(getCrossSigningKeyCache.mock.calls.length).toBe(shouldCache ? 1 : 0);

            /* Also expect that the cache gets updated */
            expect(storeCrossSigningKeyCache.mock.calls.length).toBe(shouldCache ? 1 : 0);
        },
    );

    it.each(types)(
        "requests a key from the cache callback (if set) and then" + " calls app if that key doesn't match",
        async ({ type, shouldCache }) => {
            const getCrossSigningKey = jest.fn().mockResolvedValue(testKey);
            const getCrossSigningKeyCache = jest.fn().mockResolvedValue(badKey);
            const storeCrossSigningKeyCache = jest.fn();
            const info = new CrossSigningInfo(
                userId,
                { getCrossSigningKey },
                { getCrossSigningKeyCache, storeCrossSigningKeyCache },
            );
            const [pubKey] = await info.getCrossSigningKey(type, masterKeyPub);
            expect(pubKey).toEqual(masterKeyPub);
            expect(getCrossSigningKey.mock.calls.length).toBe(1);
            expect(getCrossSigningKeyCache.mock.calls.length).toBe(shouldCache ? 1 : 0);

            /* Also expect that the cache gets updated */
            expect(storeCrossSigningKeyCache.mock.calls.length).toBe(shouldCache ? 1 : 0);
        },
    );
});

/*
 * Note that MemoryStore is weird.  It's only used for testing - as far as I can tell,
 * it's not possible to get one in normal execution unless you hack as we do here.
 */
describe.each([
    ["IndexedDBCryptoStore", () => new IndexedDBCryptoStore(global.indexedDB, "tests")],
    ["LocalStorageCryptoStore", () => new IndexedDBCryptoStore(undefined!, "tests")],
    [
        "MemoryCryptoStore",
        () => {
            const store = new IndexedDBCryptoStore(undefined!, "tests");
            // @ts-ignore set private properties
            store._backend = new MemoryCryptoStore();
            // @ts-ignore
            store._backendPromise = Promise.resolve(store._backend);
            return store;
        },
    ],
])("CrossSigning > createCryptoStoreCacheCallbacks [%s]", function (name, dbFactory) {
    let store: IndexedDBCryptoStore;

    beforeAll(() => {
        store = dbFactory();
    });

    beforeEach(async () => {
        await store.deleteAllData();
    });

    it("should cache data to the store and retrieve it", async () => {
        await store.startup();
        const olmDevice = new OlmDevice(store);
        const { getCrossSigningKeyCache, storeCrossSigningKeyCache } = createCryptoStoreCacheCallbacks(
            store,
            olmDevice,
        );
        await storeCrossSigningKeyCache!("self_signing", testKey);

        // If we've not saved anything, don't expect anything
        // Definitely don't accidentally return the wrong key for the type
        const nokey = await getCrossSigningKeyCache!("self", "");
        expect(nokey).toBeNull();

        const key = await getCrossSigningKeyCache!("self_signing", "");
        expect(new Uint8Array(key!)).toEqual(testKey);
    });
});
