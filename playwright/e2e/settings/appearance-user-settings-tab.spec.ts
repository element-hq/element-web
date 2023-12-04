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

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";

test.describe("Appearance user settings tab", () => {
    test.use({
        displayName: "Hanako",
    });

    test("should be rendered properly", async ({ page, user, app }) => {
        const tab = await app.settings.openUserSettings("Appearance");

        await expect(tab.getByRole("heading", { name: "Customise your appearance" })).toBeVisible();

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

    test("should support changing font size by clicking the font slider", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");

        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");
        const fontSliderSection = tab.locator(".mx_FontScalingPanel_fontSlider");

        await expect(fontSliderSection.getByLabel("Font size")).toBeVisible();

        const slider = fontSliderSection.getByRole("slider");
        // Click the left position of the slider
        await slider.click({ position: { x: 0, y: 10 } });

        const MIN_FONT_SIZE = 11;
        // Assert that the smallest font size is selected
        await expect(fontSliderSection.locator(`input[value='${MIN_FONT_SIZE}']`)).toBeVisible();
        await expect(
            fontSliderSection.locator("output .mx_Slider_selection_label", { hasText: String(MIN_FONT_SIZE) }),
        ).toBeVisible();

        await expect(fontSliderSection).toMatchScreenshot(`font-slider-${MIN_FONT_SIZE}.png`);

        // Click the right position of the slider
        await slider.click({ position: { x: 572, y: 10 } });

        const MAX_FONT_SIZE = 21;
        // Assert that the largest font size is selected
        await expect(fontSliderSection.locator(`input[value='${MAX_FONT_SIZE}']`)).toBeVisible();
        await expect(
            fontSliderSection.locator("output .mx_Slider_selection_label", { hasText: String(MAX_FONT_SIZE) }),
        ).toBeVisible();

        await expect(fontSliderSection).toMatchScreenshot(`font-slider-${MAX_FONT_SIZE}.png`);
    });

    test("should disable font size slider when custom font size is used", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");

        const panel = page.getByTestId("mx_FontScalingPanel");
        await panel.locator("label", { hasText: "Use custom size" }).click();

        // Assert that the font slider is disabled
        await expect(panel.locator(".mx_FontScalingPanel_fontSlider input[disabled]")).toBeVisible();
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
        test.beforeEach(async ({ app, user }) => {
            // Disable the default theme for consistency in case ThemeWatcher automatically chooses it
            await app.settings.setValue("use_system_theme", null, SettingLevel.DEVICE, false);
        });

        test("should be rendered with the light theme selected", async ({ page, app }) => {
            await app.settings.openUserSettings("Appearance");
            const themePanel = page.getByTestId("mx_ThemeChoicePanel");

            const useSystemTheme = themePanel.getByTestId("checkbox-use-system-theme");
            await expect(useSystemTheme.getByText("Match system theme")).toBeVisible();
            // Assert that 'Match system theme' is not checked
            // Note that mx_Checkbox_checkmark exists and is hidden by CSS if it is not checked
            await expect(useSystemTheme.locator(".mx_Checkbox_checkmark")).not.toBeVisible();

            const selectors = themePanel.getByTestId("theme-choice-panel-selectors");
            await expect(selectors.locator(".mx_ThemeSelector_light")).toBeVisible();
            await expect(selectors.locator(".mx_ThemeSelector_dark")).toBeVisible();
            // Assert that the light theme is selected
            await expect(selectors.locator(".mx_ThemeSelector_light.mx_StyledRadioButton_enabled")).toBeVisible();
            // Assert that the buttons for the light and dark theme are not enabled
            await expect(selectors.locator(".mx_ThemeSelector_light.mx_StyledRadioButton_disabled")).not.toBeVisible();
            await expect(selectors.locator(".mx_ThemeSelector_dark.mx_StyledRadioButton_disabled")).not.toBeVisible();

            // Assert that the checkbox for the high contrast theme is rendered
            await expect(themePanel.locator(".mx_Checkbox", { hasText: "Use high contrast" })).toBeVisible();
        });

        test("should disable the labels for themes and the checkbox for the high contrast theme if the checkbox for the system theme is clicked", async ({
            page,
            app,
        }) => {
            await app.settings.openUserSettings("Appearance");
            const themePanel = page.getByTestId("mx_ThemeChoicePanel");

            await themePanel.locator(".mx_Checkbox", { hasText: "Match system theme" }).click();

            // Assert that the labels for the light theme and dark theme are disabled
            await expect(themePanel.locator(".mx_ThemeSelector_light.mx_StyledRadioButton_disabled")).toBeVisible();
            await expect(themePanel.locator(".mx_ThemeSelector_dark.mx_StyledRadioButton_disabled")).toBeVisible();

            // Assert that there does not exist a label for an enabled theme
            await expect(themePanel.locator("label.mx_StyledRadioButton_enabled")).not.toBeVisible();

            // Assert that the checkbox and label to enable the high contrast theme should not exist
            await expect(themePanel.locator(".mx_Checkbox", { hasText: "Use high contrast" })).not.toBeVisible();
        });

        test("should not render the checkbox and the label for the high contrast theme if the dark theme is selected", async ({
            page,
            app,
        }) => {
            await app.settings.openUserSettings("Appearance");
            const themePanel = page.getByTestId("mx_ThemeChoicePanel");

            // Assert that the checkbox and the label to enable the high contrast theme should exist
            await expect(themePanel.locator(".mx_Checkbox", { hasText: "Use high contrast" })).toBeVisible();

            // Enable the dark theme
            await themePanel.locator(".mx_ThemeSelector_dark").click();

            // Assert that the checkbox and the label should not exist
            await expect(themePanel.locator(".mx_Checkbox", { hasText: "Use high contrast" })).not.toBeVisible();
        });
    });
});
