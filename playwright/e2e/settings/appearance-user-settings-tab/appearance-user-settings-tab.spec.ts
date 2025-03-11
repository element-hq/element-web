/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from ".";

test.describe("Appearance user settings tab", () => {
    test.use({
        displayName: "Hanako",
    });

    test("should be rendered properly", { tag: "@screenshot" }, async ({ page, user, app }) => {
        const tab = await app.settings.openUserSettings("Appearance");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        // Assert that "Hide advanced" link button is rendered
        await expect(tab.getByRole("button", { name: "Hide advanced" })).toBeVisible();

        await expect(tab).toMatchScreenshot("appearance-tab.png");
    });

    test(
        "should support changing font size by using the font size dropdown",
        { tag: "@screenshot" },
        async ({ page, app, user }) => {
            await app.settings.openUserSettings("Appearance");

            const tab = page.getByTestId("mx_AppearanceUserSettingsTab");
            const fontDropdown = tab.locator(".mx_FontScalingPanel_Dropdown");
            await expect(fontDropdown.getByLabel("Font size")).toBeVisible();

            // Default browser font size is 16px and the select value is 0
            // -4 value is 12px
            await fontDropdown.getByLabel("Font size").selectOption({ value: "-4" });

            await expect(page).toMatchScreenshot("window-12px.png", { includeDialogBackground: true });
        },
    );

    test("should support enabling system font", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");
        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        await tab.getByLabel("Use bundled emoji font").click();
        await tab.getByLabel("Use a system font").click();

        // Assert that the font-family value was removed
        await expect(page.locator("body")).toHaveCSS("font-family", '""');
    });
});
