/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import anotherjson from "another-json";
import { PkSigning } from "@matrix-org/olm";
import HttpBackend from "matrix-mock-request";

import * as olmlib from "../../../src/crypto/olmlib";
import { MatrixError } from "../../../src/http-api";
import { logger } from "../../../src/logger";
import { ICrossSigningKey, ICreateClientOpts, ISignedKey, MatrixClient } from "../../../src/client";
import { CryptoEvent } from "../../../src/crypto";
import { IDevice } from "../../../src/crypto/deviceinfo";
import { TestClient } from "../../TestClient";
import { resetCrossSigningKeys } from "./crypto-utils";
import { BootstrapCrossSigningOpts } from "../../../src/crypto-api";

const PUSH_RULES_RESPONSE: Response = {
    method: "GET",
    path: "/pushrules/",
    data: {},
};

const filterResponse = function (userId: string): Response {
    const filterPath = "/user/" + encodeURIComponent(userId) + "/filter";
    return {
        method: "POST",
        path: filterPath,
        data: { filter_id: "f1lt3r" },
    };
};

interface Response {
    method: "GET" | "PUT" | "POST" | "DELETE";
    path: string;
    data: object;
}

function setHttpResponses(httpBackend: HttpBackend, responses: Response[]) {
    responses.forEach((response) => {
        httpBackend.when(response.method, response.path).respond(200, response.data);
    });
}

async function makeTestClient(
    userInfo: { userId: string; deviceId: string },
    options: Partial<ICreateClientOpts> = {},
    keys: Record<string, Uint8Array> = {},
) {
    function getCrossSigningKey(type: string) {
        return keys[type] ?? null;
    }

    function saveCrossSigningKeys(k: Record<string, Uint8Array>) {
        Object.assign(keys, k);
    }

    options.cryptoCallbacks = Object.assign(
        {},
        { getCrossSigningKey, saveCrossSigningKeys },
        options.cryptoCallbacks || {},
    );
    const testClient = new TestClient(userInfo.userId, userInfo.deviceId, undefined, undefined, options);
    const client = testClient.client;

    await client.initCrypto();

    return { client, httpBackend: testClient.httpBackend };
}

