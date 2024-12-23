/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

import { test, expect } from ".";
import {
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    createBot,
    verifySession,
} from "../../crypto/utils";

test.describe("Recovery section in Encryption tab", () => {
    test.use({
        displayName: "Alice",
    });

    let recoveryKey: GeneratedSecretStorageKey;
    let expectedBackupVersion: string;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        const res = await createBot(page, homeserver, credentials);
        recoveryKey = res.recoveryKey;
        expectedBackupVersion = res.expectedBackupVersion;
    });

    test("should verify the device", { tag: "@screenshot" }, async ({ page, app, util }) => {
        const dialog = await util.openEncryptionTab();

        // The user's device is in an unverified state, therefore the only option available to them here is to verify it
        const verifyButton = dialog.getByRole("button", { name: "Verify this device" });
        await expect(verifyButton).toBeVisible();
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("verify-device-encryption-tab.png");
        await verifyButton.click();

        await util.verifyDevice(recoveryKey);
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("default-recovery.png");

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // The backup decryption key should be in cache also, as we got it directly from the 4S
        await app.closeDialog();
        await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, true);
    });

    test(
        "should change the recovery key",
        { tag: "@screenshot" },
        async ({ page, app, homeserver, credentials, util, context }) => {
            await verifySession(app, "new passphrase");
            const dialog = await util.openEncryptionTab();

            // The user can only change the recovery key
            const changeButton = dialog.getByRole("button", { name: "Change recovery key" });
            await expect(changeButton).toBeVisible();
            await expect(util.getEncryptionTabContent()).toMatchScreenshot("default-recovery.png");
            await changeButton.click();

            // Display the new recovery key and click on the copy button
            await expect(dialog.getByText("Change recovery key?")).toBeVisible();
            await expect(util.getEncryptionTabContent()).toMatchScreenshot("change-key-1-encryption-tab.png", {
                mask: [dialog.getByTestId("recoveryKey")],
            });
            await dialog.getByRole("button", { name: "Copy" }).click();
            await dialog.getByRole("button", { name: "Continue" }).click();

            // Confirm the recovery key
            await util.confirmRecoveryKey("change-key-2-encryption-tab.png");
        },
    );

    test("should setup the recovery key", { tag: "@screenshot" }, async ({ page, app, util }) => {
        await verifySession(app, "new passphrase");
        await util.deleteKeyBackup(expectedBackupVersion);

        // The key backup is deleted and the user needs to set up it
        const dialog = await util.openEncryptionTab();
        const setupButton = dialog.getByRole("button", { name: "Set up recovery" });
        await expect(setupButton).toBeVisible();
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("set-up-recovery.png");
        await setupButton.click();

        // Display an informative panel about the recovery key
        await expect(dialog.getByRole("heading", { name: "Set up recovery" })).toBeVisible();
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("set-up-key-1-encryption-tab.png");
        await dialog.getByRole("button", { name: "Continue" }).click();

        // Display the new recovery key and click on the copy button
        await expect(dialog.getByText("Save your recovery key somewhere safe")).toBeVisible();
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("set-up-key-2-encryption-tab.png", {
            mask: [dialog.getByTestId("recoveryKey")],
        });
        await dialog.getByRole("button", { name: "Copy" }).click();
        await dialog.getByRole("button", { name: "Continue" }).click();

        // Confirm the recovery key
        await util.confirmRecoveryKey("set-up-key-3-encryption-tab.png");

        await app.closeDialog();
        // Check that the current device is connected to key backup and the backup version is the expected one
        await checkDeviceIsConnectedKeyBackup(page, "2", true);
    });

    test(
        "should enter the recovery key when the secrets are not cached",
        { tag: "@screenshot" },
        async ({ page, app, util }) => {
            await verifySession(app, "new passphrase");
            // We need to delete the cached secrets
            await util.deleteCachedSecrets();

            await util.openEncryptionTab();
            // We ask the user to enter the recovery key
            const dialog = util.getEncryptionTabContent();
            const enterKeyButton = dialog.getByRole("button", { name: "Enter recovery key" });
            await expect(enterKeyButton).toBeVisible();
            await expect(dialog).toMatchScreenshot("out-of-sync-recovery.png");
            await enterKeyButton.click();

            // Fill the recovery key
            await util.enterRecoveryKey(recoveryKey);
            await expect(dialog).toMatchScreenshot("default-recovery.png");

            // Check that our device is now cross-signed
            await checkDeviceIsCrossSigned(app);

            // Check that the current device is connected to key backup
            // The backup decryption key should be in cache also, as we got it directly from the 4S
            await app.closeDialog();
            await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, true);
        },
    );
});
