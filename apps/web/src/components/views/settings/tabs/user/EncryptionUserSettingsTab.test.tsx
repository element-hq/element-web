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

import { EncryptionUserSettingsTab, type State } from "./EncryptionUserSettingsTab";
import Modal from "../../../../../Modal";
import { DeviceListener } from "../../../../../device-listener";

describe("<EncryptionUserSettingsTab />", () => {
    let matrixClient: MatrixClient;

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
        return render(<EncryptionUserSettingsTab {...props} />, withClientContextRenderOptions(matrixClient));
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

        const user = userEvent.setup();
        const { asFragment } = renderComponent();

        await waitFor(() => screen.getByRole("button", { name: "Enter recovery key" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        expect(
            screen.getByRole("heading", {
                name: "Forgot your recovery key? You’ll need to reset your digital identity.",
            }),
        ).toBeVisible();
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
        const button = await waitFor(() => screen.getByRole("button", { name: "Get recovery key" }));
        await user.click(button);
        await waitFor(() => expect(screen.getByRole("heading", { name: "Get recovery key" })).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the reset identity panel when the user clicks on the reset cryptographic identity panel", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("1");

        const user = userEvent.setup();

        const { asFragment } = renderComponent();
        const button = await waitFor(() => screen.getByRole("button", { name: "Reset cryptographic identity" }));
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
            screen.getByText("Your key storage is out of sync. Click one of the buttons below to fix the problem."),
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
});
