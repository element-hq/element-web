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

import { mocked, Mocked } from "jest-mock";
import { IBootstrapCrossSigningOpts } from "matrix-js-sdk/src/crypto";
import { CryptoApi, DeviceVerificationStatus, MatrixClient, Device } from "matrix-js-sdk/src/matrix";
import { SecretStorageKeyDescriptionAesV1, ServerSideSecretStorage } from "matrix-js-sdk/src/secret-storage";
import { IDehydratedDevice } from "matrix-js-sdk/src/crypto/dehydration";

import { SdkContextClass } from "../../src/contexts/SDKContext";
import { accessSecretStorage } from "../../src/SecurityManager";
import { SetupEncryptionStore } from "../../src/stores/SetupEncryptionStore";
import { emitPromise, stubClient } from "../test-utils";

jest.mock("../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("SetupEncryptionStore", () => {
    const cachedPassword = "p4assword";
    let client: Mocked<MatrixClient>;
    let mockCrypto: Mocked<CryptoApi>;
    let mockSecretStorage: Mocked<ServerSideSecretStorage>;
    let setupEncryptionStore: SetupEncryptionStore;

    beforeEach(() => {
        client = mocked(stubClient());
        mockCrypto = {
            bootstrapCrossSigning: jest.fn(),
            getCrossSigningKeyId: jest.fn(),
            getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
            getUserDeviceInfo: jest.fn(),
            getDeviceVerificationStatus: jest.fn(),
            isDehydrationSupported: jest.fn().mockResolvedValue(false),
            startDehydration: jest.fn(),
        } as unknown as Mocked<CryptoApi>;
        client.getCrypto.mockReturnValue(mockCrypto);

        mockSecretStorage = {
            isStored: jest.fn(),
        } as unknown as Mocked<ServerSideSecretStorage>;
        Object.defineProperty(client, "secretStorage", { value: mockSecretStorage });

        setupEncryptionStore = new SetupEncryptionStore();
        SdkContextClass.instance.accountPasswordStore.setPassword(cachedPassword);
    });

    afterEach(() => {
        SdkContextClass.instance.accountPasswordStore.clearPassword();
    });

    describe("start", () => {
        it("should fetch cross-signing and device info", async () => {
            const fakeKey = {} as SecretStorageKeyDescriptionAesV1;
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: fakeKey });

            const fakeDevice = new Device({ deviceId: "deviceId", userId: "", algorithms: [], keys: new Map() });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(
                new Map([[client.getSafeUserId(), new Map([[fakeDevice.deviceId, fakeDevice]])]]),
            );

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");

            // our fake device is not signed, so we can't verify against it
            expect(setupEncryptionStore.hasDevicesToVerifyAgainst).toBe(false);

            expect(setupEncryptionStore.keyId).toEqual("sskeyid");
            expect(setupEncryptionStore.keyInfo).toBe(fakeKey);
        });

        it("should spot a signed device", async () => {
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: {} as SecretStorageKeyDescriptionAesV1 });

            const fakeDevice = new Device({
                deviceId: "deviceId",
                userId: "",
                algorithms: [],
                keys: new Map([["curve25519:deviceId", "identityKey"]]),
            });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(
                new Map([[client.getSafeUserId(), new Map([[fakeDevice.deviceId, fakeDevice]])]]),
            );
            mockCrypto.getDeviceVerificationStatus.mockResolvedValue(
                new DeviceVerificationStatus({ signedByOwner: true }),
            );

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");

            expect(setupEncryptionStore.hasDevicesToVerifyAgainst).toBe(true);
        });

        it("should ignore the MSC2697 dehydrated device", async () => {
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: {} as SecretStorageKeyDescriptionAesV1 });

            client.getDehydratedDevice.mockResolvedValue({ device_id: "dehydrated" } as IDehydratedDevice);

            const fakeDevice = new Device({
                deviceId: "dehydrated",
                userId: "",
                algorithms: [],
                keys: new Map([["curve25519:dehydrated", "identityKey"]]),
            });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(
                new Map([[client.getSafeUserId(), new Map([[fakeDevice.deviceId, fakeDevice]])]]),
            );

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");

            expect(setupEncryptionStore.hasDevicesToVerifyAgainst).toBe(false);
            expect(mockCrypto.getDeviceVerificationStatus).not.toHaveBeenCalled();
        });

        it("should ignore the MSC3812 dehydrated device", async () => {
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: {} as SecretStorageKeyDescriptionAesV1 });

            const fakeDevice = new Device({
                deviceId: "dehydrated",
                userId: "",
                algorithms: [],
                keys: new Map([["curve25519:dehydrated", "identityKey"]]),
                dehydrated: true,
            });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(
                new Map([[client.getSafeUserId(), new Map([[fakeDevice.deviceId, fakeDevice]])]]),
            );

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");

            expect(setupEncryptionStore.hasDevicesToVerifyAgainst).toBe(false);
            expect(mockCrypto.getDeviceVerificationStatus).not.toHaveBeenCalled();
        });

        it("should correctly handle getUserDeviceInfo() returning an empty map", async () => {
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: {} as SecretStorageKeyDescriptionAesV1 });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(new Map());

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");
            expect(setupEncryptionStore.hasDevicesToVerifyAgainst).toBe(false);
        });
    });

    describe("usePassPhrase", () => {
        it("should use dehydration when enabled", async () => {
            // mocks for cross-signing and secret storage
            mockSecretStorage.isStored.mockResolvedValue({ sskeyid: {} as SecretStorageKeyDescriptionAesV1 });
            mockCrypto.getUserDeviceInfo.mockResolvedValue(new Map());
            mockCrypto.getDeviceVerificationStatus.mockResolvedValue(
                new DeviceVerificationStatus({ signedByOwner: true }),
            );
            mocked(accessSecretStorage).mockImplementation(async (func?: () => Promise<void>) => {
                await func!();
            });

            // mocks for dehydration
            mockCrypto.isDehydrationSupported.mockResolvedValue(true);
            const dehydrationPromise = new Promise<void>((resolve) => {
                // Dehydration gets processed in the background, after
                // `usePassPhrase` returns, so we need to use a promise to make
                // sure that it is called.
                mockCrypto.startDehydration.mockImplementation(async () => {
                    resolve();
                });
            });
            client.waitForClientWellKnown.mockResolvedValue({ "org.matrix.msc3814": true });

            setupEncryptionStore.start();
            await emitPromise(setupEncryptionStore, "update");

            await setupEncryptionStore.usePassPhrase();

            await dehydrationPromise;
        });
    });

    it("resetConfirm should work with a cached account password", async () => {
        const makeRequest = jest.fn();
        mockCrypto.bootstrapCrossSigning.mockImplementation(async (opts: IBootstrapCrossSigningOpts) => {
            await opts?.authUploadDeviceSigningKeys?.(makeRequest);
        });
        mocked(accessSecretStorage).mockImplementation(async (func?: () => Promise<void>) => {
            await func!();
        });

        await setupEncryptionStore.resetConfirm();

        expect(mocked(accessSecretStorage)).toHaveBeenCalledWith(expect.any(Function), true);
        expect(makeRequest).toHaveBeenCalledWith({
            identifier: {
                type: "m.id.user",
                user: "@userId:matrix.org",
            },
            password: cachedPassword,
            type: "m.login.password",
            user: "@userId:matrix.org",
        });
    });
});
