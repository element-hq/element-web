/*
Copyright 2018-2019 New Vector Ltd
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
import "../../../olm-loader";
import { makeTestClients } from "./util";
import { MatrixEvent } from "../../../../src/models/event";
import { ISasEvent, SAS, SasEvent } from "../../../../src/crypto/verification/SAS";
import { DeviceInfo, IDevice } from "../../../../src/crypto/deviceinfo";
import { CryptoEvent, verificationMethods } from "../../../../src/crypto";
import * as olmlib from "../../../../src/crypto/olmlib";
import { logger } from "../../../../src/logger";
import { resetCrossSigningKeys } from "../crypto-utils";
import { VerificationBase } from "../../../../src/crypto/verification/Base";
import { IVerificationChannel } from "../../../../src/crypto/verification/request/Channel";
import { MatrixClient } from "../../../../src";
import { VerificationRequest } from "../../../../src/crypto/verification/request/VerificationRequest";
import { TestClient } from "../../../TestClient";

const Olm = global.Olm;

let ALICE_DEVICES: Record<string, IDevice>;
let BOB_DEVICES: Record<string, IDevice>;

describe("SAS verification", function () {
    if (!global.Olm) {
        logger.warn("Not running device verification unit tests: libolm not present");
        return;
    }

    beforeAll(function () {
        return Olm.init();
    });

    it("should error on an unexpected event", async function () {
        //channel, baseApis, userId, deviceId, startEvent, request
        const request = {
            onVerifierCancelled: function () {},
        } as VerificationRequest;
        const channel = {
            send: function () {
                return Promise.resolve();
            },
        } as unknown as IVerificationChannel;
        const mockClient = {} as unknown as MatrixClient;
        const event = new MatrixEvent({ type: "test" });
        const sas = new SAS(channel, mockClient, "@alice:example.com", "ABCDEFG", event, request);
        sas.handleEvent(
            new MatrixEvent({
                sender: "@alice:example.com",
                type: "es.inquisition",
                content: {},
            }),
        );
        const spy = jest.fn();
        await sas.verify().catch(spy);
        expect(spy).toHaveBeenCalled();

        // Cancel the SAS for cleanup (we started a verification, so abort)
        sas.cancel(new Error("error"));
    });

    describe("verification", () => {
        let alice: TestClient;
        let bob: TestClient;
        let aliceSasEvent: ISasEvent | null;
        let bobSasEvent: ISasEvent | null;
        let aliceVerifier: SAS;
        let bobPromise: Promise<VerificationBase<any, any>>;
        let clearTestClientTimeouts: () => void;

        beforeEach(async () => {
            [[alice, bob], clearTestClientTimeouts] = await makeTestClients(
                [
                    { userId: "@alice:example.com", deviceId: "Osborne2" },
                    { userId: "@bob:example.com", deviceId: "Dynabook" },
                ],
                {
                    verificationMethods: [verificationMethods.SAS],
                },
            );

            const aliceDevice = alice.client.crypto!.olmDevice;
            const bobDevice = bob.client.crypto!.olmDevice;

            ALICE_DEVICES = {
                Osborne2: {
                    algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
                    keys: {
                        "ed25519:Osborne2": aliceDevice.deviceEd25519Key!,
                        "curve25519:Osborne2": aliceDevice.deviceCurve25519Key!,
                    },
                    verified: DeviceInfo.DeviceVerification.UNVERIFIED,
                    known: false,
                },
            };

            BOB_DEVICES = {
                Dynabook: {
                    algorithms: [olmlib.OLM_ALGORITHM, olmlib.MEGOLM_ALGORITHM],
                    keys: {
                        "ed25519:Dynabook": bobDevice.deviceEd25519Key!,
                        "curve25519:Dynabook": bobDevice.deviceCurve25519Key!,
                    },
                    verified: DeviceInfo.DeviceVerification.UNVERIFIED,
                    known: false,
                },
            };

            alice.client.crypto!.deviceList.storeDevicesForUser("@bob:example.com", BOB_DEVICES);
            alice.client.downloadKeys = () => {
                return Promise.resolve(new Map());
            };

            bob.client.crypto!.deviceList.storeDevicesForUser("@alice:example.com", ALICE_DEVICES);
            bob.client.downloadKeys = () => {
                return Promise.resolve(new Map());
            };

            aliceSasEvent = null;
            bobSasEvent = null;

            bobPromise = new Promise<VerificationBase<any, any>>((resolve, reject) => {
                bob.client.on(CryptoEvent.VerificationRequest, (request) => {
                    (<SAS>request.verifier!).on(SasEvent.ShowSas, (e) => {
                        if (!e.sas.emoji || !e.sas.decimal) {
                            e.cancel();
                        } else if (!aliceSasEvent) {
                            bobSasEvent = e;
                        } else {
                            try {
                                expect(e.sas).toEqual(aliceSasEvent.sas);
                                e.confirm();
                                aliceSasEvent.confirm();
                            } catch {
                                e.mismatch();
                                aliceSasEvent.mismatch();
                            }
                        }
                    });
                    resolve(request.verifier!);
                });
            });

            aliceVerifier = alice.client.beginKeyVerification(
                verificationMethods.SAS,
                bob.client.getUserId()!,
                bob.deviceId!,
            ) as SAS;
            aliceVerifier.on(SasEvent.ShowSas, (e) => {
                if (!e.sas.emoji || !e.sas.decimal) {
                    e.cancel();
                } else if (!bobSasEvent) {
                    aliceSasEvent = e;
                } else {
                    try {
                        expect(e.sas).toEqual(bobSasEvent.sas);
                        e.confirm();
                        bobSasEvent.confirm();
                    } catch {
                        e.mismatch();
                        bobSasEvent.mismatch();
                    }
                }
            });
        });

        afterEach(async () => {
            await Promise.all([alice.stop(), bob.stop()]);

            clearTestClientTimeouts();
        });

        it("should verify a key", async () => {
            let macMethod;
            let keyAgreement;
            const origSendToDevice = bob.client.sendToDevice.bind(bob.client);
            bob.client.sendToDevice = async (type, map) => {
                if (type === "m.key.verification.accept") {
                    macMethod = map
                        .get(alice.client.getUserId()!)
                        ?.get(alice.client.deviceId!)?.message_authentication_code;
                    keyAgreement = map
                        .get(alice.client.getUserId()!)
                        ?.get(alice.client.deviceId!)?.key_agreement_protocol;
                }
                return origSendToDevice(type, map);
            };

            alice.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@bob:example.com": BOB_DEVICES,
                },
            });
            bob.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@alice:example.com": ALICE_DEVICES,
                },
            });

            await Promise.all([
                aliceVerifier.verify(),
                bobPromise.then((verifier) => verifier.verify()),
                alice.httpBackend.flush(undefined),
                bob.httpBackend.flush(undefined),
            ]);

            // make sure that it uses the preferred method
            expect(macMethod).toBe("hkdf-hmac-sha256.v2");
            expect(keyAgreement).toBe("curve25519-hkdf-sha256");

            // make sure Alice and Bob verified each other
            const bobDevice = await alice.client.getStoredDevice("@bob:example.com", "Dynabook");
            expect(bobDevice?.isVerified()).toBeTruthy();
            const aliceDevice = await bob.client.getStoredDevice("@alice:example.com", "Osborne2");
            expect(aliceDevice?.isVerified()).toBeTruthy();
        });

        it("should be able to verify using the old base64", async () => {
            // pretend that Alice can only understand the old (incorrect) base64
            // encoding, and make sure that she can still verify with Bob
            let macMethod;
            const aliceOrigSendToDevice = alice.client.sendToDevice.bind(alice.client);
            alice.client.sendToDevice = (type, map) => {
                if (type === "m.key.verification.start") {
                    // Note: this modifies not only the message that Bob
                    // receives, but also the copy of the message that Alice
                    // has, since it is the same object.  If this does not
                    // happen, the verification will fail due to a hash
                    // commitment mismatch.
                    map.get(bob.client.getUserId()!)!.get(bob.client.deviceId!)!.message_authentication_codes = [
                        "hkdf-hmac-sha256",
                    ];
                }
                return aliceOrigSendToDevice(type, map);
            };
            const bobOrigSendToDevice = bob.client.sendToDevice.bind(bob.client);
            bob.client.sendToDevice = (type, map) => {
                if (type === "m.key.verification.accept") {
                    macMethod = map
                        .get(alice.client.getUserId()!)!
                        .get(alice.client.deviceId!)!.message_authentication_code;
                }
                return bobOrigSendToDevice(type, map);
            };

            alice.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@bob:example.com": BOB_DEVICES,
                },
            });
            bob.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@alice:example.com": ALICE_DEVICES,
                },
            });

            await Promise.all([
                aliceVerifier.verify(),
                bobPromise.then((verifier) => verifier.verify()),
                alice.httpBackend.flush(undefined),
                bob.httpBackend.flush(undefined),
            ]);

            expect(macMethod).toBe("hkdf-hmac-sha256");

            const bobDevice = await alice.client.getStoredDevice("@bob:example.com", "Dynabook");
            expect(bobDevice!.isVerified()).toBeTruthy();
            const aliceDevice = await bob.client.getStoredDevice("@alice:example.com", "Osborne2");
            expect(aliceDevice!.isVerified()).toBeTruthy();
        });

        it("should be able to verify using the old MAC", async () => {
            // pretend that Alice can only understand the old (incorrect) MAC,
            // and make sure that she can still verify with Bob
            let macMethod;
            const aliceOrigSendToDevice = alice.client.sendToDevice.bind(alice.client);
            alice.client.sendToDevice = (type, map) => {
                if (type === "m.key.verification.start") {
                    // Note: this modifies not only the message that Bob
                    // receives, but also the copy of the message that Alice
                    // has, since it is the same object.  If this does not
                    // happen, the verification will fail due to a hash
                    // commitment mismatch.
                    map.get(bob.client.getUserId()!)!.get(bob.client.deviceId!)!.message_authentication_codes = [
                        "hmac-sha256",
                    ];
                }
                return aliceOrigSendToDevice(type, map);
            };
            const bobOrigSendToDevice = bob.client.sendToDevice.bind(bob.client);
            bob.client.sendToDevice = (type, map) => {
                if (type === "m.key.verification.accept") {
                    macMethod = map
                        .get(alice.client.getUserId()!)!
                        .get(alice.client.deviceId!)!.message_authentication_code;
                }
                return bobOrigSendToDevice(type, map);
            };

            alice.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@bob:example.com": BOB_DEVICES,
                },
            });
            bob.httpBackend.when("POST", "/keys/query").respond(200, {
                failures: {},
                device_keys: {
                    "@alice:example.com": ALICE_DEVICES,
                },
            });

            await Promise.all([
                aliceVerifier.verify(),
                bobPromise.then((verifier) => verifier.verify()),
                alice.httpBackend.flush(undefined),
                bob.httpBackend.flush(undefined),
            ]);

            expect(macMethod).toBe("hmac-sha256");

            const bobDevice = await alice.client.getStoredDevice("@bob:example.com", "Dynabook");
            expect(bobDevice?.isVerified()).toBeTruthy();
            const aliceDevice = await bob.client.getStoredDevice("@alice:example.com", "Osborne2");
            expect(aliceDevice?.isVerified()).toBeTruthy();
        });

        it("should verify a cross-signing key", async () => {
            alice.httpBackend.when("POST", "/keys/device_signing/upload").respond(200, {});
            alice.httpBackend.when("POST", "/keys/signatures/upload").respond(200, {});
            alice.httpBackend.flush(undefined, 2);
            await resetCrossSigningKeys(alice.client);
            bob.httpBackend.when("POST", "/keys/device_signing/upload").respond(200, {});
            bob.httpBackend.when("POST", "/keys/signatures/upload").respond(200, {});
            bob.httpBackend.flush(undefined, 2);

            await resetCrossSigningKeys(bob.client);

            bob.client.crypto!.deviceList.storeCrossSigningForUser("@alice:example.com", {
                keys: alice.client.crypto!.crossSigningInfo.keys,
                crossSigningVerifiedBefore: false,
                firstUse: true,
            });

            const verifyProm = Promise.all([
                aliceVerifier.verify(),
                bobPromise.then((verifier) => {
                    bob.httpBackend.when("POST", "/keys/signatures/upload").respond(200, {});
                    bob.httpBackend.flush(undefined, 1, 2000);
                    return verifier.verify();
                }),
            ]);

            await verifyProm;

            const bobDeviceTrust = alice.client.checkDeviceTrust("@bob:example.com", "Dynabook");
            expect(bobDeviceTrust.isLocallyVerified()).toBeTruthy();
            expect(bobDeviceTrust.isCrossSigningVerified()).toBeFalsy();

            const bobDeviceVerificationStatus = (await alice.client
                .getCrypto()!
                .getDeviceVerificationStatus("@bob:example.com", "Dynabook"))!;
            expect(bobDeviceVerificationStatus.localVerified).toBe(true);
            expect(bobDeviceVerificationStatus.crossSigningVerified).toBe(false);

            const aliceTrust = bob.client.checkUserTrust("@alice:example.com");
            expect(aliceTrust.isCrossSigningVerified()).toBeTruthy();
            expect(aliceTrust.isTofu()).toBeTruthy();

            const aliceDeviceTrust = bob.client.checkDeviceTrust("@alice:example.com", "Osborne2");
            expect(aliceDeviceTrust.isLocallyVerified()).toBeTruthy();
            expect(aliceDeviceTrust.isCrossSigningVerified()).toBeFalsy();

            const aliceDeviceVerificationStatus = (await bob.client
                .getCrypto()!
                .getDeviceVerificationStatus("@alice:example.com", "Osborne2"))!;
            expect(aliceDeviceVerificationStatus.localVerified).toBe(true);
            expect(aliceDeviceVerificationStatus.crossSigningVerified).toBe(false);

            const unknownDeviceVerificationStatus = await bob.client
                .getCrypto()!
                .getDeviceVerificationStatus("@alice:example.com", "xyz");
            expect(unknownDeviceVerificationStatus).toBe(null);
        });
    });

    it("should send a cancellation message on error", async function () {
        const [[alice, bob], clearTestClientTimeouts] = await makeTestClients(
            [
                { userId: "@alice:example.com", deviceId: "Osborne2" },
                { userId: "@bob:example.com", deviceId: "Dynabook" },
            ],
            {
                verificationMethods: [verificationMethods.SAS],
            },
        );
        alice.client.setDeviceVerified = jest.fn();
        alice.client.downloadKeys = jest.fn().mockResolvedValue({});
        bob.client.setDeviceVerified = jest.fn();
        bob.client.downloadKeys = jest.fn().mockResolvedValue({});

        const bobPromise = new Promise<VerificationBase<any, any>>((resolve, reject) => {
            bob.client.on(CryptoEvent.VerificationRequest, (request) => {
                (<SAS>request.verifier!).on(SasEvent.ShowSas, (e) => {
                    e.mismatch();
                });
                resolve(request.verifier!);
            });
        });

        const aliceVerifier = alice.client.beginKeyVerification(
            verificationMethods.SAS,
            bob.client.getUserId()!,
            bob.client.deviceId!,
        );

        const aliceSpy = jest.fn();
        const bobSpy = jest.fn();
        await Promise.all([
            aliceVerifier.verify().catch(aliceSpy),
            bobPromise.then((verifier) => verifier.verify()).catch(bobSpy),
        ]);
        expect(aliceSpy).toHaveBeenCalled();
        expect(bobSpy).toHaveBeenCalled();
        expect(alice.client.setDeviceVerified).not.toHaveBeenCalled();
        expect(bob.client.setDeviceVerified).not.toHaveBeenCalled();

        alice.stop();
        bob.stop();
        clearTestClientTimeouts();
    });

    describe("verification in DM", function () {
        let alice: TestClient;
        let bob: TestClient;
        let aliceSasEvent: ISasEvent | null;
        let bobSasEvent: ISasEvent | null;
        let aliceVerifier: SAS;
        let bobPromise: Promise<void>;
        let clearTestClientTimeouts: Function;

        beforeEach(async function () {
            [[alice, bob], clearTestClientTimeouts] = await makeTestClients(
                [
                    { userId: "@alice:example.com", deviceId: "Osborne2" },
                    { userId: "@bob:example.com", deviceId: "Dynabook" },
                ],
                {
                    verificationMethods: [verificationMethods.SAS],
                },
            );

            alice.client.crypto!.setDeviceVerification = jest.fn();
            alice.client.getDeviceEd25519Key = () => {
                return "alice+base64+ed25519+key";
            };
            alice.client.getStoredDevice = () => {
                return DeviceInfo.fromStorage(
                    {
                        keys: {
                            "ed25519:Dynabook": "bob+base64+ed25519+key",
                        },
                    },
                    "Dynabook",
                );
            };
            alice.client.downloadKeys = () => {
                return Promise.resolve(new Map());
            };

            bob.client.crypto!.setDeviceVerification = jest.fn();
            bob.client.getStoredDevice = () => {
                return DeviceInfo.fromStorage(
                    {
                        keys: {
                            "ed25519:Osborne2": "alice+base64+ed25519+key",
                        },
                    },
                    "Osborne2",
                );
            };
            bob.client.getDeviceEd25519Key = () => {
                return "bob+base64+ed25519+key";
            };
            bob.client.downloadKeys = () => {
                return Promise.resolve(new Map());
            };

            aliceSasEvent = null;
            bobSasEvent = null;

            bobPromise = new Promise<void>((resolve, reject) => {
                bob.client.on(CryptoEvent.VerificationRequest, async (request) => {
                    const verifier = request.beginKeyVerification(SAS.NAME) as SAS;
                    verifier.on(SasEvent.ShowSas, (e) => {
                        if (!e.sas.emoji || !e.sas.decimal) {
                            e.cancel();
                        } else if (!aliceSasEvent) {
                            bobSasEvent = e;
                        } else {
                            try {
                                expect(e.sas).toEqual(aliceSasEvent.sas);
                                e.confirm();
                                aliceSasEvent.confirm();
                            } catch {
                                e.mismatch();
                                aliceSasEvent.mismatch();
                            }
                        }
                    });
                    await verifier.verify();
                    resolve();
                });
            });

            const aliceRequest = await alice.client.requestVerificationDM(bob.client.getUserId()!, "!room_id");
            await aliceRequest.waitFor((r) => r.started);
            aliceVerifier = aliceRequest.verifier! as SAS;
            aliceVerifier.on(SasEvent.ShowSas, (e) => {
                if (!e.sas.emoji || !e.sas.decimal) {
                    e.cancel();
                } else if (!bobSasEvent) {
                    aliceSasEvent = e;
                } else {
                    try {
                        expect(e.sas).toEqual(bobSasEvent.sas);
                        e.confirm();
                        bobSasEvent.confirm();
                    } catch {
                        e.mismatch();
                        bobSasEvent.mismatch();
                    }
                }
            });
        });
        afterEach(async function () {
            await Promise.all([alice.stop(), bob.stop()]);

            clearTestClientTimeouts();
        });

        it("should verify a key", async function () {
            await Promise.all([aliceVerifier.verify(), bobPromise]);

            // make sure Alice and Bob verified each other
            expect(alice.client.crypto!.setDeviceVerification).toHaveBeenCalledWith(
                bob.client.getUserId(),
                bob.client.deviceId,
                true,
                null,
                null,
                { "ed25519:Dynabook": "bob+base64+ed25519+key" },
            );
            expect(bob.client.crypto!.setDeviceVerification).toHaveBeenCalledWith(
                alice.client.getUserId(),
                alice.client.deviceId,
                true,
                null,
                null,
                { "ed25519:Osborne2": "alice+base64+ed25519+key" },
            );
        });
    });
});
