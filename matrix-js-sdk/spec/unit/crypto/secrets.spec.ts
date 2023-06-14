/*
Copyright 2019, 2022 The Matrix.org Foundation C.I.C.

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
import * as olmlib from "../../../src/crypto/olmlib";
import { IObject } from "../../../src/crypto/olmlib";
import { MatrixEvent } from "../../../src/models/event";
import { TestClient } from "../../TestClient";
import { makeTestClients } from "./verification/util";
import { encryptAES } from "../../../src/crypto/aes";
import { createSecretStorageKey, resetCrossSigningKeys } from "./crypto-utils";
import { logger } from "../../../src/logger";
import { ClientEvent, ICreateClientOpts, ICrossSigningKey, MatrixClient } from "../../../src/client";
import { DeviceInfo } from "../../../src/crypto/deviceinfo";
import { ISignatures } from "../../../src/@types/signed";
import { ICurve25519AuthData } from "../../../src/crypto/keybackup";
import { SecretStorageKeyDescription, SECRET_STORAGE_ALGORITHM_V1_AES } from "../../../src/secret-storage";

async function makeTestClient(
    userInfo: { userId: string; deviceId: string },
    options: Partial<ICreateClientOpts> = {},
) {
    const client = new TestClient(userInfo.userId, userInfo.deviceId, undefined, undefined, options).client;

    // Make it seem as if we've synced and thus the store can be trusted to
    // contain valid account data.
    client.isInitialSyncComplete = function () {
        return true;
    };

    await client.initCrypto();

    // No need to download keys for these tests
    jest.spyOn(client.crypto!, "downloadKeys").mockResolvedValue(new Map());

    return client;
}

// Wrapper around pkSign to return a signed object. pkSign returns the
// signature, rather than the signed object.
function sign<T extends IObject | ICurve25519AuthData>(
    obj: T,
    key: Uint8Array,
    userId: string,
): T & {
    signatures: ISignatures;
    unsigned?: object;
} {
    olmlib.pkSign(obj, key, userId, "");
    return obj as T & {
        signatures: ISignatures;
        unsigned?: object;
    };
}

describe("Secrets", function () {
    if (!global.Olm) {
        logger.warn("Not running megolm backup unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return global.Olm.init();
    });

    it("should store and retrieve a secret", async function () {
        const key = new Uint8Array(16);
        for (let i = 0; i < 16; i++) key[i] = i;

        const signing = new global.Olm.PkSigning();
        const signingKey = signing.generate_seed();
        const signingPubKey = signing.init_with_seed(signingKey);

        const signingkeyInfo = {
            user_id: "@alice:example.com",
            usage: ["master"],
            keys: {
                ["ed25519:" + signingPubKey]: signingPubKey,
            },
        };

        const getKey = jest.fn().mockImplementation(async (e) => {
            expect(Object.keys(e.keys)).toEqual(["abc"]);
            return ["abc", key];
        });

        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    getCrossSigningKey: async (t) => signingKey,
                    getSecretStorageKey: getKey,
                },
            },
        );
        alice.crypto!.crossSigningInfo.setKeys({
            master: signingkeyInfo,
        });

        const secretStorage = alice.crypto!.secretStorage;

        jest.spyOn(alice, "setAccountData").mockImplementation(async function (eventType, contents) {
            alice.store.storeAccountDataEvents([
                new MatrixEvent({
                    type: eventType,
                    content: contents,
                }),
            ]);
            return {};
        });

        const keyAccountData = {
            algorithm: SECRET_STORAGE_ALGORITHM_V1_AES,
        };
        await alice.crypto!.crossSigningInfo.signObject(keyAccountData, "master");

        alice.store.storeAccountDataEvents([
            new MatrixEvent({
                type: "m.secret_storage.key.abc",
                content: keyAccountData,
            }),
        ]);

        expect(await secretStorage.isStored("foo")).toBeFalsy();

        await secretStorage.store("foo", "bar", ["abc"]);

        expect(await secretStorage.isStored("foo")).toBeTruthy();
        expect(await secretStorage.get("foo")).toBe("bar");

        expect(getKey).toHaveBeenCalled();
        alice.stopClient();
    });

    it("should throw if given a key that doesn't exist", async function () {
        const alice = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });

        await expect(alice.storeSecret("foo", "bar", ["this secret does not exist"])).rejects.toBeTruthy();
        alice.stopClient();
    });

    it("should refuse to encrypt with zero keys", async function () {
        const alice = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });

        await expect(alice.storeSecret("foo", "bar", [])).rejects.toBeTruthy();
        alice.stopClient();
    });

    it("should encrypt with default key if keys is null", async function () {
        const key = new Uint8Array(16);
        for (let i = 0; i < 16; i++) key[i] = i;
        const getKey = jest.fn().mockImplementation(async (e) => {
            expect(Object.keys(e.keys)).toEqual([newKeyId]);
            return [newKeyId, key];
        });

        let keys: Record<string, Uint8Array> = {};
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    getCrossSigningKey: (t) => Promise.resolve(keys[t]),
                    saveCrossSigningKeys: (k) => (keys = k),
                    getSecretStorageKey: getKey,
                },
            },
        );
        alice.setAccountData = async function (eventType, contents) {
            alice.store.storeAccountDataEvents([
                new MatrixEvent({
                    type: eventType,
                    content: contents,
                }),
            ]);
            return {};
        };
        resetCrossSigningKeys(alice);

        const { keyId: newKeyId } = await alice.addSecretStorageKey(SECRET_STORAGE_ALGORITHM_V1_AES, {
            pubkey: undefined,
            key: undefined,
        });
        // we don't await on this because it waits for the event to come down the sync
        // which won't happen in the test setup
        alice.setDefaultSecretStorageKeyId(newKeyId);
        await alice.storeSecret("foo", "bar");

        const accountData = alice.getAccountData("foo");
        expect(accountData!.getContent().encrypted).toBeTruthy();
        alice.stopClient();
    });

    it("should refuse to encrypt if no keys given and no default key", async function () {
        const alice = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });

        await expect(alice.storeSecret("foo", "bar")).rejects.toBeTruthy();
        alice.stopClient();
    });

    it("should request secrets from other clients", async function () {
        const [[osborne2, vax], clearTestClientTimeouts] = await makeTestClients(
            [
                { userId: "@alice:example.com", deviceId: "Osborne2" },
                { userId: "@alice:example.com", deviceId: "VAX" },
            ],
            {
                cryptoCallbacks: {
                    onSecretRequested: (userId, deviceId, requestId, secretName, deviceTrust) => {
                        expect(secretName).toBe("foo");
                        return Promise.resolve("bar");
                    },
                },
            },
        );

        const vaxDevice = vax.client.crypto!.olmDevice;
        const osborne2Device = osborne2.client.crypto!.olmDevice;
        const secretStorage = osborne2.client.crypto!.secretStorage;

        osborne2.client.crypto!.deviceList.storeDevicesForUser("@alice:example.com", {
            VAX: {
                known: false,
                algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
                keys: {
                    "ed25519:VAX": vaxDevice.deviceEd25519Key!,
                    "curve25519:VAX": vaxDevice.deviceCurve25519Key!,
                },
                verified: DeviceInfo.DeviceVerification.VERIFIED,
            },
        });
        vax.client.crypto!.deviceList.storeDevicesForUser("@alice:example.com", {
            Osborne2: {
                algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
                verified: 0,
                known: false,
                keys: {
                    "ed25519:Osborne2": osborne2Device.deviceEd25519Key!,
                    "curve25519:Osborne2": osborne2Device.deviceCurve25519Key!,
                },
            },
        });

        await osborne2Device.generateOneTimeKeys(1);
        const otks = (await osborne2Device.getOneTimeKeys()).curve25519;
        await osborne2Device.markKeysAsPublished();

        await vax.client.crypto!.olmDevice.createOutboundSession(
            osborne2Device.deviceCurve25519Key!,
            Object.values(otks)[0],
        );

        osborne2.client.crypto!.deviceList.downloadKeys = () => Promise.resolve(new Map());
        osborne2.client.crypto!.deviceList.getUserByIdentityKey = () => "@alice:example.com";

        const request = await secretStorage.request("foo", ["VAX"]);
        await request.promise; // return value not used

        osborne2.stop();
        vax.stop();
        clearTestClientTimeouts();
    });

    describe("bootstrap", function () {
        // keys used in some of the tests
        const XSK = new Uint8Array(olmlib.decodeBase64("3lo2YdJugHjfE+Or7KJ47NuKbhE7AAGLgQ/dc19913Q="));
        const XSPubKey = "DRb8pFVJyEJ9OWvXeUoM0jq/C2Wt+NxzBZVuk2nRb+0";
        const USK = new Uint8Array(olmlib.decodeBase64("lKWi3hJGUie5xxHgySoz8PHFnZv6wvNaud/p2shN9VU="));
        const USPubKey = "CUpoiTtHiyXpUmd+3ohb7JVxAlUaOG1NYs9Jlx8soQU";
        const SSK = new Uint8Array(olmlib.decodeBase64("1R6JVlXX99UcfUZzKuCDGQgJTw8ur1/ofgPD8pp+96M="));
        const SSPubKey = "0DfNsRDzEvkCLA0gD3m7VAGJ5VClhjEsewI35xq873Q";
        const SSSSKey = new Uint8Array(olmlib.decodeBase64("XrmITOOdBhw6yY5Bh7trb/bgp1FRdIGyCUxxMP873R0="));

        it("bootstraps when no storage or cross-signing keys locally", async function () {
            const key = new Uint8Array(16);
            for (let i = 0; i < 16; i++) key[i] = i;
            const getKey = jest.fn().mockImplementation(async (e) => {
                return [Object.keys(e.keys)[0], key];
            });

            const bob = await makeTestClient(
                {
                    userId: "@bob:example.com",
                    deviceId: "bob1",
                },
                {
                    cryptoCallbacks: {
                        getSecretStorageKey: getKey,
                    },
                },
            );
            bob.uploadDeviceSigningKeys = async () => ({});
            bob.uploadKeySignatures = jest.fn().mockResolvedValue(undefined);
            bob.setAccountData = async function (eventType, contents) {
                const event = new MatrixEvent({
                    type: eventType,
                    content: contents,
                });
                this.store.storeAccountDataEvents([event]);
                this.emit(ClientEvent.AccountData, event);
                return {};
            };

            await bob.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (func) => {
                    await func({});
                },
            });
            await bob.bootstrapSecretStorage({
                createSecretStorageKey,
            });

            const crossSigning = bob.crypto!.crossSigningInfo;
            const secretStorage = bob.crypto!.secretStorage;

            expect(crossSigning.getId()).toBeTruthy();
            expect(await crossSigning.isStoredInSecretStorage(secretStorage)).toBeTruthy();
            expect(await secretStorage.hasKey()).toBeTruthy();
            bob.stopClient();
        });

        it("bootstraps when cross-signing keys in secret storage", async function () {
            const decryption = new global.Olm.PkDecryption();
            const storagePublicKey = decryption.generate_key();
            const storagePrivateKey = decryption.get_private_key();

            const bob: MatrixClient = await makeTestClient(
                {
                    userId: "@bob:example.com",
                    deviceId: "bob1",
                },
                {
                    cryptoCallbacks: {
                        getSecretStorageKey: async (request) => {
                            const defaultKeyId = await bob.getDefaultSecretStorageKeyId();
                            expect(Object.keys(request.keys)).toEqual([defaultKeyId]);
                            return [defaultKeyId!, storagePrivateKey];
                        },
                    },
                },
            );

            bob.uploadDeviceSigningKeys = async () => ({});
            bob.uploadKeySignatures = async () => ({ failures: {} });
            bob.setAccountData = async function (eventType, contents) {
                const event = new MatrixEvent({
                    type: eventType,
                    content: contents,
                });
                this.store.storeAccountDataEvents([event]);
                this.emit(ClientEvent.AccountData, event);
                return {};
            };
            bob.crypto!.backupManager.checkKeyBackup = async () => null;

            const crossSigning = bob.crypto!.crossSigningInfo;
            const secretStorage = bob.crypto!.secretStorage;

            // Set up cross-signing keys from scratch with specific storage key
            await bob.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (func) => {
                    await func({});
                },
            });
            await bob.bootstrapSecretStorage({
                createSecretStorageKey: async () => ({
                    // `pubkey` not used anymore with symmetric 4S
                    keyInfo: { pubkey: storagePublicKey },
                    privateKey: storagePrivateKey,
                }),
            });

            // Clear local cross-signing keys and read from secret storage
            bob.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", crossSigning.toStorage());
            crossSigning.keys = {};
            await bob.bootstrapCrossSigning({
                authUploadDeviceSigningKeys: async (func) => {
                    await func({});
                },
            });

            expect(crossSigning.getId()).toBeTruthy();
            expect(await crossSigning.isStoredInSecretStorage(secretStorage)).toBeTruthy();
            expect(await secretStorage.hasKey()).toBeTruthy();
            bob.stopClient();
        });

        it("adds passphrase checking if it's lacking", async function () {
            let crossSigningKeys: Record<string, Uint8Array> = {
                master: XSK,
                user_signing: USK,
                self_signing: SSK,
            };
            const secretStorageKeys: Record<string, Uint8Array> = {
                key_id: SSSSKey,
            };
            const alice = await makeTestClient(
                { userId: "@alice:example.com", deviceId: "Osborne2" },
                {
                    cryptoCallbacks: {
                        getCrossSigningKey: async (t) => crossSigningKeys[t],
                        saveCrossSigningKeys: (k) => (crossSigningKeys = k),
                        getSecretStorageKey: async ({ keys }, name) => {
                            for (const keyId of Object.keys(keys)) {
                                if (secretStorageKeys[keyId]) {
                                    return [keyId, secretStorageKeys[keyId]];
                                }
                            }
                            return null;
                        },
                    },
                },
            );
            alice.store.storeAccountDataEvents([
                new MatrixEvent({
                    type: "m.secret_storage.default_key",
                    content: {
                        key: "key_id",
                    },
                }),
                new MatrixEvent({
                    type: "m.secret_storage.key.key_id",
                    content: {
                        algorithm: "m.secret_storage.v1.aes-hmac-sha2",
                        passphrase: {
                            algorithm: "m.pbkdf2",
                            iterations: 500000,
                            salt: "GbkvwKHVMveo1zGVSb2GMMdCinG2npJK",
                        },
                    },
                }),
                // we never use these values, other than checking that they
                // exist, so just use dummy values
                new MatrixEvent({
                    type: "m.cross_signing.master",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.cross_signing.self_signing",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.cross_signing.user_signing",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
            ]);
            alice.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
                firstUse: false,
                crossSigningVerifiedBefore: false,
                keys: {
                    master: {
                        user_id: "@alice:example.com",
                        usage: ["master"],
                        keys: {
                            [`ed25519:${XSPubKey}`]: XSPubKey,
                        },
                    },
                    self_signing: sign<ICrossSigningKey>(
                        {
                            user_id: "@alice:example.com",
                            usage: ["self_signing"],
                            keys: {
                                [`ed25519:${SSPubKey}`]: SSPubKey,
                            },
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                    user_signing: sign<ICrossSigningKey>(
                        {
                            user_id: "@alice:example.com",
                            usage: ["user_signing"],
                            keys: {
                                [`ed25519:${USPubKey}`]: USPubKey,
                            },
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                },
            });
            alice.getKeyBackupVersion = async () => {
                return {
                    version: "1",
                    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
                    auth_data: sign(
                        {
                            public_key: "pxEXhg+4vdMf/kFwP4bVawFWdb0EmytL3eFJx++zQ0A",
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                };
            };
            alice.setAccountData = async function (name, data) {
                const event = new MatrixEvent({
                    type: name,
                    content: data,
                });
                alice.store.storeAccountDataEvents([event]);
                this.emit(ClientEvent.AccountData, event);
                return {};
            };

            await alice.bootstrapSecretStorage({});

            expect(alice.getAccountData("m.secret_storage.default_key")!.getContent()).toEqual({ key: "key_id" });
            const keyInfo = alice
                .getAccountData("m.secret_storage.key.key_id")!
                .getContent<SecretStorageKeyDescription>();
            expect(keyInfo.algorithm).toEqual("m.secret_storage.v1.aes-hmac-sha2");
            expect(keyInfo.passphrase).toEqual({
                algorithm: "m.pbkdf2",
                iterations: 500000,
                salt: "GbkvwKHVMveo1zGVSb2GMMdCinG2npJK",
            });
            expect(keyInfo).toHaveProperty("iv");
            expect(keyInfo).toHaveProperty("mac");
            expect(alice.checkSecretStorageKey(secretStorageKeys.key_id, keyInfo)).toBeTruthy();
            alice.stopClient();
        });
        it("fixes backup keys in the wrong format", async function () {
            let crossSigningKeys: Record<string, Uint8Array> = {
                master: XSK,
                user_signing: USK,
                self_signing: SSK,
            };
            const secretStorageKeys: Record<string, Uint8Array> = {
                key_id: SSSSKey,
            };
            const alice = await makeTestClient(
                { userId: "@alice:example.com", deviceId: "Osborne2" },
                {
                    cryptoCallbacks: {
                        getCrossSigningKey: async (t) => crossSigningKeys[t],
                        saveCrossSigningKeys: (k) => (crossSigningKeys = k),
                        getSecretStorageKey: async ({ keys }, name) => {
                            for (const keyId of Object.keys(keys)) {
                                if (secretStorageKeys[keyId]) {
                                    return [keyId, secretStorageKeys[keyId]];
                                }
                            }
                            return null;
                        },
                    },
                },
            );
            alice.store.storeAccountDataEvents([
                new MatrixEvent({
                    type: "m.secret_storage.default_key",
                    content: {
                        key: "key_id",
                    },
                }),
                new MatrixEvent({
                    type: "m.secret_storage.key.key_id",
                    content: {
                        algorithm: "m.secret_storage.v1.aes-hmac-sha2",
                        passphrase: {
                            algorithm: "m.pbkdf2",
                            iterations: 500000,
                            salt: "GbkvwKHVMveo1zGVSb2GMMdCinG2npJK",
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.cross_signing.master",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.cross_signing.self_signing",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.cross_signing.user_signing",
                    content: {
                        encrypted: {
                            key_id: { ciphertext: "bla", mac: "bla", iv: "bla" },
                        },
                    },
                }),
                new MatrixEvent({
                    type: "m.megolm_backup.v1",
                    content: {
                        encrypted: {
                            key_id: await encryptAES(
                                "123,45,6,7,89,1,234,56,78,90,12,34,5,67,8,90",
                                secretStorageKeys.key_id,
                                "m.megolm_backup.v1",
                            ),
                        },
                    },
                }),
            ]);
            alice.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
                firstUse: false,
                crossSigningVerifiedBefore: false,
                keys: {
                    master: {
                        user_id: "@alice:example.com",
                        usage: ["master"],
                        keys: {
                            [`ed25519:${XSPubKey}`]: XSPubKey,
                        },
                    },
                    self_signing: sign<ICrossSigningKey>(
                        {
                            user_id: "@alice:example.com",
                            usage: ["self_signing"],
                            keys: {
                                [`ed25519:${SSPubKey}`]: SSPubKey,
                            },
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                    user_signing: sign<ICrossSigningKey>(
                        {
                            user_id: "@alice:example.com",
                            usage: ["user_signing"],
                            keys: {
                                [`ed25519:${USPubKey}`]: USPubKey,
                            },
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                },
            });
            alice.getKeyBackupVersion = async () => {
                return {
                    version: "1",
                    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
                    auth_data: sign(
                        {
                            public_key: "pxEXhg+4vdMf/kFwP4bVawFWdb0EmytL3eFJx++zQ0A",
                        },
                        XSK,
                        "@alice:example.com",
                    ),
                };
            };
            alice.setAccountData = async function (name, data) {
                const event = new MatrixEvent({
                    type: name,
                    content: data,
                });
                alice.store.storeAccountDataEvents([event]);
                this.emit(ClientEvent.AccountData, event);
                return {};
            };

            await alice.bootstrapSecretStorage({});

            const backupKey = alice.getAccountData("m.megolm_backup.v1")!.getContent();
            expect(backupKey.encrypted).toHaveProperty("key_id");
            expect(await alice.getSecret("m.megolm_backup.v1")).toEqual("ey0GB1kB6jhOWgwiBUMIWg==");
            alice.stopClient();
        });
    });
});
