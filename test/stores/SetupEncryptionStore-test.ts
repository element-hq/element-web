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
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { SdkContextClass } from "../../src/contexts/SDKContext";
import { accessSecretStorage } from "../../src/SecurityManager";
import { SetupEncryptionStore } from "../../src/stores/SetupEncryptionStore";
import { stubClient } from "../test-utils";

jest.mock("../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("SetupEncryptionStore", () => {
    const cachedPassword = "p4assword";
    let client: Mocked<MatrixClient>;
    let setupEncryptionStore: SetupEncryptionStore;

    beforeEach(() => {
        client = mocked(stubClient());
        setupEncryptionStore = new SetupEncryptionStore();
        SdkContextClass.instance.accountPasswordStore.setPassword(cachedPassword);
    });

    afterEach(() => {
        SdkContextClass.instance.accountPasswordStore.clearPassword();
    });

    it("resetConfirm should work with a cached account password", async () => {
        const makeRequest = jest.fn();
        client.hasSecretStorageKey.mockResolvedValue(true);
        client.bootstrapCrossSigning.mockImplementation(async (opts: IBootstrapCrossSigningOpts) => {
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
