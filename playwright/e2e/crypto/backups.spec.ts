/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { completeCreateSecretStorageDialog } from "./utils.ts";

async function expectBackupVersionToBe(page: Page, version: string) {
    await expect(page.locator(".mx_SecureBackupPanel_statusList tr:nth-child(5) td")).toHaveText(
        version + " (Algorithm: m.megolm_backup.v1.curve25519-aes-sha2)",
    );

    await expect(page.locator(".mx_SecureBackupPanel_statusList tr:nth-child(6) td")).toHaveText(version);
}

test.describe("Backups", () => {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");
    test.use({
        displayName: "Hanako",
    });

    test(
        "Create, delete and recreate a keys backup",
        { tag: "@no-webkit" },
        async ({ page, user, app }, workerInfo) => {
            // Create a backup
            const securityTab = await app.settings.openUserSettings("Security & Privacy");

            await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
            await securityTab.getByRole("button", { name: "Set up", exact: true }).click();

            const securityKey = await completeCreateSecretStorageDialog(page);

            // Open the settings again
            await app.settings.openUserSettings("Security & Privacy");
            await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();

            // expand the advanced section to see the active version in the reports
            await page
                .locator(".mx_Dialog .mx_SettingsSubsection_content details .mx_SecureBackupPanel_advanced")
                .locator("..")
                .click();

            await expectBackupVersionToBe(page, "1");

            await securityTab.getByRole("button", { name: "Delete Backup", exact: true }).click();
            const currentDialogLocator = page.locator(".mx_Dialog");
            await expect(currentDialogLocator.getByRole("heading", { name: "Delete Backup" })).toBeVisible();
            // Delete it
            await currentDialogLocator.getByTestId("dialog-primary-button").click(); // Click "Delete Backup"

            // Create another
            await securityTab.getByRole("button", { name: "Set up", exact: true }).click();
            await expect(currentDialogLocator.getByRole("heading", { name: "Recovery Key" })).toBeVisible();
            await currentDialogLocator.getByLabel("Recovery Key").fill(securityKey);
            await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();

            // Should be successful
            await expect(currentDialogLocator.getByRole("heading", { name: "Success!" })).toBeVisible();
            await currentDialogLocator.getByRole("button", { name: "OK", exact: true }).click();

            // Open the settings again
            await app.settings.openUserSettings("Security & Privacy");
            await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();

            // expand the advanced section to see the active version in the reports
            await page
                .locator(".mx_Dialog .mx_SettingsSubsection_content details .mx_SecureBackupPanel_advanced")
                .locator("..")
                .click();

            await expectBackupVersionToBe(page, "2");

            // ==
            // Ensure that if you don't have the secret storage passphrase the backup won't be created
            // ==

            // First delete version 2
            await securityTab.getByRole("button", { name: "Delete Backup", exact: true }).click();
            await expect(currentDialogLocator.getByRole("heading", { name: "Delete Backup" })).toBeVisible();
            // Click "Delete Backup"
            await currentDialogLocator.getByTestId("dialog-primary-button").click();

            // Try to create another
            await securityTab.getByRole("button", { name: "Set up", exact: true }).click();
            await expect(currentDialogLocator.getByRole("heading", { name: "Recovery Key" })).toBeVisible();
            // But cancel the recovery key dialog, to simulate not having the secret storage passphrase
            await currentDialogLocator.getByTestId("dialog-cancel-button").click();

            await expect(currentDialogLocator.getByRole("heading", { name: "Starting backup…" })).toBeVisible();
            // check that it failed
            await expect(currentDialogLocator.getByText("Unable to create key backup")).toBeVisible();
            // cancel
            await currentDialogLocator.getByTestId("dialog-cancel-button").click();

            // go back to the settings to check that no backup was created (the setup button should still be there)
            await app.settings.openUserSettings("Security & Privacy");
            await expect(securityTab.getByRole("button", { name: "Set up", exact: true })).toBeVisible();
        },
    );
});
