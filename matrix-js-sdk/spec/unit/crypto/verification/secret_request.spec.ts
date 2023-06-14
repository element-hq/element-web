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

import "../../../olm-loader";
import { MatrixClient, MatrixEvent } from "../../../../src/matrix";
import { encodeBase64 } from "../../../../src/crypto/olmlib";
import "../../../../src/crypto"; // import this to cycle-break
import { CrossSigningInfo } from "../../../../src/crypto/CrossSigning";
import { VerificationRequest } from "../../../../src/crypto/verification/request/VerificationRequest";
import { IVerificationChannel } from "../../../../src/crypto/verification/request/Channel";
import { VerificationBase } from "../../../../src/crypto/verification/Base";

jest.useFakeTimers();

// Private key for tests only
const testKey = new Uint8Array([
    0xda, 0x5a, 0x27, 0x60, 0xe3, 0x3a, 0xc5, 0x82, 0x9d, 0x12, 0xc3, 0xbe, 0xe8, 0xaa, 0xc2, 0xef, 0xae, 0xb1, 0x05,
    0xc1, 0xe7, 0x62, 0x78, 0xa6, 0xd7, 0x1f, 0xf8, 0x2c, 0x51, 0x85, 0xf0, 0x1d,
]);
const testKeyPub = "nqOvzeuGWT/sRx3h7+MHoInYj3Uk2LD/unI9kDYcHwk";

describe("self-verifications", () => {
    beforeAll(function () {
        return global.Olm.init();
    });

    it("triggers a request for key sharing upon completion", async () => {
        const userId = "@test:localhost";

        const cacheCallbacks = {
            getCrossSigningKeyCache: jest.fn().mockReturnValue(null),
            storeCrossSigningKeyCache: jest.fn(),
        };

        const crossSigningInfo = new CrossSigningInfo(userId, {}, cacheCallbacks);
        crossSigningInfo.keys = {
            master: {
                keys: { X: testKeyPub },
                usage: [],
                user_id: "user-id",
            },
            self_signing: {
                keys: { X: testKeyPub },
                usage: [],
                user_id: "user-id",
            },
            user_signing: {
                keys: { X: testKeyPub },
                usage: [],
                user_id: "user-id",
            },
        };

        const secretStorage = {
            request: jest.fn().mockReturnValue({
                promise: Promise.resolve(encodeBase64(testKey)),
            }),
        };

        const storeSessionBackupPrivateKey = jest.fn();
        const restoreKeyBackupWithCache = jest.fn(() => Promise.resolve());

        const client = {
            crypto: {
                crossSigningInfo,
                secretStorage,
                storeSessionBackupPrivateKey,
                getSessionBackupPrivateKey: () => null,
            },
            requestSecret: secretStorage.request.bind(secretStorage),
            getUserId: () => userId,
            getKeyBackupVersion: () => Promise.resolve({}),
            restoreKeyBackupWithCache,
        } as unknown as MatrixClient;

        const request = {
            onVerifierFinished: () => undefined,
        } as unknown as VerificationRequest;

        const verification = new VerificationBase(
            undefined as unknown as IVerificationChannel, // channel
            client, // baseApis
            userId,
            "ABC", // deviceId
            undefined as unknown as MatrixEvent, // startEvent
            request,
        );

        // @ts-ignore set private property
        verification.resolve = () => undefined;

        const result = await verification.done();

        /* We should request, and store, 3 cross signing keys and the key backup key */
        expect(cacheCallbacks.storeCrossSigningKeyCache.mock.calls.length).toBe(3);
        expect(secretStorage.request.mock.calls.length).toBe(4);

        expect(cacheCallbacks.storeCrossSigningKeyCache.mock.calls[0][1]).toEqual(testKey);
        expect(cacheCallbacks.storeCrossSigningKeyCache.mock.calls[1][1]).toEqual(testKey);

        expect(storeSessionBackupPrivateKey.mock.calls[0][0]).toEqual(testKey);

        expect(restoreKeyBackupWithCache).toHaveBeenCalled();

        expect(result).toBeInstanceOf(Array);
        expect(result![0][0]).toBe(testKeyPub);
        expect(result![1][0]).toBe(testKeyPub);
    });
});
