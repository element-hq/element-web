/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from ".";
import { checkDeviceIsConnectedKeyBackup, createBot, verifySession } from "../../crypto/utils";
import type { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

test.describe("Recovery section in Encryption tab", () => {
    test.use({
        displayName: "Alice",
    });

    let recoveryKey: GeneratedSecretStorageKey;
    test.beforeEach(async ({ page, homeserver, credentials }) => {
        // The bot bootstraps cross-signing, creates a key backup and sets up a recovery key
        const res = await createBot(page, homeserver, credentials);
        recoveryKey = res.recoveryKey;
    });

    test(
        "should change the recovery key",
        { tag: ["@screenshot", "@no-webkit"] },
        async ({ page, app, homeserver, credentials, util, context }) => {
            await verifySession(app, recoveryKey.encodedPrivateKey);
            const dialog = await util.openEncryptionTab();

            // The user can only change the recovery key
            const changeButton = dialog.getByRole("button", { name: "Change recovery key" });
            await expect(changeButton).toBeVisible();
            await expect(util.getEncryptionRecoverySection()).toMatchScreenshot("default-recovery.png");
            await changeButton.click();

            // Display the new recovery key and click on the copy button
            await expect(dialog.getByText("Change recovery key?")).toBeVisible();
            await expect(util.getEncryptionTabContent()).toMatchScreenshot("change-key-1-encryption-tab.png", {
                mask: [dialog.getByTestId("recoveryKey")],
            });
            await dialog.getByRole("button", { name: "Copy" }).click();
            await dialog.getByRole("button", { name: "Continue" }).click();

            // Confirm the recovery key
            await util.confirmRecoveryKey(
                "Enter your new recovery key",
                "Confirm new recovery key",
                "change-key-2-encryption-tab.png",
            );
        },
    );

    test("should setup the recovery key", { tag: ["@screenshot", "@no-webkit"] }, async ({ page, app, util }) => {
        await verifySession(app, recoveryKey.encodedPrivateKey);
        await util.removeSecretStorageDefaultKeyId();

        // The key backup is deleted and the user needs to set it up
        const dialog = await util.openEncryptionTab();
        const setupButton = dialog.getByRole("button", { name: "Set up recovery" });
        await expect(setupButton).toBeVisible();
        await expect(util.getEncryptionRecoverySection()).toMatchScreenshot("set-up-recovery.png");
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
        await util.confirmRecoveryKey(
            "Enter your recovery key to confirm",
            "Finish set up",
            "set-up-key-3-encryption-tab.png",
        );

        // The recovery key is now set up and the user can change it
        await expect(dialog.getByRole("button", { name: "Change recovery key" })).toBeVisible();

        // Check that the current device is connected to key backup and the backup version is the expected one
        await checkDeviceIsConnectedKeyBackup(app, "1", true);
    });
});
