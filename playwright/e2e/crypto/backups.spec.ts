/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { test, expect } from "../../element-web-test";

test.describe("Backups", () => {
    test.use({
        displayName: "Hanako",
    });

    test("Create, delete and recreate a keys backup", async ({ page, user, app }, workerInfo) => {
        // skipIfLegacyCrypto
        test.skip(
            workerInfo.project.name === "Legacy Crypto",
            "This test only works with Rust crypto. Deleting the backup seems to fail with legacy crypto.",
        );

        // Create a backup
        const tab = await app.settings.openUserSettings("Security & Privacy");
        await expect(tab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
        await tab.getByRole("button", { name: "Set up", exact: true }).click();
        const dialog = await app.getDialogByTitle("Set up Secure Backup", 60000);
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: "Save your Security Key" })).toBeVisible();
        await dialog.getByRole("button", { name: "Copy", exact: true }).click();
        const securityKey = await app.getClipboard();
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: "Secure Backup successful" })).toBeVisible();
        await dialog.getByRole("button", { name: "Done", exact: true }).click();

        // Delete it
        await app.settings.openUserSettings("Security & Privacy");
        await expect(tab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
        await tab.getByRole("button", { name: "Delete Backup", exact: true }).click();
        await dialog.getByTestId("dialog-primary-button").click(); // Click "Delete Backup"

        // Create another
        await tab.getByRole("button", { name: "Set up", exact: true }).click();
        dialog.getByLabel("Security Key").fill(securityKey);
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(dialog.getByRole("heading", { name: "Success!" })).toBeVisible();
        await dialog.getByRole("button", { name: "OK", exact: true }).click();
    });
});
