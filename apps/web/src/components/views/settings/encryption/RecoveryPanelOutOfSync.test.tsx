/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type SecretStorageKeyDescriptionAesV1 } from "matrix-js-sdk/src/secret-storage";
import { DecryptionKeyDoesNotMatchError } from "matrix-js-sdk/src/crypto-api";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { RecoveryPanelOutOfSync } from "./RecoveryPanelOutOfSync";
import { AccessCancelledError, accessSecretStorage } from "../../../../SecurityManager";
import { DeviceListener } from "../../../../device-listener";

vi.mock("../../../../SecurityManager", async () => {
    const originalModule = await vi.importActual("../../../../SecurityManager");

    return {
        ...originalModule,
        accessSecretStorage: vi.fn(),
    };
});

describe("<RecoveyPanelOutOfSync />", () => {
    let matrixClient: MatrixClient;

    function renderComponent(onFinish = vi.fn(), onForgotRecoveryKey = vi.fn(), onAccessSecretStorageFailed = vi.fn()) {
        return render(
            <RecoveryPanelOutOfSync
                onFinish={onFinish}
                onForgotRecoveryKey={onForgotRecoveryKey}
                onAccessSecretStorageFailed={onAccessSecretStorageFailed}
            />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should render", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should call onForgotRecoveryKey when the 'Forgot recovery key?' is clicked", async () => {
        const user = userEvent.setup();

        const onForgotRecoveryKey = vi.fn();
        renderComponent(vi.fn(), onForgotRecoveryKey);

        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        expect(onForgotRecoveryKey).toHaveBeenCalled();
    });

    it("should load backup decryption key and call onFinish when 'Enter recovery key' is clicked", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            return await func();
        });

        vi.mocked(matrixClient.isKeyBackupKeyStored).mockResolvedValue(fakeKeyBackupKey());

        const onFinish = vi.fn();
        renderComponent(onFinish);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();

        expect(matrixClient.isKeyBackupKeyStored).toHaveBeenCalled();
        expect(matrixClient.getCrypto()!.resetKeyBackup).not.toHaveBeenCalled();
        expect(matrixClient.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalled();
    });

    it("should reset key backup if needed", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            return await func();
        });

        const onFinish = vi.fn();
        renderComponent(onFinish);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();

        expect(matrixClient.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
    });

    it("should reset key backup if decryption key from secret storage does not match backup", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => func());
        vi.mocked(matrixClient.isKeyBackupKeyStored).mockResolvedValue(fakeKeyBackupKey());

        // Given we will fail to load a private key because it doesn't match the
        // latest backup public key
        vi.mocked(matrixClient.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).mockRejectedValue(
            new DecryptionKeyDoesNotMatchError("key no matchy"),
        );

        const onFinish = vi.fn();
        renderComponent(onFinish);

        // When we enter the recovery key
        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();

        // Then we reset backup after attempting to load the key
        expect(matrixClient.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalled();
        expect(matrixClient.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
    });

    it("should call onAccessSecretStorageFailed on failure", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            throw new Error("Error");
        });

        const onAccessSecretStorageFailed = vi.fn();
        renderComponent(vi.fn(), vi.fn(), onAccessSecretStorageFailed);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onAccessSecretStorageFailed).toHaveBeenCalled();
    });

    it("should call onAccessSecretStorageFailed when loadSessionBackupPrivateKeyFromSecretStorage fails", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => func());

        // Given we will fail to load a private key because of some unexpected error
        vi.mocked(matrixClient.getCrypto()!.loadSessionBackupPrivateKeyFromSecretStorage).mockRejectedValue(
            new Error("Unexpected error"),
        );
        vi.mocked(matrixClient.isKeyBackupKeyStored).mockResolvedValue(fakeKeyBackupKey());

        const onAccessSecretStorageFailed = vi.fn();
        renderComponent(vi.fn(), vi.fn(), onAccessSecretStorageFailed);

        // When we enter the recovery key
        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));

        // Then we handle the error in onAccessSecretStorageFailed
        expect(onAccessSecretStorageFailed).toHaveBeenCalled();
    });

    it("should not call onAccessSecretStorageFailed when cancelled", async () => {
        vi.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

        const user = userEvent.setup();
        vi.mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            throw new AccessCancelledError();
        });

        const onFinish = vi.fn();
        const onAccessSecretStorageFailed = vi.fn();
        renderComponent(onFinish, vi.fn(), onAccessSecretStorageFailed);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).not.toHaveBeenCalled();
        expect(onAccessSecretStorageFailed).not.toHaveBeenCalled();
    });
});

/**
 * Just enough of a key backup key to persuade RecoveryPanelOutOfSync that we
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
