/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { logIntoElement } from "./utils";
import { ElementAppPage } from "../../pages/ElementAppPage";

test.describe("Logout tests", () => {
    test.beforeEach(async ({ page, homeserver, credentials }) => {
        await logIntoElement(page, homeserver, credentials);
    });

    async function createRoom(page: Page, roomName: string, isEncrypted: boolean): Promise<void> {
        await page.getByRole("button", { name: "Add room" }).click();
        await page.locator(".mx_IconizedContextMenu").getByRole("menuitem", { name: "New room" }).click();

        const dialog = page.locator(".mx_Dialog");

        await dialog.getByLabel("Name").fill(roomName);

        if (!isEncrypted) {
            // it's enabled by default
            await page.getByLabel("Enable end-to-end encryption").click();
        }

        await dialog.getByRole("button", { name: "Create room" }).click();
    }

    async function sendMessageInCurrentRoom(page: Page, message: string): Promise<void> {
        await page.locator(".mx_MessageComposer").getByRole("textbox").fill(message);
        await page.getByTestId("sendmessagebtn").click();
    }
    async function setupRecovery(app: ElementAppPage, page: Page): Promise<void> {
        const securityTab = await app.settings.openUserSettings("Security & Privacy");

        await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
        await securityTab.getByRole("button", { name: "Set up", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        // It's the first time and secure storage is not set up, so it will create one
        await expect(currentDialogLocator.getByRole("heading", { name: "Set up Secure Backup" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(currentDialogLocator.getByRole("heading", { name: "Save your Security Key" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Copy", exact: true }).click();
        await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();

        await expect(currentDialogLocator.getByRole("heading", { name: "Secure Backup successful" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Done", exact: true }).click();
    }

    test("Ask to set up recovery on logout if not setup", async ({ page, app }) => {
        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", { name: "You'll lose access to your encrypted messages" }),
        ).toBeVisible();
    });

    test("If backup is set up show standard confirm", async ({ page, app }) => {
        await setupRecovery(app, page);

        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(currentDialogLocator.getByText("Are you sure you want to sign out?")).toBeVisible();
    });

    test("Logout directly if the user has no room keys", async ({ page, app }) => {
        await createRoom(page, "Clear room", false);

        await sendMessageInCurrentRoom(page, "Hello public world!");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        // Should have logged out directly
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});
