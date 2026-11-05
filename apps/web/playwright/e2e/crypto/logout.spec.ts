/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { createRoom, enableKeyBackup, logIntoElement, sendMessageInCurrentRoom } from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Logout tests", () => {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");
    test.beforeEach(async ({ page, homeserver, credentials }) => {
        await logIntoElement(page, credentials);
    });

    test("Ask to set up recovery on logout if not setup", async ({ page, app }) => {
        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();

        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("button", { name: "Remove this device", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", { name: "You're about to lose access to your encrypted chats" }),
        ).toBeVisible();
    });

    test("If recovery is set up remind the user to check their recovery key", async ({ page, app }) => {
        await enableKeyBackup(app);

        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("button", { name: "Remove this device", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", {
                name: "Make sure you have access to your recovery key before removing this device",
            }),
        ).toBeVisible();
    });

    test("Ask to set up recovery on logout even if not in encrypted room", async ({ page, app }) => {
        await createRoom(page, "Clear room", false);

        await sendMessageInCurrentRoom(page, "Hello public world!");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("button", { name: "Remove this device", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", { name: "You're about to lose access to your encrypted chats" }),
        ).toBeVisible();
    });

    test("Get a recovery key without leaving the logout dialog", async ({ page, app }) => {
        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("button", { name: "Remove this device", exact: true }).click();

        const dialog = page.getByRole("dialog", { name: "Remove this device" });
        await dialog.getByRole("button", { name: "Get recovery key" }).click();

        const recoveryKey = await dialog.getByTestId("recoveryKey").innerText();
        await dialog.getByRole("button", { name: "Continue" }).click();
        await dialog.getByRole("textbox").fill(recoveryKey);
        await dialog.getByRole("button", { name: "Finish set up" }).click();
        await expect(dialog.getByRole("heading", { name: "Your new recovery key is now active" })).toBeVisible();

        await dialog.getByRole("button", { name: "Continue to remove this device" }).click();
        await expect(page.getByRole("heading", { name: "Be in your element" })).toBeVisible();
    });

    test("Check the recovery key without leaving the logout dialog", async ({ page, app }) => {
        const recoveryKey = await enableKeyBackup(app);

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("button", { name: "Remove this device", exact: true }).click();

        const dialog = page.getByRole("dialog", { name: "Remove this device" });
        await dialog.getByRole("button", { name: "Check your recovery key" }).click();

        await dialog.getByRole("textbox").fill("not my recovery key");
        await dialog.getByRole("button", { name: "Continue" }).click();
        await expect(dialog.getByText("Incorrect recovery key")).toBeVisible();

        await dialog.getByRole("textbox").fill(recoveryKey);
        await dialog.getByRole("button", { name: "Continue" }).click();
        await expect(dialog.getByRole("heading", { name: "Your recovery key is active" })).toBeVisible();

        await dialog.getByRole("button", { name: "Continue to remove this device" }).click();
        await expect(page.getByRole("heading", { name: "Be in your element" })).toBeVisible();
    });
});
