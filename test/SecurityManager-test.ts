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

import { mocked } from "jest-mock";
import { CryptoApi } from "matrix-js-sdk/src/crypto-api";

import { accessSecretStorage } from "../src/SecurityManager";
import { filterConsole, stubClient } from "./test-utils";

describe("SecurityManager", () => {
    describe("accessSecretStorage", () => {
        filterConsole("Not setting dehydration key: no SSSS key found");

        it("runs the function passed in", async () => {
            // Given a client
            const crypto = {
                bootstrapCrossSigning: () => {},
                bootstrapSecretStorage: () => {},
            } as unknown as CryptoApi;
            const client = stubClient();
            mocked(client.hasSecretStorageKey).mockResolvedValue(true);
            mocked(client.getCrypto).mockReturnValue(crypto);

            // When I run accessSecretStorage
            const func = jest.fn();
            await accessSecretStorage(func);

            // Then we call the passed-in function
            expect(func).toHaveBeenCalledTimes(1);
        });

        describe("expecting errors", () => {
            filterConsole("End-to-end encryption is disabled - unable to access secret storage");

            it("throws if crypto is unavailable", async () => {
                // Given a client with no crypto
                const client = stubClient();
                mocked(client.hasSecretStorageKey).mockResolvedValue(true);
                mocked(client.getCrypto).mockReturnValue(undefined);

                // When I run accessSecretStorage
                // Then we throw an error
                await expect(async () => {
                    await accessSecretStorage(jest.fn());
                }).rejects.toThrow("End-to-end encryption is disabled - unable to access secret storage");
            });
        });
    });
});
