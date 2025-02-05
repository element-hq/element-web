/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { act } from "react";
import { Crypto } from "@peculiar/webcrypto";
import { type CryptoApi, deriveRecoveryKeyFromPassphrase } from "matrix-js-sdk/src/crypto-api";
import { SecretStorage } from "matrix-js-sdk/src/matrix";

import { accessSecretStorage, crossSigningCallbacks } from "../../src/SecurityManager";
import { filterConsole, stubClient } from "../test-utils";
import Modal from "../../src/Modal.tsx";
import {
    default as AccessSecretStorageDialog,
    type KeyParams,
} from "../../src/components/views/dialogs/security/AccessSecretStorageDialog.tsx";

jest.mock("react", () => {
    const React = jest.requireActual("react");
    React.lazy = (children: any) => children(); // stub out lazy for dialog test
    return React;
});

afterEach(() => {
    jest.restoreAllMocks();
});

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

        it("should show CreateSecretStorageDialog if forceReset=true", async () => {
            jest.mock("../../src/async-components/views/dialogs/security/CreateSecretStorageDialog", () => ({
                __test: true,
                __esModule: true,
                default: () => jest.fn(),
            }));
            const spy = jest.spyOn(Modal, "createDialog");
            stubClient();

            const func = jest.fn();
            accessSecretStorage(func, { forceReset: true });

            expect(spy).toHaveBeenCalledTimes(1);
            await expect(spy.mock.lastCall![0]).resolves.toEqual(expect.objectContaining({ __test: true }));
        });
    });

    describe("getSecretStorageKey", () => {
        const { getSecretStorageKey } = crossSigningCallbacks;

        /** Polyfill crypto.subtle, which is unavailable in jsdom */
        function polyFillSubtleCrypto() {
            Object.defineProperty(globalThis.crypto, "subtle", { value: new Crypto().subtle });
        }

        it("should prompt the user if the key is uncached", async () => {
            polyFillSubtleCrypto();

            const client = stubClient();
            mocked(client.secretStorage.getDefaultKeyId).mockResolvedValue("my_default_key");

            const passphrase = "s3cret";
            const { recoveryKey, keyInfo } = await deriveKeyFromPassphrase(passphrase);

            jest.spyOn(Modal, "createDialog").mockImplementation((component) => {
                expect(component).toBe(AccessSecretStorageDialog);

                const modalFunc = async () => [{ passphrase }] as [KeyParams];
                return {
                    finished: modalFunc(),
                    close: () => {},
                };
            });

            const [keyId, key] = (await act(() =>
                getSecretStorageKey!({ keys: { my_default_key: keyInfo } }, "my_secret"),
            ))!;
            expect(keyId).toEqual("my_default_key");
            expect(key).toEqual(recoveryKey);
        });

        it("should not prompt the user if the requested key is not the default", async () => {
            const client = stubClient();
            mocked(client.secretStorage.getDefaultKeyId).mockResolvedValue("my_default_key");
            const createDialogSpy = jest.spyOn(Modal, "createDialog");

            await expect(
                act(() =>
                    getSecretStorageKey!(
                        { keys: { other_key: {} as SecretStorage.SecretStorageKeyDescription } },
                        "my_secret",
                    ),
                ),
            ).rejects.toThrow("Request for non-default 4S key");
            expect(createDialogSpy).not.toHaveBeenCalled();
        });
    });
});

/** Derive a key from a passphrase, also returning the KeyInfo */
async function deriveKeyFromPassphrase(
    passphrase: string,
): Promise<{ recoveryKey: Uint8Array; keyInfo: SecretStorage.SecretStorageKeyDescription }> {
    const salt = "SALTYGOODNESS";
    const iterations = 1000;

    const recoveryKey = await deriveRecoveryKeyFromPassphrase(passphrase, salt, iterations);

    const check = await SecretStorage.calculateKeyCheck(recoveryKey);
    return {
        recoveryKey,
        keyInfo: {
            iv: check.iv,
            mac: check.mac,
            algorithm: SecretStorage.SECRET_STORAGE_ALGORITHM_V1_AES,
            name: "",
            passphrase: {
                algorithm: "m.pbkdf2",
                iterations,
                salt,
            },
        },
    };
}
