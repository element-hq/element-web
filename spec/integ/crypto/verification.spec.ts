/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import fetchMock from "fetch-mock-jest";
import { MockResponse } from "fetch-mock";

import { createClient, CryptoEvent, MatrixClient } from "../../../src";
import { ShowQrCodeCallbacks, ShowSasCallbacks, Verifier, VerifierEvent } from "../../../src/crypto-api/verification";
import { escapeRegExp } from "../../../src/utils";
import { CRYPTO_BACKENDS, emitPromise, InitCrypto } from "../../test-utils/test-utils";
import { SyncResponder } from "../../test-utils/SyncResponder";
import {
    MASTER_CROSS_SIGNING_PUBLIC_KEY_BASE64,
    SIGNED_CROSS_SIGNING_KEYS_DATA,
    SIGNED_TEST_DEVICE_DATA,
    TEST_DEVICE_ID,
    TEST_DEVICE_PUBLIC_ED25519_KEY_BASE64,
    TEST_USER_ID,
} from "../../test-utils/test-data";
import { mockInitialApiRequests } from "../../test-utils/mockEndpoints";
import {
    Phase,
    VerificationRequest,
    VerificationRequestEvent,
} from "../../../src/crypto/verification/request/VerificationRequest";

// The verification flows use javascript timers to set timeouts. We tell jest to use mock timer implementations
// to ensure that we don't end up with dangling timeouts.
jest.useFakeTimers();

let previousCrypto: Crypto | undefined;

beforeAll(() => {
    // Stub out global.crypto
    previousCrypto = global["crypto"];

    Object.defineProperty(global, "crypto", {
        value: {
            getRandomValues: function <T extends Uint8Array>(array: T): T {
                array.fill(0x12);
                return array;
            },
        },
    });
});

// restore the original global.crypto
afterAll(() => {
    if (previousCrypto === undefined) {
        // @ts-ignore deleting a non-optional property. It *is* optional really.
        delete global.crypto;
    } else {
        Object.defineProperty(global, "crypto", {
            value: previousCrypto,
        });
    }
});

/**
 * Integration tests for verification functionality.
 *
 * These tests work by intercepting HTTP requests via fetch-mock rather than mocking out bits of the client, so as
 * to provide the most effective integration tests possible.
 */
