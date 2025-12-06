/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import * as SecurityManager from "../../../src/SecurityManager";
import ToastContainer from "../../../src/components/structures/ToastContainer";
import { showToast } from "../../../src/toasts/SetupEncryptionToast";
import dis from "../../../src/dispatcher/dispatcher";
import DeviceListener, { DeviceState } from "../../../src/DeviceListener";
import Modal from "../../../src/Modal";
import ConfirmKeyStorageOffDialog from "../../../src/components/views/dialogs/ConfirmKeyStorageOffDialog";
import SetupEncryptionDialog from "../../../src/components/views/dialogs/security/SetupEncryptionDialog";
import { stubClient } from "../../test-utils";

jest.mock("../../../src/dispatcher/dispatcher", () => ({
    dispatch: jest.fn(),
    register: jest.fn(),
    unregister: jest.fn(),
}));

describe("SetupEncryptionToast", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        render(<ToastContainer />);
    });

    describe("Set up recovery", () => {
        it("should render the toast", async () => {
            act(() => showToast(DeviceState.SET_UP_RECOVERY));

            expect(await screen.findByRole("heading", { name: "Set up recovery" })).toBeInTheDocument();
        });

        it("should dismiss the toast when 'Dismiss' button clicked, and remember it", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "recordRecoveryDisabled");
            jest.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            act(() => showToast(DeviceState.SET_UP_RECOVERY));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Dismiss" }));

            expect(DeviceListener.sharedInstance().recordRecoveryDisabled).toHaveBeenCalled();
            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });
    });

    describe("Key storage out of sync", () => {
        let client: Mocked<MatrixClient>;

        beforeEach(() => {
            client = mocked(stubClient());
            mocked(client.getCrypto).mockReturnValue({
                getSessionBackupPrivateKey: jest.fn().mockResolvedValue(null),
                resetKeyBackup: jest.fn(),
                checkKeyBackupAndEnable: jest.fn(),
                loadSessionBackupPrivateKeyFromSecretStorage: jest.fn(),
            } as unknown as CryptoApi);
        });

        it("should render the toast", async () => {
            act(() => showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC));

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
        });

        it("should reset key backup if needed", async () => {
            showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC);

            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => {
                    return await func();
                },
            );

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(client.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
        });

        it("should not reset key backup if not needed", async () => {
            showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC);

            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => {
                    return await func();
                },
            );

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
            // if the backup key is stored in 4S
            client.isKeyBackupKeyStored.mockResolvedValue({});

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            // we shouldn't have reset the key backup, but should have fetched
            // the key from 4S
            expect(client.getCrypto()!.resetKeyBackup).not.toHaveBeenCalled();
            expect(client.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalled();
        });

        it("should open settings to the reset flow when 'forgot recovery key' clicked and identity reset needed", async () => {
            act(() => showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC));

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                true,
            );

            const user = userEvent.setup();
            await user.click(await screen.findByText("Forgot recovery key?"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_forgot" },
            });
        });

        it("should open settings to the change recovery key flow when 'forgot recovery key' clicked and identity reset not needed", async () => {
            act(() => showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC));

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                false,
            );

            const user = userEvent.setup();
            await user.click(await screen.findByText("Forgot recovery key?"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "change_recovery_key" },
            });
        });

        it("should open settings to the reset flow when recovering fails and identity reset needed", async () => {
            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                true,
            );

            act(() => showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC));

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_sync_failed" },
            });
        });

        it("should open settings to the change recovery key flow when recovering fails and identity reset not needed", async () => {
            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                false,
            );

            act(() => showToast(DeviceState.KEY_STORAGE_OUT_OF_SYNC));

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "change_recovery_key" },
            });
        });
    });

    describe("Turn on key storage", () => {
        it("should render the toast", async () => {
            act(() => showToast(DeviceState.TURN_ON_KEY_STORAGE));

            await expect(screen.findByText("Turn on key storage")).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Dismiss" })).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue" })).resolves.toBeInTheDocument();
        });

        it("should open settings to the Encryption tab when 'Continue' clicked", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "recordKeyBackupDisabled");

            act(() => showToast(DeviceState.TURN_ON_KEY_STORAGE));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Continue" }));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
            });

            expect(DeviceListener.sharedInstance().recordKeyBackupDisabled).not.toHaveBeenCalled();
        });

        it("should open the confirm key storage off dialog when 'Dismiss' clicked", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "recordKeyBackupDisabled");

            // Given that as soon as the dialog opens, it closes and says "yes they clicked dismiss"
            jest.spyOn(Modal, "createDialog").mockImplementation(() => {
                return { finished: Promise.resolve([true]) } as any;
            });

            // When we show the toast, and click Dismiss
            act(() => showToast(DeviceState.TURN_ON_KEY_STORAGE));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Dismiss" }));

            // Then the dialog was opened
            expect(Modal.createDialog).toHaveBeenCalledWith(
                ConfirmKeyStorageOffDialog,
                undefined,
                "mx_ConfirmKeyStorageOffDialog",
            );

            // And the backup was disabled when the dialog's onFinished was called
            expect(DeviceListener.sharedInstance().recordKeyBackupDisabled).toHaveBeenCalledTimes(1);
        });
    });

    describe("Verify this session", () => {
        it("should render the toast", async () => {
            act(() => showToast(DeviceState.VERIFY_THIS_SESSION));

            await expect(screen.findByText("Verify this session")).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Later" })).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Verify" })).resolves.toBeInTheDocument();
        });

        it("should dismiss the toast when 'Later' button clicked, and remember it", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            act(() => showToast(DeviceState.VERIFY_THIS_SESSION));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Later" }));

            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });

        it("should open the verification dialog when 'Verify' clicked", async () => {
            jest.spyOn(Modal, "createDialog");

            // When we show the toast, and click Verify
            act(() => showToast(DeviceState.VERIFY_THIS_SESSION));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Verify" }));

            // Then the dialog was opened
            expect(Modal.createDialog).toHaveBeenCalledWith(SetupEncryptionDialog, {}, undefined, false, true);
        });
    });

    describe("Identity needs reset", () => {
        it("should render the toast", async () => {
            act(() => showToast(DeviceState.IDENTITY_NEEDS_RESET));

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
            await expect(
                screen.findByText(
                    "You have to reset your cryptographic identity in order to ensure access to your message history",
                ),
            ).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue with reset" })).resolves.toBeInTheDocument();
        });

        it("should open settings to the reset flow when 'Continue with reset' clicked", async () => {
            act(() => showToast(DeviceState.IDENTITY_NEEDS_RESET));

            const user = userEvent.setup();
            await user.click(await screen.findByText("Continue with reset"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_cant_recover" },
            });
        });
    });
});
