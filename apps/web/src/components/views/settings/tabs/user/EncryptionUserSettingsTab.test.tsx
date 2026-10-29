/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "test-utils-rtl";
import { createTestClient, withClientContextRenderOptions } from "test-utils";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import { ToastContext, type ToastRack } from "@element-hq/web-shared-components";

import { EncryptionUserSettingsTab, type State } from "./EncryptionUserSettingsTab";
import Modal from "../../../../../Modal";
import { DeleteKeyStorageDialog } from "../../../dialogs/DeleteKeyStorageDialog";
import { DeleteKeyStorageViewModel } from "../../../../../viewmodels/crypto/DeleteKeyStorageViewModel";
import { DeviceListener } from "../../../../../device-listener";

describe("<EncryptionUserSettingsTab />", () => {
    let matrixClient: MatrixClient;
    let toastRack: { displayToast: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        matrixClient = createTestClient();
        vi.spyOn(matrixClient.getCrypto()!, "isCrossSigningReady").mockResolvedValue(true);
        // Recovery key is available
        vi.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue("default key");
        // Secrets are cached
        vi.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });

        vi.spyOn(DeviceListener.sharedInstance(), "getDeviceState").mockReturnValue("ok");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    function renderComponent(props: { initialState?: State } = {}) {
        toastRack = { displayToast: vi.fn().mockReturnValue(() => {}) };
        return render(
            <ToastContext.Provider value={toastRack as unknown as ToastRack}>
                <EncryptionUserSettingsTab {...props} />
            </ToastContext.Provider>,
            withClientContextRenderOptions(matrixClient),
        );
    }

    it("should display a verify button when the encryption is not set up", async () => {
        const user = userEvent.setup();
        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("verify_this_session");

        const { asFragment } = renderComponent();
        await waitFor(() =>
            expect(
                screen.getByText("You need to verify this device in order to view your encryption settings."),
            ).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();

        const spy = vi.spyOn(Modal, "createDialog").mockReturnValue({ finished: new Promise(() => {}) } as any);
        await user.click(screen.getByText("Verify this device"));
        expect(spy).toHaveBeenCalled();
    });

    it("should display the recovery panel when key storage is enabled", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        renderComponent();
        await waitFor(() => expect(screen.getByText("Backup")).toBeInTheDocument());
    });

    it("should not display the recovery panel when key storage is not enabled", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue(null);
        renderComponent();
        await expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
    });

    it("should display the recovery out of sync panel when secrets are not cached", async () => {
        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("key_storage_out_of_sync");

        const { asFragment } = renderComponent();

        await waitFor(() => screen.getByRole("button", { name: "Enter recovery key" }));
        expect(asFragment()).toMatchSnapshot();
    });

    it("should enter the 'reset identity' flow if user clicks 'forgot password' and we are missing identity keys", async () => {
        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("key_storage_out_of_sync");
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(true);
        renderComponent();
        await waitFor(() => screen.getByRole("button", { name: "Enter recovery key" }));

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        await waitFor(() =>
            expect(
                screen.getByRole("heading", {
                    name: "Forgot your recovery key? You’ll need to reset your digital identity.",
                }),
            ).toBeVisible(),
        );
    });

    it("should enter the 'change recovery key' flow if user clicks 'forgot password' and we have identity keys", async () => {
        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("key_storage_out_of_sync");
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsCrossSigningReset").mockResolvedValue(false);
        renderComponent();
        await waitFor(() => screen.getByRole("button", { name: "Enter recovery key" }));

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        await waitFor(() => expect(screen.getByText("Change recovery key")).toBeVisible());
    });

    it("should display the change recovery key panel when the user clicks on the change recovery button", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        const button = await waitFor(() => screen.getByRole("button", { name: "Change recovery key" }));
        await user.click(button);
        await waitFor(() => expect(screen.getByText("Change recovery key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the set up recovery key when the user clicks on the set up recovery key button", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        vi.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue(null);
        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        const button = await waitFor(() => screen.getByRole("button", { name: "Create recovery key" }));
        await user.click(button);
        await waitFor(() =>
            expect(screen.getByRole("heading", { name: "Save your recovery key somewhere safe" })).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show a confirmation toast when the recovery key is set up", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
        const user = userEvent.setup();
        renderComponent({ initialState: "set_recovery_key" });

        // Walk the whole recovery key flow: save the generated key, then confirm it.
        await user.click(await screen.findByRole("button", { name: "Continue" }));
        await user.type(await screen.findByTitle("Enter recovery key"), "encoded private key");
        await user.click(screen.getByRole("button", { name: "Finish set up" }));

        await waitFor(() => expect(toastRack.displayToast).toHaveBeenCalledTimes(1));
        expect(displayedToastText()).toContain("Backup is now fully set up");
    });

    it("should show a key-active confirmation toast when the recovery key is changed", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
        const user = userEvent.setup();
        renderComponent({ initialState: "change_recovery_key" });

        await user.click(await screen.findByRole("button", { name: "Continue" }));
        await user.type(await screen.findByTitle("Enter recovery key"), "encoded private key");
        await user.click(screen.getByRole("button", { name: "Confirm new recovery key" }));

        await waitFor(() => expect(toastRack.displayToast).toHaveBeenCalledTimes(1));
        expect(displayedToastText()).toContain("Your new recovery key is now active");
    });

    it("should still remove the confirmation toast after the tab is unmounted", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);
        // Fake timers stall the recovery flow, so spy on the real ones instead.
        const setTimeoutSpy = vi.spyOn(window, "setTimeout");
        const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
        const user = userEvent.setup();
        const { unmount } = renderComponent({ initialState: "set_recovery_key" });
        const removeToast = vi.fn();
        toastRack.displayToast.mockReturnValue(removeToast);

        await user.click(await screen.findByRole("button", { name: "Continue" }));
        await user.type(await screen.findByTitle("Enter recovery key"), "encoded private key");
        await user.click(screen.getByRole("button", { name: "Finish set up" }));
        await waitFor(() => expect(toastRack.displayToast).toHaveBeenCalledTimes(1));
        const removalTimer = setTimeoutSpy.mock.calls.findIndex(([callback]) => callback === removeToast);
        expect(removalTimer).not.toBe(-1);

        // The toast lives in the settings dialog, so leaving the tab must not cancel its removal.
        unmount();
        expect(clearTimeoutSpy).not.toHaveBeenCalledWith(setTimeoutSpy.mock.results[removalTimer].value);
    });

    /** Render the node passed to the mock toast rack and return its text. */
    function displayedToastText(): string {
        return render(<div>{toastRack.displayToast.mock.calls[0][0]}</div>).container.textContent ?? "";
    }

    it("should display the reset identity panel when the user clicks on the reset cryptographic identity panel", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        const button = await waitFor(() => screen.getByRole("button", { name: "Reset digital identity" }));
        await user.click(button);
        await waitFor(() =>
            expect(screen.getByText("Are you sure you want to reset your digital identity?")).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should enter 'Forgot recovery' flow when initialState is set to 'reset_identity_forgot'", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent({ initialState: "reset_identity_forgot" });

        expect(
            await screen.findByRole("heading", {
                name: "Forgot your recovery key? You’ll need to reset your digital identity.",
            }),
        ).toBeVisible();
    });

    it("should do 'Failed to sync' reset flow when initialState is set to 'reset_identity_sync_failed'", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent({ initialState: "reset_identity_sync_failed" });

        expect(
            await screen.findByRole("heading", {
                name: "Failed to sync key storage. You need to reset your digital identity.",
            }),
        ).toBeVisible();
    });

    it("should update when key backup status event is fired", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        renderComponent();

        await expect(await screen.findByRole("heading", { name: "Backup" })).toBeVisible();

        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue(null);

        act(() => {
            matrixClient.emit(CryptoEvent.KeyBackupStatus, false);
        });

        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: "Backup" })).toBeNull();
        });
    });

    it("should re-check the encryption state and displays the correct panel when the user clicks cancel the reset identity flow", async () => {
        const user = userEvent.setup();

        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("key_storage_out_of_sync");

        renderComponent({ initialState: "reset_identity_forgot" });

        expect(
            screen.getByRole("heading", {
                name: "Forgot your recovery key? You’ll need to reset your digital identity.",
            }),
        ).toBeVisible();

        await user.click(screen.getByRole("button", { name: "Back" }));
        await waitFor(() =>
            screen.getByText("Your key storage is out of sync. Select one of the buttons below to fix the problem."),
        );
    });

    it("should display the identity needs reset panel when the user's identity needs resetting", async () => {
        vi.mocked(DeviceListener.sharedInstance().getDeviceState).mockReturnValue("identity_needs_reset");

        const user = userEvent.setup();
        const { asFragment } = renderComponent();

        await waitFor(() => screen.getByRole("button", { name: "Continue with reset" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Continue with reset" }));
        expect(screen.getByRole("heading", { name: "You need to reset your digital identity" })).toBeVisible();
    });

    it("should disable the key storage switch while turning key storage on", async () => {
        const user = userEvent.setup();
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue(null);
        const { promise, resolve } = Promise.withResolvers<null>();
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockReturnValue(promise);
        renderComponent();

        const toggle = await screen.findByRole("switch", { name: "Allow key storage" });
        await user.click(toggle);

        expect(toggle).toBeDisabled();
        resolve(null);
        await waitFor(() => expect(toggle).toBeEnabled());
    });

    it("should ask for confirmation in a dialog when turning off key storage", async () => {
        const user = userEvent.setup();
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");
        const dialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({ finished: Promise.resolve([]) } as any);
        renderComponent();

        await user.click(await screen.findByRole("switch", { name: "Allow key storage" }));

        expect(dialogSpy).toHaveBeenCalledWith(
            DeleteKeyStorageDialog,
            { vm: expect.any(DeleteKeyStorageViewModel) },
            undefined,
            false,
            false,
            expect.anything(),
        );
        expect(matrixClient.getCrypto()!.disableKeyStorage).not.toHaveBeenCalled();
        expect(screen.getByRole("switch", { name: "Allow key storage" })).toBeChecked();
    });
});