describe("Cross Signing", function () {
    if (!global.Olm) {
        logger.warn("Not running megolm backup unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return global.Olm.init();
    });

    it("should sign the master key with the device key", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = jest.fn().mockImplementation(async (auth, keys) => {
            await olmlib.verifySignature(
                alice.crypto!.olmDevice,
                keys.master_key,
                "@alice:example.com",
                "Osborne2",
                alice.crypto!.olmDevice.deviceEd25519Key!,
            );
        });
        alice.uploadKeySignatures = async () => ({ failures: {} });
        alice.setAccountData = async () => ({});
        alice.getAccountDataFromServer = async <T>() => ({} as T);
        // set Alice's cross-signing key
        await alice.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async (func) => {
                await func({});
            },
        });
        expect(alice.uploadDeviceSigningKeys).toHaveBeenCalled();
        alice.stopClient();
    });

    it("should abort bootstrap if device signing auth fails", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async (auth, keys) => {
            const errorResponse = {
                session: "sessionId",
                flows: [
                    {
                        stages: ["m.login.password"],
                    },
                ],
                params: {},
            };

            // If we're not just polling for flows, add on error rejecting the
            // auth attempt.
            if (auth) {
                Object.assign(errorResponse, {
                    completed: [],
                    error: "Invalid password",
                    errcode: "M_FORBIDDEN",
                });
            }

            const error = new MatrixError(errorResponse);
            error.httpStatus == 401;
            throw error;
        };
        alice.uploadKeySignatures = async () => ({ failures: {} });
        alice.setAccountData = async () => ({});
        alice.getAccountDataFromServer = async <T extends { [k: string]: any }>(): Promise<T | null> => ({} as T);
        const authUploadDeviceSigningKeys: BootstrapCrossSigningOpts["authUploadDeviceSigningKeys"] = async (func) => {
            await func({});
        };

        // Try bootstrap, expecting `authUploadDeviceSigningKeys` to pass
        // through failure, stopping before actually applying changes.
        let bootstrapDidThrow = false;
        try {
            await alice.bootstrapCrossSigning({
                authUploadDeviceSigningKeys,
            });
        } catch (e) {
            if ((<MatrixError>e).errcode === "M_FORBIDDEN") {
                bootstrapDidThrow = true;
            }
        }
        expect(bootstrapDidThrow).toBeTruthy();
        alice.stopClient();
    });

    it("should upload a signature when a user is verified", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });
        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's device key
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        "ed25519:bobs+master+pubkey": "bobs+master+pubkey",
                    },
                },
            },
            firstUse: false,
            crossSigningVerifiedBefore: false,
        });
        // Alice verifies Bob's key
        const promise = new Promise((resolve, reject) => {
            alice.uploadKeySignatures = async (...args) => {
                resolve(...args);
                return { failures: {} };
            };
        });
        await alice.setDeviceVerified("@bob:example.com", "bobs+master+pubkey", true);
        // Alice should send a signature of Bob's key to the server
        await promise;
        alice.stopClient();
    });

    it.skip("should get cross-signing keys from sync", async function () {
        const masterKey = new Uint8Array([
            0xda, 0x5a, 0x27, 0x60, 0xe3, 0x3a, 0xc5, 0x82, 0x9d, 0x12, 0xc3, 0xbe, 0xe8, 0xaa, 0xc2, 0xef, 0xae, 0xb1,
            0x05, 0xc1, 0xe7, 0x62, 0x78, 0xa6, 0xd7, 0x1f, 0xf8, 0x2c, 0x51, 0x85, 0xf0, 0x1d,
        ]);
        const selfSigningKey = new Uint8Array([
            0x1e, 0xf4, 0x01, 0x6d, 0x4f, 0xa1, 0x73, 0x66, 0x6b, 0xf8, 0x93, 0xf5, 0xb0, 0x4d, 0x17, 0xc0, 0x17, 0xb5,
            0xa5, 0xf6, 0x59, 0x11, 0x8b, 0x49, 0x34, 0xf2, 0x4b, 0x64, 0x9b, 0x52, 0xf8, 0x5f,
        ]);

        const { client: alice, httpBackend } = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    // will be called to sign our own device
                    getCrossSigningKey: async (type) => {
                        if (type === "master") {
                            return masterKey;
                        } else {
                            return selfSigningKey;
                        }
                    },
                },
            },
        );

        const keyChangePromise = new Promise((resolve, reject) => {
            alice.once(CryptoEvent.KeysChanged, async (e) => {
                resolve(e);
                await alice.checkOwnCrossSigningTrust({
                    allowPrivateKeyRequests: true,
                });
            });
        });

        const uploadSigsPromise = new Promise<void>((resolve, reject) => {
            alice.uploadKeySignatures = jest.fn().mockImplementation(async (content) => {
                try {
                    await olmlib.verifySignature(
                        alice.crypto!.olmDevice,
                        content["@alice:example.com"]["nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk"],
                        "@alice:example.com",
                        "Osborne2",
                        alice.crypto!.olmDevice.deviceEd25519Key!,
                    );
                    olmlib.pkVerify(
                        content["@alice:example.com"]["Osborne2"],
                        "EmkqvokUn8p+vQAGZitOk4PWjp7Ukp3txV2TbMPEiBQ",
                        "@alice:example.com",
                    );
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        // @ts-ignore private property
        const deviceInfo = alice.crypto!.deviceList.devices["@alice:example.com"].Osborne2;
        const aliceDevice = {
            user_id: "@alice:example.com",
            device_id: "Osborne2",
            keys: deviceInfo.keys,
            algorithms: deviceInfo.algorithms,
        };
        await alice.crypto!.signObject(aliceDevice);
        olmlib.pkSign(aliceDevice as ISignedKey, selfSigningKey as unknown as PkSigning, "@alice:example.com", "");

        // feed sync result that includes master key, ssk, device key
        const responses: Response[] = [
            PUSH_RULES_RESPONSE,
            {
                method: "POST",
                path: "/keys/upload",
                data: {
                    one_time_key_counts: {
                        curve25519: 100,
                        signed_curve25519: 100,
                    },
                },
            },
            filterResponse("@alice:example.com"),
            {
                method: "GET",
                path: "/sync",
                data: {
                    next_batch: "abcdefg",
                    device_lists: {
                        changed: ["@alice:example.com", "@bob:example.com"],
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/query",
                data: {
                    failures: {},
                    device_keys: {
                        "@alice:example.com": {
                            Osborne2: aliceDevice,
                        },
                    },
                    master_keys: {
                        "@alice:example.com": {
                            user_id: "@alice:example.com",
                            usage: ["master"],
                            keys: {
                                "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                                    "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk",
                            },
                        },
                    },
                    self_signing_keys: {
                        "@alice:example.com": {
                            user_id: "@alice:example.com",
                            usage: ["self-signing"],
                            keys: {
                                "ed25519:EmkqvokUn8p+vQAGZitOk4PWjp7Ukp3txV2TbMPEiBQ":
                                    "EmkqvokUn8p+vQAGZitOk4PWjp7Ukp3txV2TbMPEiBQ",
                            },
                            signatures: {
                                "@alice:example.com": {
                                    "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                                        "Wqx/HXR851KIi8/u/UX+fbAMtq9Uj8sr8FsOcqrLfVYa6lAmbXs" +
                                        "Vhfy4AlZ3dnEtjgZx0U0QDrghEn2eYBeOCA",
                                },
                            },
                        },
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/upload",
                data: {
                    one_time_key_counts: {
                        curve25519: 100,
                        signed_curve25519: 100,
                    },
                },
            },
        ];
        setHttpResponses(httpBackend, responses);

        alice.startClient();
        httpBackend.flushAllExpected();

        // once ssk is confirmed, device key should be trusted
        await keyChangePromise;
        await uploadSigsPromise;

        const aliceTrust = alice.checkUserTrust("@alice:example.com");
        expect(aliceTrust.isCrossSigningVerified()).toBeTruthy();
        expect(aliceTrust.isTofu()).toBeTruthy();
        expect(aliceTrust.isVerified()).toBeTruthy();

        const aliceDeviceTrust = alice.checkDeviceTrust("@alice:example.com", "Osborne2");
        expect(aliceDeviceTrust.isCrossSigningVerified()).toBeTruthy();
        expect(aliceDeviceTrust.isLocallyVerified()).toBeTruthy();
        expect(aliceDeviceTrust.isTofu()).toBeTruthy();
        expect(aliceDeviceTrust.isVerified()).toBeTruthy();
        alice.stopClient();
    });

    it("should use trust chain to determine device verification", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });
        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's ssk and device key
        const bobMasterSigning = new global.Olm.PkSigning();
        const bobMasterPrivkey = bobMasterSigning.generate_seed();
        const bobMasterPubkey = bobMasterSigning.init_with_seed(bobMasterPrivkey);
        const bobSigning = new global.Olm.PkSigning();
        const bobPrivkey = bobSigning.generate_seed();
        const bobPubkey = bobSigning.init_with_seed(bobPrivkey);
        const bobSSK: ICrossSigningKey = {
            user_id: "@bob:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + bobPubkey]: bobPubkey,
            },
        };
        const sskSig = bobMasterSigning.sign(anotherjson.stringify(bobSSK));
        bobSSK.signatures = {
            "@bob:example.com": {
                ["ed25519:" + bobMasterPubkey]: sskSig,
            },
        };
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + bobMasterPubkey]: bobMasterPubkey,
                    },
                },
                self_signing: bobSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });
        const bobDeviceUnsigned = {
            user_id: "@bob:example.com",
            device_id: "Dynabook",
            algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
            keys: {
                "curve25519:Dynabook": "somePubkey",
                "ed25519:Dynabook": "someOtherPubkey",
            },
        };
        const sig = bobSigning.sign(anotherjson.stringify(bobDeviceUnsigned));
        const bobDevice: IDevice = {
            ...bobDeviceUnsigned,
            signatures: {
                "@bob:example.com": {
                    ["ed25519:" + bobPubkey]: sig,
                },
            },
            verified: 0,
            known: false,
        };
        alice.crypto!.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
        });
        // Bob's device key should be TOFU
        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isVerified()).toBeFalsy();
        expect(bobTrust.isTofu()).toBeTruthy();

        const bobDeviceTrust = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust.isVerified()).toBeFalsy();
        expect(bobDeviceTrust.isTofu()).toBeTruthy();

        // Alice verifies Bob's SSK
        alice.uploadKeySignatures = async () => ({ failures: {} });
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey, true);

        // Bob's device key should be trusted
        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust2.isTofu()).toBeTruthy();

        const bobDeviceTrust2 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust2.isCrossSigningVerified()).toBeTruthy();
        expect(bobDeviceTrust2.isLocallyVerified()).toBeFalsy();
        expect(bobDeviceTrust2.isTofu()).toBeTruthy();
        alice.stopClient();
    });

    it.skip("should trust signatures received from other devices", async function () {
        const aliceKeys: Record<string, Uint8Array> = {};
        const { client: alice, httpBackend } = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            undefined,
            aliceKeys,
        );
        alice.crypto!.deviceList.startTrackingDeviceList("@bob:example.com");
        alice.crypto!.deviceList.stopTrackingAllDeviceLists = () => {};
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });

        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);

        const selfSigningKey = new Uint8Array([
            0x1e, 0xf4, 0x01, 0x6d, 0x4f, 0xa1, 0x73, 0x66, 0x6b, 0xf8, 0x93, 0xf5, 0xb0, 0x4d, 0x17, 0xc0, 0x17, 0xb5,
            0xa5, 0xf6, 0x59, 0x11, 0x8b, 0x49, 0x34, 0xf2, 0x4b, 0x64, 0x9b, 0x52, 0xf8, 0x5f,
        ]);

        const keyChangePromise = new Promise<void>((resolve, reject) => {
            alice.crypto!.deviceList.once(CryptoEvent.UserCrossSigningUpdated, (userId) => {
                if (userId === "@bob:example.com") {
                    resolve();
                }
            });
        });

        // @ts-ignore private property
        const deviceInfo = alice.crypto!.deviceList.devices["@alice:example.com"].Osborne2;
        const aliceDevice = {
            user_id: "@alice:example.com",
            device_id: "Osborne2",
            keys: deviceInfo.keys,
            algorithms: deviceInfo.algorithms,
        };
        await alice.crypto!.signObject(aliceDevice);

        const bobOlmAccount = new global.Olm.Account();
        bobOlmAccount.create();
        const bobKeys = JSON.parse(bobOlmAccount.identity_keys());
        const bobDeviceUnsigned = {
            user_id: "@bob:example.com",
            device_id: "Dynabook",
            algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
            keys: {
                "ed25519:Dynabook": bobKeys.ed25519,
                "curve25519:Dynabook": bobKeys.curve25519,
            },
        };
        const deviceStr = anotherjson.stringify(bobDeviceUnsigned);
        const bobDevice: IDevice = {
            ...bobDeviceUnsigned,
            signatures: {
                "@bob:example.com": {
                    "ed25519:Dynabook": bobOlmAccount.sign(deviceStr),
                },
            },
            verified: 0,
            known: false,
        };
        olmlib.pkSign(bobDevice, selfSigningKey as unknown as PkSigning, "@bob:example.com", "");

        const bobMaster: ICrossSigningKey = {
            user_id: "@bob:example.com",
            usage: ["master"],
            keys: {
                "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk": "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk",
            },
        };
        olmlib.pkSign(bobMaster, aliceKeys.user_signing, "@alice:example.com", "");

        // Alice downloads Bob's keys
        // - device key
        // - ssk
        // - master key signed by her usk (pretend that it was signed by another
        //   of Alice's devices)
        const responses: Response[] = [
            PUSH_RULES_RESPONSE,
            {
                method: "POST",
                path: "/keys/upload",
                data: {
                    one_time_key_counts: {
                        curve25519: 100,
                        signed_curve25519: 100,
                    },
                },
            },
            filterResponse("@alice:example.com"),
            {
                method: "GET",
                path: "/sync",
                data: {
                    next_batch: "abcdefg",
                    device_lists: {
                        changed: ["@bob:example.com"],
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/query",
                data: {
                    failures: {},
                    device_keys: {
                        "@alice:example.com": {
                            Osborne2: aliceDevice,
                        },
                        "@bob:example.com": {
                            Dynabook: bobDevice,
                        },
                    },
                    master_keys: {
                        "@bob:example.com": bobMaster,
                    },
                    self_signing_keys: {
                        "@bob:example.com": {
                            user_id: "@bob:example.com",
                            usage: ["self-signing"],
                            keys: {
                                "ed25519:EmkqvokUn8p+vQAGZitOk4PWjp7Ukp3txV2TbMPEiBQ":
                                    "EmkqvokUn8p+vQAGZitOk4PWjp7Ukp3txV2TbMPEiBQ",
                            },
                            signatures: {
                                "@bob:example.com": {
                                    "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                                        "2KLiufImvEbfJuAFvsaZD+PsL8ELWl7N1u9yr/9hZvwRghBfQMB" +
                                        "LAI86b1kDV9+Cq1lt85ykReeCEzmTEPY2BQ",
                                },
                            },
                        },
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/upload",
                data: {
                    one_time_key_counts: {
                        curve25519: 100,
                        signed_curve25519: 100,
                    },
                },
            },
        ];
        setHttpResponses(httpBackend, responses);

        alice.startClient();
        httpBackend.flushAllExpected();
        await keyChangePromise;

        // Bob's device key should be trusted
        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust.isTofu()).toBeTruthy();

        const bobDeviceTrust = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust.isCrossSigningVerified()).toBeTruthy();
        expect(bobDeviceTrust.isLocallyVerified()).toBeFalsy();
        expect(bobDeviceTrust.isTofu()).toBeTruthy();
        alice.stopClient();
    });

    it("should dis-trust an unsigned device", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });
        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's ssk and device key
        // (NOTE: device key is not signed by ssk)
        const bobMasterSigning = new global.Olm.PkSigning();
        const bobMasterPrivkey = bobMasterSigning.generate_seed();
        const bobMasterPubkey = bobMasterSigning.init_with_seed(bobMasterPrivkey);
        const bobSigning = new global.Olm.PkSigning();
        const bobPrivkey = bobSigning.generate_seed();
        const bobPubkey = bobSigning.init_with_seed(bobPrivkey);
        const bobSSK: ICrossSigningKey = {
            user_id: "@bob:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + bobPubkey]: bobPubkey,
            },
        };
        const sskSig = bobMasterSigning.sign(anotherjson.stringify(bobSSK));
        bobSSK.signatures = {
            "@bob:example.com": {
                ["ed25519:" + bobMasterPubkey]: sskSig,
            },
        };
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + bobMasterPubkey]: bobMasterPubkey,
                    },
                },
                self_signing: bobSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });
        const bobDevice = {
            user_id: "@bob:example.com",
            device_id: "Dynabook",
            algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
            keys: {
                "curve25519:Dynabook": "somePubkey",
                "ed25519:Dynabook": "someOtherPubkey",
            },
        };
        alice.crypto!.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice as unknown as IDevice,
        });
        // Bob's device key should be untrusted
        const bobDeviceTrust = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust.isVerified()).toBeFalsy();
        expect(bobDeviceTrust.isTofu()).toBeFalsy();

        // Alice verifies Bob's SSK
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey, true);

        // Bob's device key should be untrusted
        const bobDeviceTrust2 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust2.isVerified()).toBeFalsy();
        expect(bobDeviceTrust2.isTofu()).toBeFalsy();
        alice.stopClient();
    });

    it("should dis-trust a user when their ssk changes", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's keys
        const bobMasterSigning = new global.Olm.PkSigning();
        const bobMasterPrivkey = bobMasterSigning.generate_seed();
        const bobMasterPubkey = bobMasterSigning.init_with_seed(bobMasterPrivkey);
        const bobSigning = new global.Olm.PkSigning();
        const bobPrivkey = bobSigning.generate_seed();
        const bobPubkey = bobSigning.init_with_seed(bobPrivkey);
        const bobSSK: ICrossSigningKey = {
            user_id: "@bob:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + bobPubkey]: bobPubkey,
            },
        };
        const sskSig = bobMasterSigning.sign(anotherjson.stringify(bobSSK));
        bobSSK.signatures = {
            "@bob:example.com": {
                ["ed25519:" + bobMasterPubkey]: sskSig,
            },
        };
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + bobMasterPubkey]: bobMasterPubkey,
                    },
                },
                self_signing: bobSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });
        const bobDeviceUnsigned = {
            user_id: "@bob:example.com",
            device_id: "Dynabook",
            algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
            keys: {
                "curve25519:Dynabook": "somePubkey",
                "ed25519:Dynabook": "someOtherPubkey",
            },
        };
        const bobDeviceString = anotherjson.stringify(bobDeviceUnsigned);
        const sig = bobSigning.sign(bobDeviceString);
        const bobDevice: IDevice = {
            ...bobDeviceUnsigned,
            verified: 0,
            known: false,
            signatures: {
                "@bob:example.com": {
                    ["ed25519:" + bobPubkey]: sig,
                },
            },
        };
        alice.crypto!.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
        });
        // Alice verifies Bob's SSK
        alice.uploadKeySignatures = async () => ({ failures: {} });
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey, true);

        // Bob's device key should be trusted
        const bobDeviceTrust = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust.isVerified()).toBeTruthy();
        expect(bobDeviceTrust.isTofu()).toBeTruthy();

        // Alice downloads new SSK for Bob
        const bobMasterSigning2 = new global.Olm.PkSigning();
        const bobMasterPrivkey2 = bobMasterSigning2.generate_seed();
        const bobMasterPubkey2 = bobMasterSigning2.init_with_seed(bobMasterPrivkey2);
        const bobSigning2 = new global.Olm.PkSigning();
        const bobPrivkey2 = bobSigning2.generate_seed();
        const bobPubkey2 = bobSigning2.init_with_seed(bobPrivkey2);
        const bobSSK2: ICrossSigningKey = {
            user_id: "@bob:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + bobPubkey2]: bobPubkey2,
            },
        };
        const sskSig2 = bobMasterSigning2.sign(anotherjson.stringify(bobSSK2));
        bobSSK2.signatures = {
            "@bob:example.com": {
                ["ed25519:" + bobMasterPubkey2]: sskSig2,
            },
        };
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + bobMasterPubkey2]: bobMasterPubkey2,
                    },
                },
                self_signing: bobSSK2,
            },
            firstUse: false,
            crossSigningVerifiedBefore: false,
        });
        // Bob's and his device should be untrusted
        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isVerified()).toBeFalsy();
        expect(bobTrust.isTofu()).toBeFalsy();

        const bobDeviceTrust2 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust2.isVerified()).toBeFalsy();
        expect(bobDeviceTrust2.isTofu()).toBeFalsy();

        // Alice verifies Bob's SSK
        alice.uploadKeySignatures = async () => ({ failures: {} });
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey2, true);

        // Bob should be trusted but not his device
        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isVerified()).toBeTruthy();

        const bobDeviceTrust3 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust3.isVerified()).toBeFalsy();

        // Alice gets new signature for device
        const sig2 = bobSigning2.sign(bobDeviceString);
        bobDevice.signatures!["@bob:example.com"]["ed25519:" + bobPubkey2] = sig2;
        alice.crypto!.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
        });

        // Bob's device should be trusted again (but not TOFU)
        const bobTrust3 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust3.isVerified()).toBeTruthy();

        const bobDeviceTrust4 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust4.isCrossSigningVerified()).toBeTruthy();
        alice.stopClient();
    });

    it("should offer to upgrade device verifications to cross-signing", async function () {
        let upgradeResolveFunc: Function;

        const { client: alice } = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    shouldUpgradeDeviceVerifications: async (verifs) => {
                        expect(verifs.users["@bob:example.com"]).toBeDefined();
                        upgradeResolveFunc();
                        return ["@bob:example.com"];
                    },
                },
            },
        );
        const { client: bob } = await makeTestClient({ userId: "@bob:example.com", deviceId: "Dynabook" });

        bob.uploadDeviceSigningKeys = async () => ({});
        bob.uploadKeySignatures = async () => ({ failures: {} });
        // set Bob's cross-signing key
        await resetCrossSigningKeys(bob);
        alice.crypto!.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: {
                algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
                keys: {
                    "curve25519:Dynabook": bob.crypto!.olmDevice.deviceCurve25519Key!,
                    "ed25519:Dynabook": bob.crypto!.olmDevice.deviceEd25519Key!,
                },
                verified: 1,
                known: true,
            },
        });
        alice.crypto!.deviceList.storeCrossSigningForUser("@bob:example.com", bob.crypto!.crossSigningInfo.toStorage());

        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });
        // when alice sets up cross-signing, she should notice that bob's
        // cross-signing key is signed by his Dynabook, which alice has
        // verified, and ask if the device verification should be upgraded to a
        // cross-signing verification
        let upgradePromise = new Promise((resolve) => {
            upgradeResolveFunc = resolve;
        });
        await resetCrossSigningKeys(alice);
        await upgradePromise;

        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust.isTofu()).toBeTruthy();

        // "forget" that Bob is trusted
        delete alice.crypto!.deviceList.crossSigningInfo["@bob:example.com"].keys.master.signatures![
            "@alice:example.com"
        ];

        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isCrossSigningVerified()).toBeFalsy();
        expect(bobTrust2.isTofu()).toBeTruthy();

        upgradePromise = new Promise((resolve) => {
            upgradeResolveFunc = resolve;
        });
        alice.crypto!.deviceList.emit(CryptoEvent.UserCrossSigningUpdated, "@bob:example.com");
        await new Promise((resolve) => {
            alice.crypto!.on(CryptoEvent.UserTrustStatusChanged, resolve);
        });
        await upgradePromise;

        const bobTrust3 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust3.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust3.isTofu()).toBeTruthy();
        alice.stopClient();
        bob.stopClient();
    });

    it("should observe that our own device is cross-signed, even if this device doesn't trust the key", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });

        // Generate Alice's SSK etc
        const aliceMasterSigning = new global.Olm.PkSigning();
        const aliceMasterPrivkey = aliceMasterSigning.generate_seed();
        const aliceMasterPubkey = aliceMasterSigning.init_with_seed(aliceMasterPrivkey);
        const aliceSigning = new global.Olm.PkSigning();
        const alicePrivkey = aliceSigning.generate_seed();
        const alicePubkey = aliceSigning.init_with_seed(alicePrivkey);
        const aliceSSK: ICrossSigningKey = {
            user_id: "@alice:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + alicePubkey]: alicePubkey,
            },
        };
        const sskSig = aliceMasterSigning.sign(anotherjson.stringify(aliceSSK));
        aliceSSK.signatures = {
            "@alice:example.com": {
                ["ed25519:" + aliceMasterPubkey]: sskSig,
            },
        };

        // Alice's device downloads the keys, but doesn't trust them yet
        alice.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
            keys: {
                master: {
                    user_id: "@alice:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + aliceMasterPubkey]: aliceMasterPubkey,
                    },
                },
                self_signing: aliceSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });

        // Alice has a second device that's cross-signed
        const aliceDeviceId = "Dynabook";
        const aliceUnsignedDevice = {
            user_id: "@alice:example.com",
            device_id: aliceDeviceId,
            algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
            keys: {
                "curve25519:Dynabook": "somePubkey",
                "ed25519:Dynabook": "someOtherPubkey",
            },
        };
        const sig = aliceSigning.sign(anotherjson.stringify(aliceUnsignedDevice));
        const aliceCrossSignedDevice: IDevice = {
            ...aliceUnsignedDevice,
            verified: 0,
            known: false,
            signatures: {
                "@alice:example.com": {
                    ["ed25519:" + alicePubkey]: sig,
                },
            },
        };
        alice.crypto!.deviceList.storeDevicesForUser("@alice:example.com", {
            [aliceDeviceId]: aliceCrossSignedDevice,
        });

        // We don't trust the cross-signing keys yet...
        expect(alice.checkDeviceTrust("@alice:example.com", aliceDeviceId).isCrossSigningVerified()).toBeFalsy();
        // ... but we do acknowledge that the device is signed by them
        expect(alice.checkIfOwnDeviceCrossSigned(aliceDeviceId)).toBeTruthy();
        alice.stopClient();
    });

    it("should observe that our own device isn't cross-signed", async function () {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });

        // Generate Alice's SSK etc
        const aliceMasterSigning = new global.Olm.PkSigning();
        const aliceMasterPrivkey = aliceMasterSigning.generate_seed();
        const aliceMasterPubkey = aliceMasterSigning.init_with_seed(aliceMasterPrivkey);
        const aliceSigning = new global.Olm.PkSigning();
        const alicePrivkey = aliceSigning.generate_seed();
        const alicePubkey = aliceSigning.init_with_seed(alicePrivkey);
        const aliceSSK: ICrossSigningKey = {
            user_id: "@alice:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + alicePubkey]: alicePubkey,
            },
        };
        const sskSig = aliceMasterSigning.sign(anotherjson.stringify(aliceSSK));
        aliceSSK.signatures = {
            "@alice:example.com": {
                ["ed25519:" + aliceMasterPubkey]: sskSig,
            },
        };

        // Alice's device downloads the keys
        alice.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
            keys: {
                master: {
                    user_id: "@alice:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + aliceMasterPubkey]: aliceMasterPubkey,
                    },
                },
                self_signing: aliceSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });

        const deviceId = "Dynabook";
        const aliceNotCrossSignedDevice: IDevice = {
            verified: 0,
            known: false,
            algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
            keys: {
                "curve25519:Dynabook": "somePubkey",
                "ed25519:Dynabook": "someOtherPubkey",
            },
        };
        alice.crypto!.deviceList.storeDevicesForUser("@alice:example.com", {
            [deviceId]: aliceNotCrossSignedDevice,
        });

        expect(alice.checkIfOwnDeviceCrossSigned(deviceId)).toBeFalsy();
        alice.stopClient();
    });

    it("checkIfOwnDeviceCrossSigned should sanely handle unknown devices", async () => {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        alice.uploadDeviceSigningKeys = async () => ({});
        alice.uploadKeySignatures = async () => ({ failures: {} });

        // Generate Alice's SSK etc
        const aliceMasterSigning = new global.Olm.PkSigning();
        const aliceMasterPrivkey = aliceMasterSigning.generate_seed();
        const aliceMasterPubkey = aliceMasterSigning.init_with_seed(aliceMasterPrivkey);
        const aliceSigning = new global.Olm.PkSigning();
        const alicePrivkey = aliceSigning.generate_seed();
        const alicePubkey = aliceSigning.init_with_seed(alicePrivkey);
        const aliceSSK: ICrossSigningKey = {
            user_id: "@alice:example.com",
            usage: ["self_signing"],
            keys: {
                ["ed25519:" + alicePubkey]: alicePubkey,
            },
        };
        const sskSig = aliceMasterSigning.sign(anotherjson.stringify(aliceSSK));
        aliceSSK.signatures = {
            "@alice:example.com": {
                ["ed25519:" + aliceMasterPubkey]: sskSig,
            },
        };

        // Alice's device downloads the keys
        alice.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
            keys: {
                master: {
                    user_id: "@alice:example.com",
                    usage: ["master"],
                    keys: {
                        ["ed25519:" + aliceMasterPubkey]: aliceMasterPubkey,
                    },
                },
                self_signing: aliceSSK,
            },
            firstUse: true,
            crossSigningVerifiedBefore: false,
        });

        expect(alice.checkIfOwnDeviceCrossSigned("notadevice")).toBeFalsy();
        alice.stopClient();
    });

    it("checkIfOwnDeviceCrossSigned should sanely handle unknown users", async () => {
        const { client: alice } = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        expect(alice.checkIfOwnDeviceCrossSigned("notadevice")).toBeFalsy();
        alice.stopClient();
    });
});

