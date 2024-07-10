/*
Copyright 2023 Suguru Hirahara

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

        test("should be rendered with the light theme selected", async ({ page, app, util }) => {
            // Assert that 'Match system theme' is not checked
            await expect(util.getMatchSystemThemeCheckbox()).not.toBeChecked();

            // Assert that the light theme is selected
            await expect(util.getLightTheme()).toBeChecked();
            // Assert that the dark and high contrast themes are not selected
            await expect(util.getDarkTheme()).not.toBeChecked();
            await expect(util.getHighContrastTheme()).not.toBeChecked();

            await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-light.png");
        });

        test("should disable the themes when the system theme is clicked", async ({ page, app, util }) => {
            await util.getMatchSystemThemeCheckbox().click();

            // Assert that the themes are disabled
            await expect(util.getLightTheme()).toBeDisabled();
            await expect(util.getDarkTheme()).toBeDisabled();
            await expect(util.getHighContrastTheme()).toBeDisabled();

            await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-match-system-enabled.png");
        });

        test("should change the theme to dark", async ({ page, app, util }) => {
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

            test("should render the custom theme section", async ({ page, app, util }) => {
                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme.png");
            });

            test("should be able to add and remove a custom theme", async ({ page, app, util }) => {
                await util.addCustomTheme();

                await expect(util.getCustomTheme()).not.toBeChecked();
                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme-added.png");

                await util.removeCustomTheme();
                await expect(util.getThemePanel()).toMatchScreenshot("theme-panel-custom-theme.png");
            });
        });
    });
});
