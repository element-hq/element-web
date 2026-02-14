/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Roles & Permissions room settings tab", () => {
    const roomName = "Test room";

    test.use({
        displayName: "Alice",
    });

    let settings: Locator;

    test.beforeEach(async ({ user, app }) => {
        await app.client.createRoom({ name: roomName });
        await app.viewRoomByName(roomName);
        settings = await app.settings.openRoomSettings("Roles & Permissions");
    });

    test("should be able to change the role of a user", async ({ page, app, user }) => {
        const privilegedUserSection = settings.locator(".mx_SettingsFieldset").first();
        const applyButton = privilegedUserSection.getByRole("button", { name: "Apply" });

        // Alice is admin (100) and the Apply button should be disabled
        await expect(applyButton).toBeDisabled();
        let combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("100");

        // Change the role of Alice to Moderator (50)
        await combobox.selectOption("Moderator");
        await expect(combobox).toHaveValue("50");

        // Should display a modal to warn that we are demoting the only admin user
        const modal = await page.locator(".mx_Dialog", {
            hasText: "Warning",
        });
        await expect(modal).toBeVisible();
        // Click on the continue button in the modal
        await modal.getByRole("button", { name: "Continue" }).click();

        const respPromise = page.waitForRequest("**/state/**");
        await applyButton.click();
        await respPromise;

        // Reload and check Alice is still Moderator (50)
        await page.reload();
        settings = await app.settings.openRoomSettings("Roles & Permissions");
        combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("50");
    });

    test("should not see policy server configuration by default", async () => {
        const section = settings.locator(".mx_SettingsFieldset_legend").first();
        await expect(section).not.toHaveText("Policy server");
    });

    test("should be able to set policy server with labs flag enabled", async ({ app, page }) => {
        // Back out of the room settings dialog from beforeEach and enable the labs flag
        await app.settings.closeDialog();
        const labs = await app.settings.openUserSettings("Labs");
        await labs.getByLabel("Enable options to set up Policy Servers in rooms").check();
        await app.settings.closeDialog();

        // Go back to the room settings and verify our new options are there
        settings = await app.settings.openRoomSettings("Roles & Permissions");
        const section = settings.locator(".mx_SettingsFieldset_legend").first();
        await expect(section).toHaveText("Policy server");

        // Prepare to serve a valid policy server config
        await page.route("**/.well-known/matrix/org.matrix.msc4284.policy_server", async (route) => {
            await route.fulfill({
                status: 200,
                json: {
                    public_key: "not_a_real_key",
                },
            });
        });

        // Intercept our request to set the policy server
        await page.route("**/_matrix/client/*/rooms/*/state/org.matrix.msc4284.policy", async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                via: "localhost:1111",
                public_key: "not_a_real_key",
            });
            await route.fulfill({ status: 200 });
        });

        // Find the text box and choose a server which hits that route
        await section.locator("input").fill("http://localhost:1111");
        await section.locator(".mx_AccessibleButton").click();
        await expect(section.locator(".error")).not.toBeVisible();
    });
});
