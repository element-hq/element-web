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

import '../../olm-loader';
import anotherjson from 'another-json';

import * as olmlib from "../../../src/crypto/olmlib";
import { TestClient } from '../../TestClient';
import { HttpResponse, setHttpResponses } from '../../test-utils';
import { resetCrossSigningKeys } from "./crypto-utils";
import { MatrixError } from '../../../src/http-api';
import { logger } from '../../../src/logger';

async function makeTestClient(userInfo, options, keys) {
    if (!keys) keys = {};

    function getCrossSigningKey(type) {
        return keys[type];
    }

    function saveCrossSigningKeys(k) {
        Object.assign(keys, k);
    }

    if (!options) options = {};
    options.cryptoCallbacks = Object.assign(
        {}, { getCrossSigningKey, saveCrossSigningKeys }, options.cryptoCallbacks || {},
    );
    const client = (new TestClient(
        userInfo.userId, userInfo.deviceId, undefined, undefined, options,
    )).client;

    await client.initCrypto();

    return client;
}

describe("Cross Signing", function() {
    if (!global.Olm) {
        logger.warn('Not running megolm backup unit tests: libolm not present');
        return;
    }

    beforeAll(function() {
        return global.Olm.init();
    });

    it("should sign the master key with the device key", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = jest.fn(async (auth, keys) => {
            await olmlib.verifySignature(
                alice.crypto.olmDevice, keys.master_key, "@alice:example.com",
                "Osborne2", alice.crypto.olmDevice.deviceEd25519Key,
            );
        });
        alice.uploadKeySignatures = async () => {};
        alice.setAccountData = async () => {};
        alice.getAccountDataFromServer = async () => {};
        // set Alice's cross-signing key
        await alice.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async func => await func({}),
        });
        expect(alice.uploadDeviceSigningKeys).toHaveBeenCalled();
    });

    it("should abort bootstrap if device signing auth fails", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = async (auth, keys) => {
            const errorResponse = {
                session: "sessionId",
                flows: [
                    {
                        stages: [
                            "m.login.password",
                        ],
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
        alice.uploadKeySignatures = async () => {};
        alice.setAccountData = async () => {};
        alice.getAccountDataFromServer = async () => { };
        const authUploadDeviceSigningKeys = async func => await func({});

        // Try bootstrap, expecting `authUploadDeviceSigningKeys` to pass
        // through failure, stopping before actually applying changes.
        let bootstrapDidThrow = false;
        try {
            await alice.bootstrapCrossSigning({
                authUploadDeviceSigningKeys,
            });
        } catch (e) {
            if (e.errcode === "M_FORBIDDEN") {
                bootstrapDidThrow = true;
            }
        }
        expect(bootstrapDidThrow).toBeTruthy();
    });

    it("should upload a signature when a user is verified", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};
        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's device key
        alice.crypto.deviceList.storeCrossSigningForUser("@bob:example.com", {
            keys: {
                master: {
                    user_id: "@bob:example.com",
                    usage: ["master"],
                    keys: {
                        "ed25519:bobs+master+pubkey": "bobs+master+pubkey",
                    },
                },
            },
        });
        // Alice verifies Bob's key
        const promise = new Promise((resolve, reject) => {
            alice.uploadKeySignatures = (...args) => {
                resolve(...args);
            };
        });
        await alice.setDeviceVerified("@bob:example.com", "bobs+master+pubkey", true);
        // Alice should send a signature of Bob's key to the server
        await promise;
    });

    it("should get cross-signing keys from sync", async function() {
        const masterKey = new Uint8Array([
            0xda, 0x5a, 0x27, 0x60, 0xe3, 0x3a, 0xc5, 0x82,
            0x9d, 0x12, 0xc3, 0xbe, 0xe8, 0xaa, 0xc2, 0xef,
            0xae, 0xb1, 0x05, 0xc1, 0xe7, 0x62, 0x78, 0xa6,
            0xd7, 0x1f, 0xf8, 0x2c, 0x51, 0x85, 0xf0, 0x1d,
        ]);
        const selfSigningKey = new Uint8Array([
            0x1e, 0xf4, 0x01, 0x6d, 0x4f, 0xa1, 0x73, 0x66,
            0x6b, 0xf8, 0x93, 0xf5, 0xb0, 0x4d, 0x17, 0xc0,
            0x17, 0xb5, 0xa5, 0xf6, 0x59, 0x11, 0x8b, 0x49,
            0x34, 0xf2, 0x4b, 0x64, 0x9b, 0x52, 0xf8, 0x5f,
        ]);

        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    // will be called to sign our own device
                    getCrossSigningKey: type => {
                        if (type === 'master') {
                            return masterKey;
                        } else {
                            return selfSigningKey;
                        }
                    },
                },
            },
        );

        const keyChangePromise = new Promise((resolve, reject) => {
            alice.once("crossSigning.keysChanged", async (e) => {
                resolve(e);
                await alice.checkOwnCrossSigningTrust({
                    allowPrivateKeyRequests: true,
                });
            });
        });

        const uploadSigsPromise = new Promise((resolve, reject) => {
            alice.uploadKeySignatures = jest.fn(async (content) => {
                try {
                    await olmlib.verifySignature(
                        alice.crypto.olmDevice,
                        content["@alice:example.com"][
                            "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk"
                            ],
                        "@alice:example.com",
                        "Osborne2", alice.crypto.olmDevice.deviceEd25519Key,
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

        const deviceInfo = alice.crypto.deviceList.devices["@alice:example.com"]
            .Osborne2;
        const aliceDevice = {
            user_id: "@alice:example.com",
            device_id: "Osborne2",
        };
        aliceDevice.keys = deviceInfo.keys;
        aliceDevice.algorithms = deviceInfo.algorithms;
        await alice.crypto.signObject(aliceDevice);
        olmlib.pkSign(aliceDevice, selfSigningKey, "@alice:example.com");

        // feed sync result that includes master key, ssk, device key
        const responses = [
            HttpResponse.PUSH_RULES_RESPONSE,
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
            HttpResponse.filterResponse("@alice:example.com"),
            {
                method: "GET",
                path: "/sync",
                data: {
                    next_batch: "abcdefg",
                    device_lists: {
                        changed: [
                            "@alice:example.com",
                            "@bob:example.com",
                        ],
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/query",
                data: {
                    "failures": {},
                    "device_keys": {
                        "@alice:example.com": {
                            "Osborne2": aliceDevice,
                        },
                    },
                    "master_keys": {
                        "@alice:example.com": {
                            user_id: "@alice:example.com",
                            usage: ["master"],
                            keys: {
                                "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                                "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk",
                            },
                        },
                    },
                    "self_signing_keys": {
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
                                    "Wqx/HXR851KIi8/u/UX+fbAMtq9Uj8sr8FsOcqrLfVYa6lAmbXs"
                                    + "Vhfy4AlZ3dnEtjgZx0U0QDrghEn2eYBeOCA",
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
        setHttpResponses(alice, responses, true, true);

        await alice.startClient();

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
    });

    it("should use trust chain to determine device verification", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};
        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's ssk and device key
        const bobMasterSigning = new global.Olm.PkSigning();
        const bobMasterPrivkey = bobMasterSigning.generate_seed();
        const bobMasterPubkey = bobMasterSigning.init_with_seed(bobMasterPrivkey);
        const bobSigning = new global.Olm.PkSigning();
        const bobPrivkey = bobSigning.generate_seed();
        const bobPubkey = bobSigning.init_with_seed(bobPrivkey);
        const bobSSK = {
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
        alice.crypto.deviceList.storeCrossSigningForUser("@bob:example.com", {
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
            firstUse: 1,
            unsigned: {},
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
        const sig = bobSigning.sign(anotherjson.stringify(bobDevice));
        bobDevice.signatures = {
            "@bob:example.com": {
                ["ed25519:" + bobPubkey]: sig,
            },
        };
        alice.crypto.deviceList.storeDevicesForUser("@bob:example.com", {
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
        alice.uploadKeySignatures = () => {};
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey, true);

        // Bob's device key should be trusted
        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust2.isTofu()).toBeTruthy();

        const bobDeviceTrust2 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust2.isCrossSigningVerified()).toBeTruthy();
        expect(bobDeviceTrust2.isLocallyVerified()).toBeFalsy();
        expect(bobDeviceTrust2.isTofu()).toBeTruthy();
    });

    it("should trust signatures received from other devices", async function() {
        const aliceKeys = {};
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            null,
            aliceKeys,
        );
        alice.crypto.deviceList.startTrackingDeviceList("@bob:example.com");
        alice.crypto.deviceList.stopTrackingAllDeviceLists = () => {};
        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};

        // set Alice's cross-signing key
        await resetCrossSigningKeys(alice);

        const selfSigningKey = new Uint8Array([
            0x1e, 0xf4, 0x01, 0x6d, 0x4f, 0xa1, 0x73, 0x66,
            0x6b, 0xf8, 0x93, 0xf5, 0xb0, 0x4d, 0x17, 0xc0,
            0x17, 0xb5, 0xa5, 0xf6, 0x59, 0x11, 0x8b, 0x49,
            0x34, 0xf2, 0x4b, 0x64, 0x9b, 0x52, 0xf8, 0x5f,
        ]);

        const keyChangePromise = new Promise((resolve, reject) => {
            alice.crypto.deviceList.once("userCrossSigningUpdated", (userId) => {
                if (userId === "@bob:example.com") {
                    resolve();
                }
            });
        });

        const deviceInfo = alice.crypto.deviceList.devices["@alice:example.com"]
            .Osborne2;
        const aliceDevice = {
            user_id: "@alice:example.com",
            device_id: "Osborne2",
        };
        aliceDevice.keys = deviceInfo.keys;
        aliceDevice.algorithms = deviceInfo.algorithms;
        await alice.crypto.signObject(aliceDevice);

        const bobOlmAccount = new global.Olm.Account();
        bobOlmAccount.create();
        const bobKeys = JSON.parse(bobOlmAccount.identity_keys());
        const bobDevice = {
            user_id: "@bob:example.com",
            device_id: "Dynabook",
            algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
            keys: {
                "ed25519:Dynabook": bobKeys.ed25519,
                "curve25519:Dynabook": bobKeys.curve25519,
            },
        };
        const deviceStr = anotherjson.stringify(bobDevice);
        bobDevice.signatures = {
            "@bob:example.com": {
                "ed25519:Dynabook": bobOlmAccount.sign(deviceStr),
            },
        };
        olmlib.pkSign(bobDevice, selfSigningKey, "@bob:example.com");

        const bobMaster = {
            user_id: "@bob:example.com",
            usage: ["master"],
            keys: {
                "ed25519:nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk":
                "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk",
            },
        };
        olmlib.pkSign(bobMaster, aliceKeys.user_signing, "@alice:example.com");

        // Alice downloads Bob's keys
        // - device key
        // - ssk
        // - master key signed by her usk (pretend that it was signed by another
        //   of Alice's devices)
        const responses = [
            HttpResponse.PUSH_RULES_RESPONSE,
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
            HttpResponse.filterResponse("@alice:example.com"),
            {
                method: "GET",
                path: "/sync",
                data: {
                    next_batch: "abcdefg",
                    device_lists: {
                        changed: [
                            "@bob:example.com",
                        ],
                    },
                },
            },
            {
                method: "POST",
                path: "/keys/query",
                data: {
                    "failures": {},
                    "device_keys": {
                        "@alice:example.com": {
                            "Osborne2": aliceDevice,
                        },
                        "@bob:example.com": {
                            "Dynabook": bobDevice,
                        },
                    },
                    "master_keys": {
                        "@bob:example.com": bobMaster,
                    },
                    "self_signing_keys": {
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
                                    "2KLiufImvEbfJuAFvsaZD+PsL8ELWl7N1u9yr/9hZvwRghBfQMB"
                                    + "LAI86b1kDV9+Cq1lt85ykReeCEzmTEPY2BQ",
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
        setHttpResponses(alice, responses);

        await alice.startClient();

        await keyChangePromise;

        // Bob's device key should be trusted
        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust.isTofu()).toBeTruthy();

        const bobDeviceTrust = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust.isCrossSigningVerified()).toBeTruthy();
        expect(bobDeviceTrust.isLocallyVerified()).toBeFalsy();
        expect(bobDeviceTrust.isTofu()).toBeTruthy();
    });

    it("should dis-trust an unsigned device", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};
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
        const bobSSK = {
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
        alice.crypto.deviceList.storeCrossSigningForUser("@bob:example.com", {
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
            firstUse: 1,
            unsigned: {},
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
        alice.crypto.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
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
    });

    it("should dis-trust a user when their ssk changes", async function() {
        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
        );
        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};
        await resetCrossSigningKeys(alice);
        // Alice downloads Bob's keys
        const bobMasterSigning = new global.Olm.PkSigning();
        const bobMasterPrivkey = bobMasterSigning.generate_seed();
        const bobMasterPubkey = bobMasterSigning.init_with_seed(bobMasterPrivkey);
        const bobSigning = new global.Olm.PkSigning();
        const bobPrivkey = bobSigning.generate_seed();
        const bobPubkey = bobSigning.init_with_seed(bobPrivkey);
        const bobSSK = {
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
        alice.crypto.deviceList.storeCrossSigningForUser("@bob:example.com", {
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
            firstUse: 1,
            unsigned: {},
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
        const bobDeviceString = anotherjson.stringify(bobDevice);
        const sig = bobSigning.sign(bobDeviceString);
        bobDevice.signatures = {};
        bobDevice.signatures["@bob:example.com"] = {};
        bobDevice.signatures["@bob:example.com"]["ed25519:" + bobPubkey] = sig;
        alice.crypto.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
        });
        // Alice verifies Bob's SSK
        alice.uploadKeySignatures = () => {};
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
        const bobSSK2 = {
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
        alice.crypto.deviceList.storeCrossSigningForUser("@bob:example.com", {
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
            firstUse: 0,
            unsigned: {},
        });
        // Bob's and his device should be untrusted
        const bobTrust = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust.isVerified()).toBeFalsy();
        expect(bobTrust.isTofu()).toBeFalsy();

        const bobDeviceTrust2 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust2.isVerified()).toBeFalsy();
        expect(bobDeviceTrust2.isTofu()).toBeFalsy();

        // Alice verifies Bob's SSK
        alice.uploadKeySignatures = () => {};
        await alice.setDeviceVerified("@bob:example.com", bobMasterPubkey2, true);

        // Bob should be trusted but not his device
        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isVerified()).toBeTruthy();

        const bobDeviceTrust3 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust3.isVerified()).toBeFalsy();

        // Alice gets new signature for device
        const sig2 = bobSigning2.sign(bobDeviceString);
        bobDevice.signatures["@bob:example.com"]["ed25519:" + bobPubkey2] = sig2;
        alice.crypto.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: bobDevice,
        });

        // Bob's device should be trusted again (but not TOFU)
        const bobTrust3 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust3.isVerified()).toBeTruthy();

        const bobDeviceTrust4 = alice.checkDeviceTrust("@bob:example.com", "Dynabook");
        expect(bobDeviceTrust4.isCrossSigningVerified()).toBeTruthy();
    });

    it("should offer to upgrade device verifications to cross-signing", async function() {
        let upgradeResolveFunc;

        const alice = await makeTestClient(
            { userId: "@alice:example.com", deviceId: "Osborne2" },
            {
                cryptoCallbacks: {
                    shouldUpgradeDeviceVerifications: (verifs) => {
                        expect(verifs.users["@bob:example.com"]).toBeDefined();
                        upgradeResolveFunc();
                        return ["@bob:example.com"];
                    },
                },
            },
        );
        const bob = await makeTestClient(
            { userId: "@bob:example.com", deviceId: "Dynabook" },
        );

        bob.uploadDeviceSigningKeys = async () => {};
        bob.uploadKeySignatures = async () => {};
        // set Bob's cross-signing key
        await resetCrossSigningKeys(bob);
        alice.crypto.deviceList.storeDevicesForUser("@bob:example.com", {
            Dynabook: {
                algorithms: ["m.olm.curve25519-aes-sha256", "m.megolm.v1.aes-sha"],
                keys: {
                    "curve25519:Dynabook": bob.crypto.olmDevice.deviceCurve25519Key,
                    "ed25519:Dynabook": bob.crypto.olmDevice.deviceEd25519Key,
                },
                verified: 1,
                known: true,
            },
        });
        alice.crypto.deviceList.storeCrossSigningForUser(
            "@bob:example.com",
            bob.crypto.crossSigningInfo.toStorage(),
        );

        alice.uploadDeviceSigningKeys = async () => {};
        alice.uploadKeySignatures = async () => {};
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
        delete alice.crypto.deviceList.crossSigningInfo["@bob:example.com"]
            .keys.master.signatures["@alice:example.com"];

        const bobTrust2 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust2.isCrossSigningVerified()).toBeFalsy();
        expect(bobTrust2.isTofu()).toBeTruthy();

        upgradePromise = new Promise((resolve) => {
            upgradeResolveFunc = resolve;
        });
        alice.crypto.deviceList.emit("userCrossSigningUpdated", "@bob:example.com");
        await new Promise((resolve) => {
            alice.crypto.on("userTrustStatusChanged", resolve);
        });
        await upgradePromise;

        const bobTrust3 = alice.checkUserTrust("@bob:example.com");
        expect(bobTrust3.isCrossSigningVerified()).toBeTruthy();
        expect(bobTrust3.isTofu()).toBeTruthy();
    });
});
