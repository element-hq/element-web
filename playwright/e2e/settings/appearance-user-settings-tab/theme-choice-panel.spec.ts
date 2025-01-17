/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from ".";

test.describe("Appearance user settings tab", () => {
    test.use({
        displayName: "Hanako",
    });

    test.describe("Theme Choice Panel", () => {
        test.beforeEach(async ({ app, user, util }) => {
            // Disable the default theme for consistency in case ThemeWatcher automatically chooses it
            await util.disableSystemTheme();
            await util.openAppearanceTab();
        });

        test(
            "should be rendered with the light theme selected",
            { tag: "@screenshot" },
            async ({ page, app, util }) => {
                // Assert that 'Match system theme' is not checked
                await expect(util.getMatchSystemThemeCheckbox()).not.toBeChecked();

                // Assert that the light theme is selected
                await expect(util.getLightTheme()).toBeChecked();
                // Assert that the dark and high contrast themes are not selected
                await expect(util.getDarkTheme()).not.toBeChecked();
                await expect(util.getHighContrastTheme()).not.toBeChecked();

                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-light.png");
            },
        );

        test(
            "should disable the themes when the system theme is clicked",
            { tag: "@screenshot" },
            async ({ page, app, util }) => {
                await util.getMatchSystemThemeCheckbox().click();

                // Assert that the themes are disabled
                await expect(util.getLightTheme()).toBeDisabled();
                await expect(util.getDarkTheme()).toBeDisabled();
                await expect(util.getHighContrastTheme()).toBeDisabled();

                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-match-system-enabled.png");
            },
        );

        test("should change the theme to dark", { tag: "@screenshot" }, async ({ page, app, util }) => {
            // Assert that the light theme is selected
            await expect(util.getLightTheme()).toBeChecked();

            await util.getDarkTheme().click();

            // Assert that the light and high contrast themes are not selected
            await expect(util.getLightTheme()).not.toBeChecked();
            await expect(util.getDarkTheme()).toBeChecked();
            await expect(util.getHighContrastTheme()).not.toBeChecked();

            await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-dark.png");
        });

        test.describe("custom theme", () => {
            test.use({
                labsFlags: ["feature_custom_themes"],
            });

            test("should render the custom theme section", { tag: "@screenshot" }, async ({ page, app, util }) => {
                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme.png");
            });

            test(
                "should be able to add and remove a custom theme",
                { tag: "@screenshot" },
                async ({ page, app, util }) => {
                    await util.addCustomTheme();

                    await expect(util.getCustomTheme()).not.toBeChecked();
                    await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme-added.png");

                    await util.removeCustomTheme();
                    await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme-removed.png");
                },
            );
        });
    });
});