describe.each(Object.entries(CRYPTO_BACKENDS))("verification (%s)", (backend: string, initCrypto: InitCrypto) => {
    // oldBackendOnly is an alternative to `it` or `test` which will skip the test if we are running against the
    // Rust backend. Once we have full support in the rust sdk, it will go away.
    const oldBackendOnly = backend === "rust-sdk" ? test.skip : test;

    /** the client under test */
    let aliceClient: MatrixClient;

    /** an object which intercepts `/sync` requests from {@link #aliceClient} */
    let syncResponder: SyncResponder;

    beforeEach(async () => {
        // anything that we don't have a specific matcher for silently returns a 404
        fetchMock.catch(404);
        fetchMock.config.warnOnFallback = false;

        const homeserverUrl = "https://alice-server.com";
        aliceClient = createClient({
            baseUrl: homeserverUrl,
            userId: TEST_USER_ID,
            accessToken: "akjgkrgjs",
            deviceId: "device_under_test",
        });

        await initCrypto(aliceClient);
    });

    afterEach(async () => {
        await aliceClient.stopClient();
        fetchMock.mockReset();
    });

    beforeEach(() => {
        syncResponder = new SyncResponder(aliceClient.getHomeserverUrl());
        mockInitialApiRequests(aliceClient.getHomeserverUrl());
        aliceClient.startClient();
    });

    oldBackendOnly("Outgoing verification: can verify another device via SAS", async () => {
        // expect requests to download our own keys
        fetchMock.post(new RegExp("/_matrix/client/(r0|v3)/keys/query"), {
            device_keys: {
                [TEST_USER_ID]: {
                    [TEST_DEVICE_ID]: SIGNED_TEST_DEVICE_DATA,
                },
            },
        });

        // have alice initiate a verification. She should send a m.key.verification.request
        let [requestBody, request] = await Promise.all([
            expectSendToDeviceMessage("m.key.verification.request"),
            aliceClient.requestVerification(TEST_USER_ID, [TEST_DEVICE_ID]),
        ]);
        const transactionId = request.transactionId;
        expect(transactionId).toBeDefined();
        expect(request.phase).toEqual(Phase.Requested);
        expect(request.roomId).toBeUndefined();

        let toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
        expect(toDeviceMessage.methods).toContain("m.sas.v1");
        expect(toDeviceMessage.from_device).toEqual(aliceClient.deviceId);
        expect(toDeviceMessage.transaction_id).toEqual(transactionId);

        // The dummy device replies with an m.key.verification.ready...
        returnToDeviceMessageFromSync({
            type: "m.key.verification.ready",
            content: {
                from_device: TEST_DEVICE_ID,
                methods: ["m.sas.v1"],
                transaction_id: transactionId,
            },
        });
        await waitForVerificationRequestChanged(request);
        expect(request.phase).toEqual(Phase.Ready);
        expect(request.otherDeviceId).toEqual(TEST_DEVICE_ID);

        // ... and picks a method with m.key.verification.start
        returnToDeviceMessageFromSync({
            type: "m.key.verification.start",
            content: {
                from_device: TEST_DEVICE_ID,
                method: "m.sas.v1",
                transaction_id: transactionId,
                hashes: ["sha256"],
                key_agreement_protocols: ["curve25519"],
                message_authentication_codes: ["hkdf-hmac-sha256.v2"],
                short_authentication_string: ["emoji"],
            },
        });
        await waitForVerificationRequestChanged(request);
        expect(request.phase).toEqual(Phase.Started);
        expect(request.chosenMethod).toEqual("m.sas.v1");

        // there should now be a verifier
        const verifier: Verifier = request.verifier!;
        expect(verifier).toBeDefined();
        expect(verifier.getShowSasCallbacks()).toBeNull();

        // start off the verification process: alice will send an `accept`
        const verificationPromise = verifier.verify();
        // advance the clock, because the devicelist likes to sleep for 5ms during key downloads
        jest.advanceTimersByTime(10);

        requestBody = await expectSendToDeviceMessage("m.key.verification.accept");
        toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
        expect(toDeviceMessage.key_agreement_protocol).toEqual("curve25519");
        expect(toDeviceMessage.short_authentication_string).toEqual(["emoji"]);
        expect(toDeviceMessage.transaction_id).toEqual(transactionId);

        // The dummy device makes up a curve25519 keypair and sends the public bit back in an `m.key.verification.key'
        // We use the Curve25519, HMAC and HKDF implementations in libolm, for now
        const olmSAS = new global.Olm.SAS();
        returnToDeviceMessageFromSync({
            type: "m.key.verification.key",
            content: {
                transaction_id: transactionId,
                key: olmSAS.get_pubkey(),
            },
        });

        // alice responds with a 'key' ...
        requestBody = await expectSendToDeviceMessage("m.key.verification.key");
        toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
        expect(toDeviceMessage.transaction_id).toEqual(transactionId);
        const aliceDevicePubKeyBase64 = toDeviceMessage.key;
        olmSAS.set_their_key(aliceDevicePubKeyBase64);

        // ... and the client is notified to show the emoji
        const showSas = await new Promise<ShowSasCallbacks>((resolve) => {
            verifier.once(VerifierEvent.ShowSas, resolve);
        });

        // `getShowSasCallbacks` is an alternative way to get the callbacks
        expect(verifier.getShowSasCallbacks()).toBe(showSas);
        expect(verifier.getReciprocateQrCodeCallbacks()).toBeNull();

        // user confirms that the emoji match, and alice sends a 'mac'
        [requestBody] = await Promise.all([expectSendToDeviceMessage("m.key.verification.mac"), showSas.confirm()]);
        toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
        expect(toDeviceMessage.transaction_id).toEqual(transactionId);

        // the dummy device also confirms that the emoji match, and sends a mac
        const macInfoBase = `MATRIX_KEY_VERIFICATION_MAC${TEST_USER_ID}${TEST_DEVICE_ID}${TEST_USER_ID}${aliceClient.deviceId}${transactionId}`;
        returnToDeviceMessageFromSync({
            type: "m.key.verification.mac",
            content: {
                keys: calculateMAC(olmSAS, `ed25519:${TEST_DEVICE_ID}`, `${macInfoBase}KEY_IDS`),
                transaction_id: transactionId,
                mac: {
                    [`ed25519:${TEST_DEVICE_ID}`]: calculateMAC(
                        olmSAS,
                        TEST_DEVICE_PUBLIC_ED25519_KEY_BASE64,
                        `${macInfoBase}ed25519:${TEST_DEVICE_ID}`,
                    ),
                },
            },
        });

        // that should satisfy Alice, who should reply with a 'done'
        await expectSendToDeviceMessage("m.key.verification.done");

        // ... and the whole thing should be done!
        await verificationPromise;
        expect(request.phase).toEqual(Phase.Done);

        // we're done with the temporary keypair
        olmSAS.free();
    });

    oldBackendOnly(
        "Outgoing verification: can verify another device via QR code with an untrusted cross-signing key",
        async () => {
            // expect requests to download our own keys
            fetchMock.post(new RegExp("/_matrix/client/(r0|v3)/keys/query"), {
                device_keys: {
                    [TEST_USER_ID]: {
                        [TEST_DEVICE_ID]: SIGNED_TEST_DEVICE_DATA,
                    },
                },
                ...SIGNED_CROSS_SIGNING_KEYS_DATA,
            });

            // QRCode fails if we don't yet have the cross-signing keys, so make sure we have them now.
            //
            // Completing the initial sync will make the device list download outdated device lists (of which our own
            // user will be one).
            syncResponder.sendOrQueueSyncResponse({});
            // DeviceList has a sleep(5) which we need to make happen
            await jest.advanceTimersByTimeAsync(10);
            expect(aliceClient.getStoredCrossSigningForUser(TEST_USER_ID)).toBeTruthy();

            // have alice initiate a verification. She should send a m.key.verification.request
            const [requestBody, request] = await Promise.all([
                expectSendToDeviceMessage("m.key.verification.request"),
                aliceClient.requestVerification(TEST_USER_ID, [TEST_DEVICE_ID]),
            ]);
            const transactionId = request.transactionId;

            const toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
            expect(toDeviceMessage.methods).toContain("m.qr_code.show.v1");
            expect(toDeviceMessage.methods).toContain("m.qr_code.scan.v1");
            expect(toDeviceMessage.methods).toContain("m.reciprocate.v1");
            expect(toDeviceMessage.from_device).toEqual(aliceClient.deviceId);
            expect(toDeviceMessage.transaction_id).toEqual(transactionId);

            // The dummy device replies with an m.key.verification.ready, with an indication we can scan the QR code
            returnToDeviceMessageFromSync({
                type: "m.key.verification.ready",
                content: {
                    from_device: TEST_DEVICE_ID,
                    methods: ["m.qr_code.scan.v1"],
                    transaction_id: transactionId,
                },
            });
            await waitForVerificationRequestChanged(request);
            expect(request.phase).toEqual(Phase.Ready);

            // we should now have QR data we can display
            const qrCodeBuffer = request.getQRCodeBytes()!;
            expect(qrCodeBuffer).toBeTruthy();

            // https://spec.matrix.org/v1.7/client-server-api/#qr-code-format
            expect(qrCodeBuffer.subarray(0, 6).toString("latin1")).toEqual("MATRIX");
            expect(qrCodeBuffer.readUint8(6)).toEqual(0x02); // version
            expect(qrCodeBuffer.readUint8(7)).toEqual(0x02); // mode
            const txnIdLen = qrCodeBuffer.readUint16BE(8);
            expect(qrCodeBuffer.subarray(10, 10 + txnIdLen).toString("utf-8")).toEqual(transactionId);
            // Alice's device's public key comes next, but we have nothing to do with it here.
            // const aliceDevicePubKey = qrCodeBuffer.subarray(10 + txnIdLen, 32 + 10 + txnIdLen);
            expect(qrCodeBuffer.subarray(42 + txnIdLen, 32 + 42 + txnIdLen)).toEqual(
                Buffer.from(MASTER_CROSS_SIGNING_PUBLIC_KEY_BASE64, "base64"),
            );
            const sharedSecret = qrCodeBuffer.subarray(74 + txnIdLen);

            // the dummy device "scans" the displayed QR code and acknowledges it with a "m.key.verification.start"
            returnToDeviceMessageFromSync({
                type: "m.key.verification.start",
                content: {
                    from_device: TEST_DEVICE_ID,
                    method: "m.reciprocate.v1",
                    transaction_id: transactionId,
                    secret: encodeUnpaddedBase64(sharedSecret),
                },
            });
            await waitForVerificationRequestChanged(request);
            expect(request.phase).toEqual(Phase.Started);
            expect(request.chosenMethod).toEqual("m.reciprocate.v1");

            // there should now be a verifier
            const verifier: Verifier = request.verifier!;
            expect(verifier).toBeDefined();
            expect(verifier.getReciprocateQrCodeCallbacks()).toBeNull();

            // ... which we call .verify on, which emits a ShowReciprocateQr event
            const verificationPromise = verifier.verify();
            const reciprocateQRCodeCallbacks = await new Promise<ShowQrCodeCallbacks>((resolve) => {
                verifier.once(VerifierEvent.ShowReciprocateQr, resolve);
            });

            // getReciprocateQrCodeCallbacks() is an alternative way to get the callbacks
            expect(verifier.getReciprocateQrCodeCallbacks()).toBe(reciprocateQRCodeCallbacks);
            expect(verifier.getShowSasCallbacks()).toBeNull();

            // Alice confirms she is happy
            reciprocateQRCodeCallbacks.confirm();

            // that should satisfy Alice, who should reply with a 'done'
            await expectSendToDeviceMessage("m.key.verification.done");

            // ... and the whole thing should be done!
            await verificationPromise;
            expect(request.phase).toEqual(Phase.Done);
        },
    );

    oldBackendOnly("Incoming verification: can accept", async () => {
        // expect requests to download our own keys
        fetchMock.post(new RegExp("/_matrix/client/(r0|v3)/keys/query"), {
            device_keys: {
                [TEST_USER_ID]: {
                    [TEST_DEVICE_ID]: SIGNED_TEST_DEVICE_DATA,
                },
            },
        });

        const TRANSACTION_ID = "abcd";

        // Initiate the request by sending a to-device message
        returnToDeviceMessageFromSync({
            type: "m.key.verification.request",
            content: {
                from_device: TEST_DEVICE_ID,
                methods: ["m.sas.v1"],
                transaction_id: TRANSACTION_ID,
                timestamp: Date.now() - 1000,
            },
        });
        const request: VerificationRequest = await emitPromise(aliceClient, CryptoEvent.VerificationRequest);
        expect(request.transactionId).toEqual(TRANSACTION_ID);
        expect(request.phase).toEqual(Phase.Requested);
        expect(request.roomId).toBeUndefined();
        expect(request.canAccept).toBe(true);

        // Alice accepts, by sending a to-device message
        const sendToDevicePromise = expectSendToDeviceMessage("m.key.verification.ready");
        const acceptPromise = request.accept();
        expect(request.canAccept).toBe(false);
        expect(request.phase).toEqual(Phase.Requested);
        await acceptPromise;
        const requestBody = await sendToDevicePromise;
        expect(request.phase).toEqual(Phase.Ready);

        const toDeviceMessage = requestBody.messages[TEST_USER_ID][TEST_DEVICE_ID];
        expect(toDeviceMessage.methods).toContain("m.sas.v1");
        expect(toDeviceMessage.from_device).toEqual(aliceClient.deviceId);
        expect(toDeviceMessage.transaction_id).toEqual(TRANSACTION_ID);
    });

    function returnToDeviceMessageFromSync(ev: { type: string; content: object; sender?: string }): void {
        ev.sender ??= TEST_USER_ID;
        syncResponder.sendOrQueueSyncResponse({ to_device: { events: [ev] } });
    }
});

