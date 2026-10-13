/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { type ComponentProps } from "react";
import { type SecretStorage, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { act, fireEvent, render, screen } from "test-utils-rtl";
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { mockPlatformPeg, stubClient } from "test-utils";
import AccessSecretStorageDialog from "./AccessSecretStorageDialog";

const recoveryKey = "EsTc WKmb ivvk jLS7 Y1NH 5CcQ mP1E JJwj B3Fd pFWm t4Dp dbyu";

describe("AccessSecretStorageDialog", () => {
    let mockClient: MatrixClient;

    const defaultProps: ComponentProps<typeof AccessSecretStorageDialog> = {
        keyInfo: {} as any,
        onFinished: vi.fn(),
        checkPrivateKey: vi.fn(),
    };

    const renderComponent = (props = {}): void => {
        render(<AccessSecretStorageDialog {...defaultProps} {...props} />);
    };

    const enterRecoveryKey = async (valueToEnter: string = recoveryKey): Promise<void> => {
        await act(async () => {
            fireEvent.change(screen.getByTitle("Recovery key"), {
                target: {
                    value: valueToEnter,
                },
            });
            // wait for debounce, and then give `checkPrivateKey` a chance to complete
            await vi.advanceTimersByTimeAsync(250);
        });
    };

    const submitDialog = async (): Promise<void> => {
        await act(async () => {
            screen.getByText("Continue").click();
            await vi.runAllTimersAsync();
        });
    };

    beforeAll(() => {
        vi.useFakeTimers();
        mockPlatformPeg();
    });

    afterAll(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        mockClient = stubClient();
    });

    it("Closes the dialog when the form is submitted with a valid key", async () => {
        vi.spyOn(mockClient.secretStorage, "checkKey").mockResolvedValue(true);

        const onFinished = vi.fn();
        const checkPrivateKey = vi.fn().mockResolvedValue(true);
        renderComponent({ onFinished, checkPrivateKey });

        // check that the input field is focused
        expect(screen.getByTitle("Recovery key")).toHaveFocus();

        await enterRecoveryKey();
        await submitDialog();

        expect(screen.getByText("Continue")).not.toHaveAttribute("aria-disabled", "true");
        expect(checkPrivateKey).toHaveBeenCalledWith({ recoveryKey });
        expect(onFinished).toHaveBeenCalledWith({ recoveryKey });
    });

    it("Notifies the user if they input an invalid Recovery Key", async () => {
        const onFinished = vi.fn();
        const checkPrivateKey = vi.fn().mockResolvedValue(false);
        renderComponent({ onFinished, checkPrivateKey });

        vi.spyOn(mockClient.secretStorage, "checkKey").mockImplementation(() => {
            throw new Error("invalid key");
        });

        await enterRecoveryKey();
        await submitDialog();

        expect(screen.getByText("The recovery key you entered is not correct.")).toBeInTheDocument();
        expect(screen.getByText("Continue")).toHaveAttribute("aria-disabled", "true");
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
        const checkPrivateKey = vi.fn().mockResolvedValue(false);
        renderComponent({ checkPrivateKey, keyInfo });

        await enterRecoveryKey();
        expect(screen.getByTitle("Recovery key")).toHaveValue(recoveryKey);

        expect(screen.getByText("The recovery key you entered is not correct.")).toBeInTheDocument();
        expect(screen.getByText("Continue")).toHaveAttribute("aria-disabled", "true");
    });

    it("Clears the 'invalid recovery key' notice when the input is cleared", async function () {
        renderComponent({ onFinished: () => {}, checkPrivateKey: () => false });

        vi.spyOn(mockClient.secretStorage, "checkKey").mockRejectedValue(new Error("invalid key"));

        // First, enter the wrong recovery key
        await enterRecoveryKey();
        expect(screen.getByText("The recovery key you entered is not correct.")).toBeInTheDocument();

        // Now, clear the input: the notice should be cleared.
        await enterRecoveryKey("");
        expect(screen.queryByText("The recovery key you entered is not correct.")).not.toBeInTheDocument();
        expect(
            screen.getByText("If you have a security key or security phrase, this will work too."),
        ).toBeInTheDocument();
        expect(screen.getByText("Continue")).toHaveAttribute("aria-disabled", "true");
    });
});