describe("userHasCrossSigningKeys", function () {
    if (!global.Olm) {
        return;
    }

    beforeAll(() => {
        return global.Olm.init();
    });

    let aliceClient: MatrixClient;
    let httpBackend: HttpBackend;
    beforeEach(async () => {
        const testClient = await makeTestClient({ userId: "@alice:example.com", deviceId: "Osborne2" });
        aliceClient = testClient.client;
        httpBackend = testClient.httpBackend;
    });

    afterEach(() => {
        aliceClient.stopClient();
    });

    it("should download devices and return true if one is a cross-signing key", async () => {
        httpBackend.when("POST", "/keys/query").respond(200, {
            master_keys: {
                "@alice:example.com": {
                    user_id: "@alice:example.com",
                    usage: ["master"],
                    keys: {
                        "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                            "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk",
                    },
                },
            },
        });

        let result: boolean;
        await Promise.all([
            httpBackend.flush("/keys/query"),
            aliceClient.userHasCrossSigningKeys().then((res) => {
                result = res;
            }),
        ]);
        expect(result!).toBeTruthy();
    });

    it("should download devices and return false if there is no cross-signing key", async () => {
        httpBackend.when("POST", "/keys/query").respond(200, {});

        let result: boolean;
        await Promise.all([
            httpBackend.flush("/keys/query"),
            aliceClient.userHasCrossSigningKeys().then((res) => {
                result = res;
            }),
        ]);
        expect(result!).toBeFalsy();
    });

    it("throws an error if crypto is disabled", () => {
        aliceClient["cryptoBackend"] = undefined;
        expect(() => aliceClient.userHasCrossSigningKeys()).toThrow("encryption disabled");
    });
});
