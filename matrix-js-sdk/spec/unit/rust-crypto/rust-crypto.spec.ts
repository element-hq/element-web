/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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
import * as RustSdkCryptoJs from "@matrix-org/matrix-sdk-crypto-js";
import { KeysQueryRequest, OlmMachine } from "@matrix-org/matrix-sdk-crypto-js";
import { Mocked } from "jest-mock";

import { RustCrypto } from "../../../src/rust-crypto/rust-crypto";
import { initRustCrypto } from "../../../src/rust-crypto";
import { IHttpOpts, IToDeviceEvent, MatrixClient, MatrixHttpApi } from "../../../src";
import { mkEvent } from "../../test-utils/test-utils";
import { CryptoBackend } from "../../../src/common-crypto/CryptoBackend";
import { IEventDecryptionResult } from "../../../src/@types/crypto";
import { OutgoingRequestProcessor } from "../../../src/rust-crypto/OutgoingRequestProcessor";
import { ServerSideSecretStorage } from "../../../src/secret-storage";
import { ImportRoomKeysOpts } from "../../../src/crypto-api";

afterEach(() => {
    // reset fake-indexeddb after each test, to make sure we don't leak connections
    // cf https://github.com/dumbmatter/fakeIndexedDB#wipingresetting-the-indexeddb-for-a-fresh-state
    // eslint-disable-next-line no-global-assign
    indexedDB = new IDBFactory();
});

const TEST_USER = "@alice:example.com";
const TEST_DEVICE_ID = "TEST_DEVICE";

