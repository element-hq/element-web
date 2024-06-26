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

    test("should be rendered properly", async ({ page, user, app }) => {
        const tab = await app.settings.openUserSettings("Appearance");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        // Assert that "Hide advanced" link button is rendered
        await expect(tab.getByRole("button", { name: "Hide advanced" })).toBeVisible();

        await expect(tab).toMatchScreenshot("appearance-tab.png");
    });

    test("should support switching layouts", async ({ page, user, app }) => {
        // Create and view a room first
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        await app.settings.openUserSettings("Appearance");

        const buttons = page.locator(".mx_LayoutSwitcher_RadioButton");

        // Assert that the layout selected by default is "Modern"
        await expect(
            buttons.locator(".mx_StyledRadioButton_enabled", {
                hasText: "Modern",
            }),
        ).toBeVisible();

        // Assert that the room layout is set to group (modern) layout
        await expect(page.locator(".mx_RoomView_body[data-layout='group']")).toBeVisible();

        // Select the first layout
        await buttons.first().click();
        // Assert that the layout selected is "IRC (Experimental)"
        await expect(buttons.locator(".mx_StyledRadioButton_enabled", { hasText: "IRC (Experimental)" })).toBeVisible();

        // Assert that the room layout is set to IRC layout
        await expect(page.locator(".mx_RoomView_body[data-layout='irc']")).toBeVisible();

        // Select the last layout
        await buttons.last().click();

        // Assert that the layout selected is "Message bubbles"
        await expect(buttons.locator(".mx_StyledRadioButton_enabled", { hasText: "Message bubbles" })).toBeVisible();

        // Assert that the room layout is set to bubble layout
        await expect(page.locator(".mx_RoomView_body[data-layout='bubble']")).toBeVisible();
    });

    test("should support changing font size by using the font size dropdown", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");

        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");
        const fontDropdown = tab.locator(".mx_FontScalingPanel_Dropdown");
        await expect(fontDropdown.getByLabel("Font size")).toBeVisible();

        // Default browser font size is 16px and the select value is 0
        // -4 value is 12px
        await fontDropdown.getByLabel("Font size").selectOption({ value: "-4" });

        await expect(page).toMatchScreenshot("window-12px.png");
    });

    test("should support enabling compact group (modern) layout", async ({ page, app, user }) => {
        // Create and view a room first
        await app.client.createRoom({ name: "Test Room" });
        await app.viewRoomByName("Test Room");

        await app.settings.openUserSettings("Appearance");

        // Click "Show advanced" link button
        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");
        await tab.getByRole("button", { name: "Show advanced" }).click();

        await tab.locator("label", { hasText: "Use a more compact 'Modern' layout" }).click();

        // Assert that the room layout is set to compact group (modern) layout
        await expect(page.locator("#matrixchat .mx_MatrixChat_wrapper.mx_MatrixChat_useCompactLayout")).toBeVisible();
    });

    test("should disable compact group (modern) layout option on IRC layout and bubble layout", async ({
        page,
        app,
        user,
    }) => {
        await app.settings.openUserSettings("Appearance");
        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");

        const checkDisabled = async () => {
            await expect(tab.getByRole("checkbox", { name: "Use a more compact 'Modern' layout" })).toBeDisabled();
        };

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        const buttons = page.locator(".mx_LayoutSwitcher_RadioButton");

        // Enable IRC layout
        await buttons.first().click();

        // Assert that the layout selected is "IRC (Experimental)"
        await expect(buttons.locator(".mx_StyledRadioButton_enabled", { hasText: "IRC (Experimental)" })).toBeVisible();

        await checkDisabled();

        // Enable bubble layout
        await buttons.last().click();

        // Assert that the layout selected is "IRC (Experimental)"
        await expect(buttons.locator(".mx_StyledRadioButton_enabled", { hasText: "Message bubbles" })).toBeVisible();

        await checkDisabled();
    });

    test("should support enabling system font", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");
        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        await tab.locator(".mx_Checkbox", { hasText: "Use bundled emoji font" }).click();
        await tab.locator(".mx_Checkbox", { hasText: "Use a system font" }).click();

        // Assert that the font-family value was removed
        await expect(page.locator("body")).toHaveCSS("font-family", '""');
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
