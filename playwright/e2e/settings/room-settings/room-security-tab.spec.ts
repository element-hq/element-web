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
        await app.client.createRoom({
            name: roomName,
            power_level_content_override: {
                events: {
                    // Set the join rules as lower than the history vis to test an edge case.
                    ["m.room.join_rules"]: 80,
                    ["m.room.history_visibility"]: 100,
                },
            },
        });
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

    test(
        "should automatically adjust history visibility when a room is changed from public to private",
        { tag: "@screenshot" },
        async ({ page, app, user, axe }) => {
            await page.setViewportSize({ width: 1024, height: 1400 });

            const settingsGroupAccess = page.getByRole("group", { name: "Access" });
            const settingsGroupHistory = page.getByRole("group", { name: "Who can read history?" });

            await settingsGroupAccess.getByText("Public").click();
            await settingsGroupHistory.getByText("Anyone").click();

            // Test that we have the warning appear.
            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(settings).toMatchScreenshot("room-security-settings-world-readable.png");

            await settingsGroupAccess.getByText("Private (invite only)").click();
            // Element should have automatically set the room to "sharing" history visibility
            await expect(
                settingsGroupHistory.getByText("Members only (since the point in time of selecting this option)"),
            ).toBeChecked();
        },
    );

    test(
        "should disallow changing from public to private if the user cannot alter history",
        { tag: "@screenshot" },
        async ({ page, app, user, bot }) => {
            await page.setViewportSize({ width: 1024, height: 1400 });

            const settingsGroupAccess = page.getByRole("group", { name: "Access" });
            const settingsGroupHistory = page.getByRole("group", { name: "Who can read history?" });

            await settingsGroupAccess.getByText("Public").click();
            await settingsGroupHistory.getByText("Anyone").click();

            // De-op ourselves
            await app.settings.switchTab("Roles & Permissions");

            // Wait for the permissions list to be visible
            await expect(settings.getByRole("heading", { name: "Permissions" })).toBeVisible();

            const ourComboBox = settings.getByRole("combobox", { name: user.userId });
            await ourComboBox.selectOption("Custom level");
            const ourPl = settings.getByRole("spinbutton", { name: user.userId });
            await ourPl.fill("80");
            await ourPl.blur(); // Shows a warning on

            // Accept the de-op
            await page.getByRole("button", { name: "Continue" }).click();
            await settings.getByRole("button", { name: "Apply", disabled: false }).click();

            await app.settings.switchTab("Security & Privacy");

            await settingsGroupAccess.getByText("Private (invite only)").click();
            // Element should have automatically set the room to "sharing" history visibility
            const errorDialog = page.getByRole("heading", { name: "Cannot make room private" });
            await expect(errorDialog).toBeVisible();
            await errorDialog.getByLabel("OK");
            await expect(settingsGroupHistory.getByText("Anyone")).toBeChecked();
        },
    );
});
