/*
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
 */

import { Page } from "@playwright/test";

import { ElementAppPage } from "../../../pages/ElementAppPage";
import { test as base, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

export { expect };

/**
 * Set up for the appearance tab test
 */
export const test = base.extend<{
    util: Helpers;
}>({
    util: async ({ page, app }, use) => {
        await use(new Helpers(page, app));
    },
});

/**
 * A collection of helper functions for the appearance tab test
 * The goal is to make easier to get and interact with the button, input, or other elements of the appearance tab
 */
class Helpers {
    private CUSTOM_THEME_URL = "http://custom.theme";
    private CUSTOM_THEME = {
        name: "Custom theme",
        isDark: false,
        colors: {},
    };

    constructor(
        private page: Page,
        private app: ElementAppPage,
    ) {}

    /**
     * Open the appearance tab
     */
    openAppearanceTab() {
        return this.app.settings.openUserSettings("Appearance");
    }

    // Theme Panel

    /**
     * Disable in the settings the system theme
     */
    disableSystemTheme() {
        return this.app.settings.setValue("use_system_theme", null, SettingLevel.DEVICE, false);
    }

    /**
     * Return the theme section
     */
    getThemePanel() {
        return this.page.getByTestId("themePanel");
    }

    /**
     * Return the system theme toggle
     */
    getMatchSystemThemeCheckbox() {
        return this.getThemePanel().getByRole("checkbox");
    }

    /**
     * Return the theme radio button
     * @param theme - the theme to select
     * @private
     */
    private getThemeRadio(theme: string) {
        return this.getThemePanel().getByRole("radio", { name: theme });
    }

    /**
     * Return the light theme radio button
     */
    getLightTheme() {
        return this.getThemeRadio("Light");
    }

    /**
     * Return the dark theme radio button
     */
    getDarkTheme() {
        return this.getThemeRadio("Dark");
    }

    /**
     * Return the custom theme radio button
     */
    getCustomTheme() {
        return this.getThemeRadio(this.CUSTOM_THEME.name);
    }

    /**
     * Return the high contrast theme radio button
     */
    getHighContrastTheme() {
        return this.getThemeRadio("High contrast");
    }

    /**
     * Add a custom theme
     * Mock the request to the custom and return a fake local custom theme
     */
    async addCustomTheme() {
        await this.page.route(this.CUSTOM_THEME_URL, (route) =>
            route.fulfill({ body: JSON.stringify(this.CUSTOM_THEME) }),
        );
        await this.page.getByRole("textbox", { name: "Add custom theme" }).fill(this.CUSTOM_THEME_URL);
        await this.page.getByRole("button", { name: "Add custom theme" }).click();
        await this.page.unroute(this.CUSTOM_THEME_URL);
    }

    /**
     * Remove the custom theme
     */
    removeCustomTheme() {
        return this.getThemePanel().getByRole("listitem", { name: this.CUSTOM_THEME.name }).getByRole("button").click();
    }
}
