/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
            client.secretStorage.hasKey = jest.fn().mockResolvedValue(true);
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
                client.secretStorage.hasKey = jest.fn().mockResolvedValue(true);
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
