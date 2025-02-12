/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator } from "@playwright/test";

import { test, expect } from "../../element-web-test";

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
        const respPromise = page.waitForRequest("**/state/**");
        await applyButton.click();
        await respPromise;

        // Reload and check Alice is still Moderator (50)
        await page.reload();
        settings = await app.settings.openRoomSettings("Roles & Permissions");
        combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("50");
    });
});
