/*
Copyright 2020, 2022 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps } from "react";
import { IPassphraseInfo } from "matrix-js-sdk/src/crypto/api";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { Mocked } from "jest-mock";

import { getMockClientWithEventEmitter, mockPlatformPeg } from "../../../test-utils";
import AccessSecretStorageDialog from "../../../../src/components/views/dialogs/security/AccessSecretStorageDialog";

const securityKey = "EsTc WKmb ivvk jLS7 Y1NH 5CcQ mP1E JJwj B3Fd pFWm t4Dp dbyu";

describe("AccessSecretStorageDialog", () => {
    let mockClient: Mocked<MatrixClient>;

    const defaultProps: ComponentProps<typeof AccessSecretStorageDialog> = {
        keyInfo: {} as any,
        onFinished: jest.fn(),
        checkPrivateKey: jest.fn(),
    };

    const renderComponent = (props = {}): void => {
        render(<AccessSecretStorageDialog {...defaultProps} {...props} />);
    };

    const enterSecurityKey = (placeholder = "Security Key"): void => {
        act(() => {
            fireEvent.change(screen.getByPlaceholderText(placeholder), {
                target: {
                    value: securityKey,
                },
            });
            // wait for debounce
            jest.advanceTimersByTime(250);
        });
    };

    const submitDialog = async (): Promise<void> => {
        await userEvent.click(screen.getByText("Continue"), { delay: null });
    };

    beforeAll(() => {
        jest.useFakeTimers();
        mockPlatformPeg();
    });

    afterAll(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            keyBackupKeyFromRecoveryKey: jest.fn(),
            checkSecretStorageKey: jest.fn(),
            isValidRecoveryKey: jest.fn(),
        });
    });

    it("Closes the dialog when the form is submitted with a valid key", async () => {
        mockClient.checkSecretStorageKey.mockResolvedValue(true);
        mockClient.isValidRecoveryKey.mockReturnValue(true);

        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        renderComponent({ onFinished, checkPrivateKey });

        // check that the input field is focused
        expect(screen.getByPlaceholderText("Security Key")).toHaveFocus();

        await enterSecurityKey();
        await submitDialog();

        expect(screen.getByText("Looks good!")).toBeInTheDocument();
        expect(checkPrivateKey).toHaveBeenCalledWith({ recoveryKey: securityKey });
        expect(onFinished).toHaveBeenCalledWith({ recoveryKey: securityKey });
    });

    it("Notifies the user if they input an invalid Security Key", async () => {
        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        renderComponent({ onFinished, checkPrivateKey });

        mockClient.keyBackupKeyFromRecoveryKey.mockImplementation(() => {
            throw new Error("that's no key");
        });

        await enterSecurityKey();
        await submitDialog();

        expect(screen.getByText("Continue")).toBeDisabled();
        expect(screen.getByText("Invalid Security Key")).toBeInTheDocument();
    });

    it("Notifies the user if they input an invalid passphrase", async function () {
        const keyInfo = {
            name: "test",
            algorithm: "test",
            iv: "test",
            mac: "1:2:3:4",
            passphrase: {
                // this type is weird in js-sdk
                // cast 'm.pbkdf2' to itself
                algorithm: "m.pbkdf2" as IPassphraseInfo["algorithm"],
                iterations: 2,
                salt: "nonempty",
            },
        };
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        renderComponent({ checkPrivateKey, keyInfo });
        mockClient.isValidRecoveryKey.mockReturnValue(false);

        await enterSecurityKey("Security Phrase");
        expect(screen.getByPlaceholderText("Security Phrase")).toHaveValue(securityKey);
        await submitDialog();

        expect(
            screen.getByText(
                "👎 Unable to access secret storage. Please verify that you entered the correct Security Phrase.",
            ),
        ).toBeInTheDocument();

        expect(screen.getByPlaceholderText("Security Phrase")).toHaveFocus();
    });
});