describe("RustCrypto", () => {
    describe(".importRoomKeys and .exportRoomKeys", () => {
        let rustCrypto: RustCrypto;

        beforeEach(async () => {
            rustCrypto = await makeTestRustCrypto();
        });

        it("should import and export keys", async () => {
            const someRoomKeys = [
                {
                    algorithm: "m.megolm.v1.aes-sha2",
                    room_id: "!cLDYAnjpiQXIrSwngM:localhost:8480",
                    sender_key: "C9FMqTD20C0VaGWE/aSImkimuE6HDa/RyYj5gRUg3gY",
                    session_id: "iGQG5GaP1/B3dSH6zCQDQqrNuotrtQjVC7w1OsUDwbg",
                    session_key:
                        "AQAAAADaCbP2gdOy8jrhikjploKgSBaFSJ5rvHcziaADbwNEzeCSrfuAUlXvCvxik8kU+MfCHIi5arN2M7UM5rGKdzkHnkReoIByFkeMdbjKWk5SFpVQexcM74eDhBGj+ICkQqOgApfnEbSswrmreB0+MhHHyLStwW5fy5f8A9QW1sbPuohkBuRmj9fwd3Uh+swkA0KqzbqLa7UI1Qu8NTrFA8G4",
                    sender_claimed_keys: {
                        ed25519: "RSq0Xw0RR0DeqlJ/j3qrF5qbN0D96fKk8lz9kZJlG9k",
                    },
                    forwarding_curve25519_key_chain: [],
                },
                {
                    algorithm: "m.megolm.v1.aes-sha2",
                    room_id: "!cLDYAnjpiQXIrSwngM:localhost:8480",
                    sender_key: "C9FMqTD20C0VaGWE/aSImkimuE6HDa/RyYj5gRUg3gY",
                    session_id: "P/Jy9Tog4CMtLseeS4Fe2AEXZov3k6cibcop/uyhr78",
                    session_key:
                        "AQAAAAATyAVm0c9c9DW9Od72MxvfSDYoysBw3C6yMJ3bYuTmssHN7yNGm59KCtKeFp2Y5qO7lvUmwOfSTvTASUb7HViE7Lt+Bvp5WiMTJ2Pv6m+N12ihyowV5lgtKFWI18Wxd0AugMTVQRwjBK6aMobf86NXWD2hiKm3N6kWbC0PXmqV7T/ycvU6IOAjLS7HnkuBXtgBF2aL95OnIm3KKf7soa+/",
                    sender_claimed_keys: {
                        ed25519: "RSq0Xw0RR0DeqlJ/j3qrF5qbN0D96fKk8lz9kZJlG9k",
                    },
                    forwarding_curve25519_key_chain: [],
                },
            ];
            let importTotal = 0;
            const opt: ImportRoomKeysOpts = {
                progressCallback: (stage) => {
                    importTotal = stage.total;
                },
            };
            await rustCrypto.importRoomKeys(someRoomKeys, opt);

            expect(importTotal).toBe(2);

            const keys = await rustCrypto.exportRoomKeys();
            expect(Array.isArray(keys)).toBeTruthy();
            expect(keys.length).toBe(2);

            const aSession = someRoomKeys[0];

            const exportedKey = keys.find((k) => k.session_id == aSession.session_id);

            expect(aSession).toStrictEqual(exportedKey);
        });
    });

    describe("call preprocess methods", () => {
        let rustCrypto: RustCrypto;

        beforeEach(async () => {
            rustCrypto = await makeTestRustCrypto();
        });

        it("should pass through unencrypted to-device messages", async () => {
            const inputs: IToDeviceEvent[] = [
                { content: { key: "value" }, type: "org.matrix.test", sender: "@alice:example.com" },
            ];
            const res = await rustCrypto.preprocessToDeviceMessages(inputs);
            expect(res).toEqual(inputs);
        });

        it("should pass through bad encrypted messages", async () => {
            const olmMachine: OlmMachine = rustCrypto["olmMachine"];
            const keys = olmMachine.identityKeys;
            const inputs: IToDeviceEvent[] = [
                {
                    type: "m.room.encrypted",
                    content: {
                        algorithm: "m.olm.v1.curve25519-aes-sha2",
                        sender_key: "IlRMeOPX2e0MurIyfWEucYBRVOEEUMrOHqn/8mLqMjA",
                        ciphertext: {
                            [keys.curve25519.toBase64()]: {
                                type: 0,
                                body: "ajyjlghi",
                            },
                        },
                    },
                    sender: "@alice:example.com",
                },
            ];

            const res = await rustCrypto.preprocessToDeviceMessages(inputs);
            expect(res).toEqual(inputs);
        });
    });

    it("getCrossSigningKeyId", async () => {
        const rustCrypto = await makeTestRustCrypto();
        await expect(rustCrypto.getCrossSigningKeyId()).resolves.toBe(null);
    });

    it("bootstrapCrossSigning delegates to CrossSigningIdentity", async () => {
        const rustCrypto = await makeTestRustCrypto();
        const mockCrossSigningIdentity = {
            bootstrapCrossSigning: jest.fn().mockResolvedValue(undefined),
        };
        // @ts-ignore private property
        rustCrypto.crossSigningIdentity = mockCrossSigningIdentity;
        await rustCrypto.bootstrapCrossSigning({});
        expect(mockCrossSigningIdentity.bootstrapCrossSigning).toHaveBeenCalledWith({});
    });

    it("isSecretStorageReady", async () => {
        const rustCrypto = await makeTestRustCrypto();
        await expect(rustCrypto.isSecretStorageReady()).resolves.toBe(false);
    });

    describe("outgoing requests", () => {
        /** the RustCrypto implementation under test */
        let rustCrypto: RustCrypto;

        /** A mock OutgoingRequestProcessor which rustCrypto is connected to */
        let outgoingRequestProcessor: Mocked<OutgoingRequestProcessor>;

        /** a mocked-up OlmMachine which rustCrypto is connected to */
        let olmMachine: Mocked<RustSdkCryptoJs.OlmMachine>;

        /** A list of results to be returned from olmMachine.outgoingRequest. Each call will shift a result off
         *  the front of the queue, until it is empty. */
        let outgoingRequestQueue: Array<Array<any>>;

        /** wait for a call to outgoingRequestProcessor.makeOutgoingRequest.
         *
         * The promise resolves to a callback: the makeOutgoingRequest call will not complete until the returned
         * callback is called.
         */
        function awaitCallToMakeOutgoingRequest(): Promise<() => void> {
            return new Promise<() => void>((resolveCalledPromise, _reject) => {
                outgoingRequestProcessor.makeOutgoingRequest.mockImplementationOnce(async () => {
                    const completePromise = new Promise<void>((resolveCompletePromise, _reject) => {
                        resolveCalledPromise(resolveCompletePromise);
                    });
                    return completePromise;
                });
            });
        }

        beforeEach(async () => {
            await RustSdkCryptoJs.initAsync();

            // for these tests we use a mock OlmMachine, with an implementation of outgoingRequests that
            // returns objects from outgoingRequestQueue
            outgoingRequestQueue = [];
            olmMachine = {
                outgoingRequests: jest.fn().mockImplementation(() => {
                    return Promise.resolve(outgoingRequestQueue.shift() ?? []);
                }),
                close: jest.fn(),
            } as unknown as Mocked<RustSdkCryptoJs.OlmMachine>;

            outgoingRequestProcessor = {
                makeOutgoingRequest: jest.fn(),
            } as unknown as Mocked<OutgoingRequestProcessor>;

            rustCrypto = new RustCrypto(
                olmMachine,
                {} as MatrixHttpApi<any>,
                TEST_USER,
                TEST_DEVICE_ID,
                {} as ServerSideSecretStorage,
            );
            rustCrypto["outgoingRequestProcessor"] = outgoingRequestProcessor;
        });

        it("should poll for outgoing messages and send them", async () => {
            const testReq = new KeysQueryRequest("1234", "{}");
            outgoingRequestQueue.push([testReq]);

            const makeRequestPromise = awaitCallToMakeOutgoingRequest();
            rustCrypto.onSyncCompleted({});

            await makeRequestPromise;
            expect(olmMachine.outgoingRequests).toHaveBeenCalled();
            expect(outgoingRequestProcessor.makeOutgoingRequest).toHaveBeenCalledWith(testReq);
        });

        it("stops looping when stop() is called", async () => {
            for (let i = 0; i < 5; i++) {
                outgoingRequestQueue.push([new KeysQueryRequest("1234", "{}")]);
            }

            let makeRequestPromise = awaitCallToMakeOutgoingRequest();

            rustCrypto.onSyncCompleted({});

            expect(rustCrypto["outgoingRequestLoopRunning"]).toBeTruthy();

            // go a couple of times round the loop
            let resolveMakeRequest = await makeRequestPromise;
            makeRequestPromise = awaitCallToMakeOutgoingRequest();
            resolveMakeRequest();

            resolveMakeRequest = await makeRequestPromise;
            makeRequestPromise = awaitCallToMakeOutgoingRequest();
            resolveMakeRequest();

            // a second sync while this is going on shouldn't make any difference
            rustCrypto.onSyncCompleted({});

            resolveMakeRequest = await makeRequestPromise;
            outgoingRequestProcessor.makeOutgoingRequest.mockReset();
            resolveMakeRequest();

            // now stop...
            rustCrypto.stop();

            // which should (eventually) cause the loop to stop with no further calls to outgoingRequests
            olmMachine.outgoingRequests.mockReset();

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
            expect(rustCrypto["outgoingRequestLoopRunning"]).toBeFalsy();
            expect(outgoingRequestProcessor.makeOutgoingRequest).not.toHaveBeenCalled();
            expect(olmMachine.outgoingRequests).not.toHaveBeenCalled();

            // we sent three, so there should be 2 left
            expect(outgoingRequestQueue.length).toEqual(2);
        });
    });

    describe(".getEventEncryptionInfo", () => {
        let rustCrypto: RustCrypto;

        beforeEach(async () => {
            rustCrypto = await makeTestRustCrypto();
        });

        it("should handle unencrypted events", () => {
            const event = mkEvent({ event: true, type: "m.room.message", content: { body: "xyz" } });
            const res = rustCrypto.getEventEncryptionInfo(event);
            expect(res.encrypted).toBeFalsy();
        });

        it("should handle encrypted events", async () => {
            const event = mkEvent({ event: true, type: "m.room.encrypted", content: { algorithm: "fake_alg" } });
            const mockCryptoBackend = {
                decryptEvent: () =>
                    ({
                        senderCurve25519Key: "1234",
                    } as IEventDecryptionResult),
            } as unknown as CryptoBackend;
            await event.attemptDecryption(mockCryptoBackend);

            const res = rustCrypto.getEventEncryptionInfo(event);
            expect(res.encrypted).toBeTruthy();
        });
    });

    describe("get|setTrustCrossSignedDevices", () => {
        let rustCrypto: RustCrypto;

        beforeEach(async () => {
            rustCrypto = await makeTestRustCrypto();
        });

        it("should be true by default", () => {
            expect(rustCrypto.getTrustCrossSignedDevices()).toBe(true);
        });

        it("should be easily turn-off-and-on-able", () => {
            rustCrypto.setTrustCrossSignedDevices(false);
            expect(rustCrypto.getTrustCrossSignedDevices()).toBe(false);
            rustCrypto.setTrustCrossSignedDevices(true);
            expect(rustCrypto.getTrustCrossSignedDevices()).toBe(true);
        });
    });

    describe("getDeviceVerificationStatus", () => {
        let rustCrypto: RustCrypto;
        let olmMachine: Mocked<RustSdkCryptoJs.OlmMachine>;

        beforeEach(() => {
            olmMachine = {
                getDevice: jest.fn(),
            } as unknown as Mocked<RustSdkCryptoJs.OlmMachine>;
            rustCrypto = new RustCrypto(
                olmMachine,
                {} as MatrixClient["http"],
                TEST_USER,
                TEST_DEVICE_ID,
                {} as ServerSideSecretStorage,
            );
        });

        it("should call getDevice", async () => {
            olmMachine.getDevice.mockResolvedValue({
                isCrossSigningTrusted: jest.fn().mockReturnValue(false),
                isLocallyTrusted: jest.fn().mockReturnValue(false),
                isCrossSignedByOwner: jest.fn().mockReturnValue(false),
            } as unknown as RustSdkCryptoJs.Device);
            const res = await rustCrypto.getDeviceVerificationStatus("@user:domain", "device");
            expect(olmMachine.getDevice.mock.calls[0][0].toString()).toEqual("@user:domain");
            expect(olmMachine.getDevice.mock.calls[0][1].toString()).toEqual("device");
            expect(res?.crossSigningVerified).toBe(false);
            expect(res?.localVerified).toBe(false);
            expect(res?.signedByOwner).toBe(false);
        });

        it("should return null for unknown device", async () => {
            olmMachine.getDevice.mockResolvedValue(undefined);
            const res = await rustCrypto.getDeviceVerificationStatus("@user:domain", "device");
            expect(res).toBe(null);
        });
    });

    describe("createRecoveryKeyFromPassphrase", () => {
        let rustCrypto: RustCrypto;

        beforeEach(async () => {
            rustCrypto = await makeTestRustCrypto();
        });

        it("should create a recovery key without password", async () => {
            const recoveryKey = await rustCrypto.createRecoveryKeyFromPassphrase();

            // Expected the encoded private key to have 59 chars
            expect(recoveryKey.encodedPrivateKey?.length).toBe(59);
            // Expect the private key to be an Uint8Array with a length of 32
            expect(recoveryKey.privateKey).toBeInstanceOf(Uint8Array);
            expect(recoveryKey.privateKey.length).toBe(32);
            // Expect keyInfo to be empty
            expect(Object.keys(recoveryKey.keyInfo!).length).toBe(0);
        });

        it("should create a recovery key with password", async () => {
            const recoveryKey = await rustCrypto.createRecoveryKeyFromPassphrase("my password");

            // Expected the encoded private key to have 59 chars
            expect(recoveryKey.encodedPrivateKey?.length).toBe(59);
            // Expect the private key to be an Uint8Array with a length of 32
            expect(recoveryKey.privateKey).toBeInstanceOf(Uint8Array);
            expect(recoveryKey.privateKey.length).toBe(32);
            // Expect keyInfo.passphrase to be filled
            expect(recoveryKey.keyInfo?.passphrase?.algorithm).toBe("m.pbkdf2");
            expect(recoveryKey.keyInfo?.passphrase?.iterations).toBe(500000);
        });
    });
});

/** build a basic RustCrypto instance for testing
 *
 * just provides default arguments for initRustCrypto()
 */
async function makeTestRustCrypto(
    http: MatrixHttpApi<IHttpOpts & { onlyData: true }> = {} as MatrixClient["http"],
    userId: string = TEST_USER,
    deviceId: string = TEST_DEVICE_ID,
    secretStorage: ServerSideSecretStorage = {} as ServerSideSecretStorage,
): Promise<RustCrypto> {
    return await initRustCrypto(http, userId, deviceId, secretStorage);
}
