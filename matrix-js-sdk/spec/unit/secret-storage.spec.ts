/*
Copyright 2019, 2022-2023 The Matrix.org Foundation C.I.C.

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

import { Mocked } from "jest-mock";

import {
    AccountDataClient,
    PassphraseInfo,
    SecretStorageCallbacks,
    SecretStorageKeyDescriptionAesV1,
    SecretStorageKeyDescriptionCommon,
    ServerSideSecretStorageImpl,
    trimTrailingEquals,
} from "../../src/secret-storage";
import { calculateKeyCheck } from "../../src/crypto/aes";
import { randomString } from "../../src/randomstring";

describe("ServerSideSecretStorageImpl", function () {
    describe(".addKey", function () {
        it("should allow storing a default key", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            const result = await secretStorage.addKey("m.secret_storage.v1.aes-hmac-sha2");

            // it should have made up a 32-character key id
            expect(result.keyId.length).toEqual(32);
            expect(accountDataAdapter.setAccountData).toHaveBeenCalledWith(
                `m.secret_storage.key.${result.keyId}`,
                result.keyInfo,
            );
        });

        it("should allow storing a key with an explicit id", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            const result = await secretStorage.addKey("m.secret_storage.v1.aes-hmac-sha2", {}, "myKeyId");

            // it should have made up a 32-character key id
            expect(result.keyId).toEqual("myKeyId");
            expect(accountDataAdapter.setAccountData).toHaveBeenCalledWith(
                "m.secret_storage.key.myKeyId",
                result.keyInfo,
            );
        });

        it("should allow storing a key with a name", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            const result = await secretStorage.addKey("m.secret_storage.v1.aes-hmac-sha2", { name: "mykey" });

            expect(result.keyInfo.name).toEqual("mykey");

            expect(accountDataAdapter.setAccountData).toHaveBeenCalledWith(
                `m.secret_storage.key.${result.keyId}`,
                result.keyInfo,
            );
        });

        it("should allow storing a key with a passphrase", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            const passphrase: PassphraseInfo = {
                algorithm: "m.pbkdf2",
                iterations: 125,
                salt: "saltygoodness",
                bits: 256,
            };
            const result = await secretStorage.addKey("m.secret_storage.v1.aes-hmac-sha2", {
                passphrase,
            });

            expect(result.keyInfo.passphrase).toEqual(passphrase);

            expect(accountDataAdapter.setAccountData).toHaveBeenCalledWith(
                `m.secret_storage.key.${result.keyId}`,
                result.keyInfo,
            );
        });

        it("should complain about invalid algorithm", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            await expect(() => secretStorage.addKey("bad_alg")).rejects.toThrow("Unknown key algorithm");
        });
    });

    describe("getKey", function () {
        it("should return the specified key", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});

            const storedKey = { iv: "iv", mac: "mac" } as SecretStorageKeyDescriptionAesV1;
            async function mockGetAccountData<T extends Record<string, any>>(eventType: string): Promise<T | null> {
                if (eventType === "m.secret_storage.key.my_key") {
                    return storedKey as unknown as T;
                } else {
                    throw new Error(`unexpected eventType ${eventType}`);
                }
            }
            accountDataAdapter.getAccountDataFromServer.mockImplementation(mockGetAccountData);

            const result = await secretStorage.getKey("my_key");
            expect(result).toEqual(["my_key", storedKey]);
        });

        it("should return the default key if none is specified", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});

            const storedKey = { iv: "iv", mac: "mac" } as SecretStorageKeyDescriptionAesV1;
            async function mockGetAccountData<T extends Record<string, any>>(eventType: string): Promise<T | null> {
                if (eventType === "m.secret_storage.default_key") {
                    return { key: "default_key_id" } as unknown as T;
                } else if (eventType === "m.secret_storage.key.default_key_id") {
                    return storedKey as unknown as T;
                } else {
                    throw new Error(`unexpected eventType ${eventType}`);
                }
            }
            accountDataAdapter.getAccountDataFromServer.mockImplementation(mockGetAccountData);

            const result = await secretStorage.getKey();
            expect(result).toEqual(["default_key_id", storedKey]);
        });

        it("should return null if the key is not found", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, {});
            // @ts-ignore
            accountDataAdapter.getAccountDataFromServer.mockResolvedValue(null);

            const result = await secretStorage.getKey("my_key");
            expect(result).toEqual(null);
        });
    });

    describe("checkKey", function () {
        it("should return true for a correct key check", async function () {
            const secretStorage = new ServerSideSecretStorageImpl({} as AccountDataClient, {});

            const myKey = new TextEncoder().encode(randomString(32));
            const { iv, mac } = await calculateKeyCheck(myKey);

            const keyInfo: SecretStorageKeyDescriptionAesV1 = {
                name: "my key",
                passphrase: {} as PassphraseInfo,
                algorithm: "m.secret_storage.v1.aes-hmac-sha2",
                iv,
                mac,
            };

            const result = await secretStorage.checkKey(myKey, keyInfo);
            expect(result).toBe(true);
        });

        it("should return false for an incorrect key check", async function () {
            const secretStorage = new ServerSideSecretStorageImpl({} as AccountDataClient, {});

            const { iv, mac } = await calculateKeyCheck(new TextEncoder().encode("badkey"));

            const keyInfo: SecretStorageKeyDescriptionAesV1 = {
                name: "my key",
                passphrase: {} as PassphraseInfo,
                algorithm: "m.secret_storage.v1.aes-hmac-sha2",
                iv,
                mac,
            };

            const result = await secretStorage.checkKey(new TextEncoder().encode("goodkey"), keyInfo);
            expect(result).toBe(false);
        });

        it("should raise for an unknown algorithm", async function () {
            const secretStorage = new ServerSideSecretStorageImpl({} as AccountDataClient, {});
            const keyInfo: SecretStorageKeyDescriptionAesV1 = {
                name: "my key",
                passphrase: {} as PassphraseInfo,
                algorithm: "bad_alg",
                iv: "iv",
                mac: "mac",
            };

            await expect(() => secretStorage.checkKey(new TextEncoder().encode("goodkey"), keyInfo)).rejects.toThrow(
                "Unknown algorithm",
            );
        });

        // XXX: really???
        it("should return true for an absent mac", async function () {
            const secretStorage = new ServerSideSecretStorageImpl({} as AccountDataClient, {});
            const keyInfo: SecretStorageKeyDescriptionAesV1 = {
                name: "my key",
                passphrase: {} as PassphraseInfo,
                algorithm: "m.secret_storage.v1.aes-hmac-sha2",
                iv: "iv",
                mac: "",
            };

            const result = await secretStorage.checkKey(new TextEncoder().encode("goodkey"), keyInfo);
            expect(result).toBe(true);
        });
    });

    describe("store", () => {
        it("should ignore keys with unknown algorithm", async function () {
            const accountDataAdapter = mockAccountDataClient();
            const mockCallbacks = { getSecretStorageKey: jest.fn() } as Mocked<SecretStorageCallbacks>;
            const secretStorage = new ServerSideSecretStorageImpl(accountDataAdapter, mockCallbacks);

            // stub out getAccountData to return a key with an unknown algorithm
            const storedKey = { algorithm: "badalg" } as SecretStorageKeyDescriptionCommon;
            async function mockGetAccountData<T extends Record<string, any>>(eventType: string): Promise<T | null> {
                if (eventType === "m.secret_storage.key.keyid") {
                    return storedKey as unknown as T;
                } else {
                    throw new Error(`unexpected eventType ${eventType}`);
                }
            }
            accountDataAdapter.getAccountDataFromServer.mockImplementation(mockGetAccountData);

            // suppress the expected warning on the console
            jest.spyOn(console, "warn").mockImplementation();

            // now attempt the store
            await secretStorage.store("mysecret", "supersecret", ["keyid"]);

            // we should have stored... nothing
            expect(accountDataAdapter.setAccountData).toHaveBeenCalledWith("mysecret", { encrypted: {} });

            // ... and emitted a warning.
            // eslint-disable-next-line no-console
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("unknown algorithm"));
        });
    });
});

describe("trimTrailingEquals", () => {
    it("should strip trailing =", () => {
        expect(trimTrailingEquals("ab=c===")).toEqual("ab=c");
    });

    it("should leave strings without trailing = alone", () => {
        expect(trimTrailingEquals("ab=c")).toEqual("ab=c");
    });

    it("should leave the empty string alone", () => {
        const result = trimTrailingEquals("");
        expect(result).toEqual("");
    });
});

function mockAccountDataClient(): Mocked<AccountDataClient> {
    return {
        getAccountDataFromServer: jest.fn().mockResolvedValue(null),
        setAccountData: jest.fn().mockResolvedValue({}),
    } as unknown as Mocked<AccountDataClient>;
}
