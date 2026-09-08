/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import { act, render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, DecryptionKeyDoesNotMatchError } from "matrix-js-sdk/src/crypto-api";
import { type SecretStorageKeyDescriptionAesV1 } from "matrix-js-sdk/src/secret-storage";

import * as SecurityManager from "../SecurityManager";
import ToastContainer from "../components/structures/ToastContainer";
import { showToast } from "./SetupEncryptionToast";
import dis from "../dispatcher/dispatcher";
import { DeviceListener } from "../device-listener";
import Modal from "../Modal";
import ConfirmKeyStorageOffDialog from "../components/views/dialogs/ConfirmKeyStorageOffDialog";
import SetupEncryptionDialog from "../components/views/dialogs/security/SetupEncryptionDialog";
import { stubClient } from "test-utils";

vi.mock("../dispatcher/dispatcher", () => ({
    default: {
        dispatch: vi.fn(),
        register: vi.fn(),
        unregister: vi.fn(),
    },
}));

describe("SetupEncryptionToast", () => {
    beforeEach(() => {
        render(<ToastContainer />);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Back up your chats", () => {
        it("should render the toast", async () => {
            act(() => showToast("set_up_recovery"));

            expect(await screen.findByRole("heading", { name: "Back up your chats" })).toBeInTheDocument();
        });

        it("should dismiss the toast when 'Dismiss' button clicked, and remember it", async () => {
            vi.spyOn(DeviceListener.sharedInstance(), "recordRecoveryDisabled");
            vi.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            act(() => showToast("set_up_recovery"));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Dismiss" }));

            expect(DeviceListener.sharedInstance().recordRecoveryDisabled).toHaveBeenCalled();
            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });
    });

    describe("Key storage out of sync", () => {
        let client: Mocked<MatrixClient>;

        beforeEach(() => {
            client = vi.mocked(stubClient());
            vi.mocked(client.getCrypto).mockReturnValue({
                getSessionBackupPrivateKey: vi.fn().mockResolvedValue(null),
                resetKeyBackup: vi.fn(),
                checkKeyBackupAndEnable: vi.fn(),
                loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
            } as unknown as CryptoApi);
        });

        it("should render the toast", async () => {
            act(() => showToast("key_storage_out_of_sync"));

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
        });

        it("should reset key backup if needed", async () => {
            showToast("key_storage_out_of_sync");

            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => {
                    return await func();
                },
            );

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(client.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
        });

        it("should not reset key backup if not needed", async () => {
            showToast("key_storage_out_of_sync");

            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => {
                    return await func();
                },
            );

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
            // if the backup key is stored in 4S
            client.isKeyBackupKeyStored.mockResolvedValue({});

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            // we shouldn't have reset the key backup, but should have fetched
            // the key from 4S
            expect(client.getCrypto()!.resetKeyBackup).not.toHaveBeenCalled();
            expect(client.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalled();
        });

        it("should reset key backup if decryption key does not match backup", async () => {
            showToast("key_storage_out_of_sync");

            const crypto = client.getCrypto()!;

            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => func(),
            );

            // Given we throw when trying to load the backup decrption key
            vi.mocked(crypto.loadSessionBackupPrivateKeyFromSecretStorage).mockRejectedValue(
                new DecryptionKeyDoesNotMatchError("it key no match"),
            );

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
            client.isKeyBackupKeyStored.mockResolvedValue({});

            // When we enter our recovery key
            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            // Then we should reset the key backup because we caught the
            // DecryptionKeyDoesNotMatchError.
            expect(client.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
        });

        it("should open settings to the reset flow when 'forgot recovery key' clicked and identity reset needed", async () => {
            act(() => showToast("key_storage_out_of_sync"));

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
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
            act(() => showToast("key_storage_out_of_sync"));

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
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
            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                true,
            );

            act(() => showToast("key_storage_out_of_sync"));

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_sync_failed" },
            });
        });

        it("should open settings to the change recovery key flow when recovering fails and identity reset not needed", async () => {
            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                false,
            );

            act(() => showToast("key_storage_out_of_sync"));

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "change_recovery_key" },
            });
        });

        it("should go to change recovery key when recovering fails inside loadSessionBackup...", async () => {
            vi.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(
                async (func = async (): Promise<void> => {}) => func(),
            );

            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(
                true,
            );
            vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
            vi.mocked(client.isKeyBackupKeyStored).mockResolvedValue(fakeKeyBackupKey());

            // Given when we try to load from backup we get an unexpected error
            vi.mocked(client.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).mockRejectedValue(
                new Error("Unexpected error"),
            );

            act(() => showToast("key_storage_out_of_sync"));

            // When we start to entry recovery key
            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            // Then we handle the error and jump to the Encryption Settings.
            //
            // Note: It seems reasonable to ask the user to reset their identity
            // in this case, but we're not actually sure what happened, so it
            // may not be the right response.
            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_sync_failed" },
            });
        });

        it("should dismiss the toast when the close button is clicked", async () => {
            vi.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            act(() => showToast("key_storage_out_of_sync"));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Close" }));

            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });

        /**
         * Just enough of a key backup key to persuade SetupEncryptionToast that we
         * don't need to reset backup.
         */
        function fakeKeyBackupKey(): Record<string, SecretStorageKeyDescriptionAesV1> {
            return {
                x: {
                    iv: "x",
                    mac: "y",
                    name: "n",
                    algorithm: "a",
                    passphrase: {
                        algorithm: "m.pbkdf2",
                        iterations: 1,
                        salt: "s",
                    },
                },
            };
        }
    });

    describe("Turn on key storage", () => {
        it("should render the toast", async () => {
            act(() => showToast("turn_on_key_storage"));

            await expect(screen.findByText("Turn on key storage")).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Dismiss" })).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue" })).resolves.toBeInTheDocument();
        });

        it("should open settings to the Encryption tab when 'Continue' clicked", async () => {
            vi.spyOn(DeviceListener.sharedInstance(), "recordKeyBackupDisabled");

            act(() => showToast("turn_on_key_storage"));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Continue" }));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
            });

            expect(DeviceListener.sharedInstance().recordKeyBackupDisabled).not.toHaveBeenCalled();
        });

        it("should open the confirm key storage off dialog when 'Dismiss' clicked", async () => {
            vi.spyOn(DeviceListener.sharedInstance(), "recordKeyBackupDisabled");

            // Given that as soon as the dialog opens, it closes and says "yes they clicked dismiss"
            vi.spyOn(Modal, "createDialog").mockImplementation(() => {
                return { finished: Promise.resolve([true]) } as any;
            });

            // When we show the toast, and click Dismiss
            act(() => showToast("turn_on_key_storage"));

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

    describe("Verify this device", () => {
        it("should render the toast", async () => {
            act(() => showToast("verify_this_session"));

            await expect(screen.findByText("Verify this device")).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Later" })).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue" })).resolves.toBeInTheDocument();
        });

        it("should dismiss the toast when 'Later' button clicked, and remember it", async () => {
            vi.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            act(() => showToast("verify_this_session"));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Later" }));

            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });

        it("should open the verification dialog when 'Continue' clicked", async () => {
            vi.spyOn(Modal, "createDialog");

            // When we show the toast, and click Verify
            act(() => showToast("verify_this_session"));

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Continue" }));

            // Then the dialog was opened
            expect(Modal.createDialog).toHaveBeenCalledWith(SetupEncryptionDialog, {}, undefined, false, true);
        });
    });

    describe("Identity needs reset", () => {
        it("should render the toast", async () => {
            act(() => showToast("identity_needs_reset"));

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
            await expect(
                screen.findByText(
                    "You have to reset your digital identity in order to ensure access to your chat history",
                ),
            ).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue with reset" })).resolves.toBeInTheDocument();
        });

        it("should open settings to the reset flow when 'Continue with reset' clicked", async () => {
            act(() => showToast("identity_needs_reset"));

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
