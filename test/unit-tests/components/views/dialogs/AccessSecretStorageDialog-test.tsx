/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { type SecretStorage, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { act, fireEvent, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { mockPlatformPeg, stubClient } from "../../../../test-utils";
import AccessSecretStorageDialog from "../../../../../src/components/views/dialogs/security/AccessSecretStorageDialog";

const securityKey = "EsTc WKmb ivvk jLS7 Y1NH 5CcQ mP1E JJwj B3Fd pFWm t4Dp dbyu";

describe("AccessSecretStorageDialog", () => {
    let mockClient: MatrixClient;

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
        mockClient = stubClient();
    });

    it("Closes the dialog when the form is submitted with a valid key", async () => {
        jest.spyOn(mockClient.secretStorage, "checkKey").mockResolvedValue(true);

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

        jest.spyOn(mockClient.secretStorage, "checkKey").mockImplementation(() => {
            throw new Error("invalid key");
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
                algorithm: "m.pbkdf2" as SecretStorage.PassphraseInfo["algorithm"],
                iterations: 2,
                salt: "nonempty",
            },
        };
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        renderComponent({ checkPrivateKey, keyInfo });

        await enterSecurityKey("Security Phrase");
        expect(screen.getByPlaceholderText("Security Phrase")).toHaveValue(securityKey);
        await submitDialog();

        await expect(
            screen.findByText(
                "👎 Unable to access secret storage. Please verify that you entered the correct Security Phrase.",
            ),
        ).resolves.toBeInTheDocument();

        expect(screen.getByPlaceholderText("Security Phrase")).toHaveFocus();
    });

    it("Can reset secret storage", async () => {
        jest.spyOn(mockClient.secretStorage, "checkKey").mockResolvedValue(true);

        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(true);
        renderComponent({ onFinished, checkPrivateKey });

        await userEvent.click(screen.getByText("Reset all"), { delay: null });

        // It will prompt the user to confirm resetting
        expect(screen.getByText("Reset everything")).toBeInTheDocument();
        await userEvent.click(screen.getByText("Reset"), { delay: null });

        // Then it will prompt the user to create a key/passphrase
        await screen.findByText("Set up Secure Backup");
        document.execCommand = jest.fn().mockReturnValue(true);
        jest.spyOn(mockClient.getCrypto()!, "createRecoveryKeyFromPassphrase").mockResolvedValue({
            privateKey: new Uint8Array(),
            encodedPrivateKey: securityKey,
        });
        screen.getByRole("button", { name: "Continue" }).click();

        await screen.findByText(/Save your Security Key/);
        screen.getByRole("button", { name: "Copy" }).click();
        await screen.findByText("Copied!");
        screen.getByRole("button", { name: "Continue" }).click();

        await screen.findByText("Secure Backup successful");
    });
});
