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

const recoveryKey = "EsTc WKmb ivvk jLS7 Y1NH 5CcQ mP1E JJwj B3Fd pFWm t4Dp dbyu";

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

    const enterRecoveryKey = (): void => {
        act(() => {
            fireEvent.change(screen.getByRole("textbox"), {
                target: {
                    value: recoveryKey,
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
        expect(screen.getByRole("textbox")).toHaveFocus();

        await enterRecoveryKey();
        await submitDialog();

        expect(screen.getByText("Continue")).not.toHaveAttribute("aria-disabled", "true");
        expect(checkPrivateKey).toHaveBeenCalledWith({ recoveryKey });
        expect(onFinished).toHaveBeenCalledWith({ recoveryKey });
    });

    it("Notifies the user if they input an invalid Recovery Key", async () => {
        const onFinished = jest.fn();
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        renderComponent({ onFinished, checkPrivateKey });

        jest.spyOn(mockClient.secretStorage, "checkKey").mockImplementation(() => {
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
        const checkPrivateKey = jest.fn().mockResolvedValue(false);
        renderComponent({ checkPrivateKey, keyInfo });

        await enterRecoveryKey();
        expect(screen.getByRole("textbox")).toHaveValue(recoveryKey);

        await expect(screen.findByText("The recovery key you entered is not correct.")).resolves.toBeInTheDocument();
        expect(screen.getByText("Continue")).toHaveAttribute("aria-disabled", "true");
    });
});
