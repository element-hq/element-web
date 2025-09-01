/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import * as SecurityManager from "../../../src/SecurityManager";
import ToastContainer from "../../../src/components/structures/ToastContainer";
import { Kind, showToast } from "../../../src/toasts/SetupEncryptionToast";
import dis from "../../../src/dispatcher/dispatcher";
import DeviceListener from "../../../src/DeviceListener";
import Modal from "../../../src/Modal";
import ConfirmKeyStorageOffDialog from "../../../src/components/views/dialogs/ConfirmKeyStorageOffDialog";

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
            showToast(Kind.SET_UP_RECOVERY);

            expect(await screen.findByRole("heading", { name: "Set up recovery" })).toBeInTheDocument();
        });

        it("should dismiss the toast when 'Dismiss' button clicked, and remember it", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "recordRecoveryDisabled");
            jest.spyOn(DeviceListener.sharedInstance(), "dismissEncryptionSetup");

            showToast(Kind.SET_UP_RECOVERY);

            const user = userEvent.setup();
            await user.click(await screen.findByRole("button", { name: "Dismiss" }));

            expect(DeviceListener.sharedInstance().recordRecoveryDisabled).toHaveBeenCalled();
            expect(DeviceListener.sharedInstance().dismissEncryptionSetup).toHaveBeenCalled();
        });
    });

    describe("Key storage out of sync (retrieve secrets)", () => {
        it("should render the toast", async () => {
            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC);

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
        });

        it("should open settings to the reset flow when 'forgot recovery key' clicked", async () => {
            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC);

            const user = userEvent.setup();
            await user.click(await screen.findByText("Forgot recovery key?"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_forgot" },
            });
        });

        it("should open settings to the reset flow when recovering fails", async () => {
            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC);

            const user = userEvent.setup();
            await user.click(await screen.findByText("Enter recovery key"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "reset_identity_sync_failed" },
            });
        });
    });

    describe("Key storage out of sync (store secrets)", () => {
        it("should render the toast", async () => {
            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC_STORE);

            await expect(screen.findByText("Your key storage is out of sync.")).resolves.toBeInTheDocument();
        });

        it("should open settings to the reset flow when 'forgot recovery key' clicked", async () => {
            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC_STORE);

            const user = userEvent.setup();
            await user.click(await screen.findByText("Forgot recovery key?"));

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "view_user_settings",
                initialTabId: "USER_ENCRYPTION_TAB",
                props: { initialEncryptionState: "change_recovery_key" },
            });
        });

        it("should open settings to the reset flow when recovering fails", async () => {
            jest.spyOn(SecurityManager, "accessSecretStorage").mockImplementation(async () => {
                throw new Error("Something went wrong while recovering!");
            });

            showToast(Kind.KEY_STORAGE_OUT_OF_SYNC_STORE);

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
            showToast(Kind.TURN_ON_KEY_STORAGE);

            await expect(screen.findByText("Turn on key storage")).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Dismiss" })).resolves.toBeInTheDocument();
            await expect(screen.findByRole("button", { name: "Continue" })).resolves.toBeInTheDocument();
        });

        it("should open settings to the Encryption tab when 'Continue' clicked", async () => {
            jest.spyOn(DeviceListener.sharedInstance(), "recordKeyBackupDisabled");

            showToast(Kind.TURN_ON_KEY_STORAGE);

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
            showToast(Kind.TURN_ON_KEY_STORAGE);

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
});