/**
 * Wait for the client under test to send a to-device message of the given type.
 *
 * @param msgtype - type of to-device message we expect
 * @returns A Promise which resolves with the body of the HTTP request
 */
function expectSendToDeviceMessage(msgtype: string): Promise<{ messages: any }> {
    return new Promise((resolve) => {
        fetchMock.putOnce(
            new RegExp(`/_matrix/client/(r0|v3)/sendToDevice/${escapeRegExp(msgtype)}`),
            (url: string, opts: RequestInit): MockResponse => {
                resolve(JSON.parse(opts.body as string));
                return {};
            },
        );
    });
}

/** wait for the verification request to emit a 'Change' event */
function waitForVerificationRequestChanged(request: VerificationRequest): Promise<void> {
    return new Promise<void>((resolve) => {
        request.once(VerificationRequestEvent.Change, resolve);
    });
}

/** Perform a MAC calculation on the given data
 *
 * Does an HKDR and HMAC as defined by the matrix spec (https://spec.matrix.org/v1.7/client-server-api/#mac-calculation,
 * as amended by https://github.com/matrix-org/matrix-spec/issues/1553).
 *
 * @param olmSAS
 * @param input
 * @param info
 */
function calculateMAC(olmSAS: Olm.SAS, input: string, info: string): string {
    const mac = olmSAS.calculate_mac_fixed_base64(input, info);
    //console.info(`Test MAC: input:'${input}, info: '${info}' -> '${mac}`);
    return mac;
}

function encodeUnpaddedBase64(uint8Array: ArrayBuffer | Uint8Array): string {
    return Buffer.from(uint8Array).toString("base64").replace(/=+$/g, "");
}
