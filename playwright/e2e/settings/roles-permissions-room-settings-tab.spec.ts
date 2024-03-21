/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import { Locator } from "@playwright/test";

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
        await applyButton.click();

        // Reload and check Alice is still Moderator (50)
        await page.reload();
        settings = await app.settings.openRoomSettings("Roles & Permissions");
        combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("50");
    });
});
