/*
 * Copyright 2025 New Vector Ltd.
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
        settings = await app.settings.openRoomSettings("Security & Privacy");
    });

    test(
        "should be able to toggle on encryption in a room",
        { tag: "@screenshot" },
        async ({ page, app, user, axe }) => {
            await page.setViewportSize({ width: 1024, height: 1400 });
            const encryptedToggle = settings.getByLabel("Encrypted");
            await encryptedToggle.click();

            // Accept the dialog.
            await page.getByRole("button", { name: "Ok " }).click();

            await expect(encryptedToggle).toBeChecked();
            await expect(encryptedToggle).toBeDisabled();

            await settings.getByLabel("Only send messages to verified users.").check();

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(settings).toMatchScreenshot("room-security-settings.png");
        },
    );
});
