/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

import { test, expect } from ".";
import {
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    createBot,
    deleteCachedSecrets,
    verifySession,
} from "../../crypto/utils";

test.describe("Encryption tab", () => {
    test.use({ displayName: "Alice" });

    let recoveryKey: GeneratedSecretStorageKey;
    let expectedBackupVersion: string;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        // The bot bootstraps cross-signing, creates a key backup and sets up a recovery key
        const res = await createBot(page, homeserver, credentials);
        recoveryKey = res.recoveryKey;
        expectedBackupVersion = res.expectedBackupVersion;
    });

    test(
        "should show a 'Verify this device' button if the device is unverified",
        { tag: "@screenshot" },
        async ({ page, app, util }) => {
            const dialog = await util.openEncryptionTab();
            const content = util.getEncryptionTabContent();

            // The user's device is in an unverified state, therefore the only option available to them here is to verify it
            const verifyButton = dialog.getByRole("button", { name: "Verify this device" });
            await expect(verifyButton).toBeVisible();
            await expect(content).toMatchScreenshot("verify-device-encryption-tab.png");
            await verifyButton.click();

            await util.verifyDevice(recoveryKey);

            await expect(content).toMatchScreenshot("default-tab.png", {
                mask: [content.getByTestId("deviceId"), content.getByTestId("sessionKey")],
            });

            // Check that our device is now cross-signed
            await checkDeviceIsCrossSigned(app);

            // Check that the current device is connected to key backup
            // The backup decryption key should be in cache also, as we got it directly from the 4S
            await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, true);
        },
    );

    // Test what happens if the cross-signing secrets are in secret storage but are not cached in the local DB.
    //
    // This can happen if we verified another device and secret-gossiping failed, or the other device itself lacked the secrets.
    // We simulate this case by deleting the cached secrets in the indexedDB.
    test(
        "should prompt to enter the recovery key when the secrets are not cached locally",
        { tag: "@screenshot" },
        async ({ page, app, util }) => {
            await verifySession(app, recoveryKey.encodedPrivateKey);
            // We need to delete the cached secrets
            await deleteCachedSecrets(page);

            await util.openEncryptionTab();
            // We ask the user to enter the recovery key
            const dialog = util.getEncryptionTabContent();
            const enterKeyButton = dialog.getByRole("button", { name: "Enter recovery key" });
            await expect(enterKeyButton).toBeVisible();
            await expect(dialog).toMatchScreenshot("out-of-sync-recovery.png");
            await enterKeyButton.click();

            // Fill the recovery key
            await util.enterRecoveryKey(recoveryKey);
            await expect(dialog).toMatchScreenshot("default-tab.png", {
                mask: [dialog.getByTestId("deviceId"), dialog.getByTestId("sessionKey")],
            });

            // Check that our device is now cross-signed
            await checkDeviceIsCrossSigned(app);

            // Check that the current device is connected to key backup
            // The backup decryption key should be in cache also, as we got it directly from the 4S
            await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, true);
        },
    );

    test("should display the reset identity panel when the user clicks on 'Forgot recovery key?'", async ({
        page,
        app,
        util,
    }) => {
        await verifySession(app, recoveryKey.encodedPrivateKey);
        // We need to delete the cached secrets
        await deleteCachedSecrets(page);

        // The "Key storage is out sync" section is displayed and the user click on the "Forgot recovery key?" button
        await util.openEncryptionTab();
        const dialog = util.getEncryptionTabContent();
        await dialog.getByRole("button", { name: "Forgot recovery key?" }).click();

        // The user is prompted to reset their identity
        await expect(dialog.getByText("Forgot your recovery key? You’ll need to reset your identity.")).toBeVisible();
    });

    test("should warn before turning off key storage", { tag: "@screenshot" }, async ({ page, app, util }) => {
        await verifySession(app, recoveryKey.encodedPrivateKey);
        await util.openEncryptionTab();

        await page.getByRole("checkbox", { name: "Allow key storage" }).click();

        await expect(
            page.getByRole("heading", { name: "Are you sure you want to turn off key storage and delete it?" }),
        ).toBeVisible();

        await expect(util.getEncryptionTabContent()).toMatchScreenshot("delete-key-storage-confirm.png");

        const deleteRequestPromises = [
            page.waitForRequest((req) => req.url().endsWith("/account_data/m.cross_signing.master")),
            page.waitForRequest((req) => req.url().endsWith("/account_data/m.cross_signing.self_signing")),
            page.waitForRequest((req) => req.url().endsWith("/account_data/m.cross_signing.user_signing")),
            page.waitForRequest((req) => req.url().endsWith("/account_data/m.megolm_backup.v1")),
            page.waitForRequest((req) => req.url().endsWith("/account_data/m.secret_storage.default_key")),
            page.waitForRequest((req) => req.url().includes("/account_data/m.secret_storage.key.")),
        ];

        await page.getByRole("button", { name: "Delete key storage" }).click();

        await expect(page.getByRole("checkbox", { name: "Allow key storage" })).not.toBeChecked();

        for (const prom of deleteRequestPromises) {
            const request = await prom;
            expect(request.method()).toBe("PUT");
            expect(request.postData()).toBe(JSON.stringify({}));
        }
    });
});
