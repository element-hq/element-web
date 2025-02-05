/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "@playwright/test";

import { type ElementAppPage } from "../../../pages/ElementAppPage";
import { test as base, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { Layout } from "../../../../src/settings/enums/Layout";

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

    /**
     * Compare screenshot and hide the matrix chat
     * @param locator
     * @param screenshot
     */
    assertScreenshot(locator: Locator, screenshot: `${string}.png`) {
        return expect(locator).toMatchScreenshot(screenshot, {
            css: `
                   #matrixchat {
                        display: none;
                    }
                `,
        });
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
        return this.getThemePanel().getByRole("checkbox", { name: "Match system theme" });
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

    // Message layout Panel

    /**
     * Create and display a room named Test Room
     */
    async createAndDisplayRoom() {
        await this.app.client.createRoom({ name: "Test Room" });
        await this.app.viewRoomByName("Test Room");
    }

    /**
     * Assert the room layout
     * @param layout
     * @private
     */
    private assertRoomLayout(layout: Layout) {
        return expect(this.page.locator(`.mx_RoomView_body[data-layout=${layout}]`)).toBeVisible();
    }

    /**
     * Assert the room layout is modern
     */
    assertModernLayout() {
        return this.assertRoomLayout(Layout.Group);
    }

    /**
     * Assert the room layout is bubble
     */
    assertBubbleLayout() {
        return this.assertRoomLayout(Layout.Bubble);
    }

    /**
     * Return the layout panel
     */
    getMessageLayoutPanel() {
        return this.page.getByTestId("layoutPanel");
    }

    /**
     * Return the layout radio button
     * @param layoutName
     * @private
     */
    private getLayout(layoutName: string) {
        return this.getMessageLayoutPanel().getByRole("radio", { name: layoutName });
    }

    /**
     * Return the message bubbles layout radio button
     */
    getBubbleLayout() {
        return this.getLayout("Message bubbles");
    }

    /**
     * Return the modern layout radio button
     */
    getModernLayout() {
        return this.getLayout("Modern");
    }

    /**
     * Return the IRC layout radio button
     */
    getIRCLayout() {
        return this.getLayout("IRC (experimental)");
    }

    /**
     * Return the compact layout checkbox
     */
    getCompactLayoutCheckbox() {
        return this.getMessageLayoutPanel().getByRole("checkbox", { name: "Show compact text and messages" });
    }

    /**
     * Assert the compact layout is enabled
     */
    assertCompactLayout() {
        return expect(
            this.page.locator("#matrixchat .mx_MatrixChat_wrapper.mx_MatrixChat_useCompactLayout"),
        ).toBeVisible();
    }
}
