/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "@playwright/test";
import { closeReleaseAnnouncementIfExists } from "@element-hq/element-web-playwright-common";

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
        compound: {
            "--cpd-color-bg-canvas-default": "tomato",
        },
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
     * Close the appearance tab
     */
    closeAppearanceTab() {
        return this.app.settings.closeDialog();
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
    getMatchSystemThemeSwitch() {
        return this.getThemePanel().getByRole("switch", { name: "Match system theme" });
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
     * Open the "Custom themes" devtools tool.
     * Assumes a room is currently open, since the devtools dialog requires an active room in
     * order to render its tool list, and that no other dialog is currently open.
     */
    private async openCustomThemesDevtool(): Promise<Locator> {
        // The release announcement can overlay the app and swallow the composer interaction
        await closeReleaseAnnouncementIfExists(this.page, "Introducing Sections");
        const composer = this.app.getComposer().locator("[contenteditable]");
        await composer.fill("/devtools");
        await composer.press("Enter");

        const dialog = this.page.locator(".mx_Dialog");
        await dialog.getByRole("button", { name: "Custom themes" }).click();
        return dialog;
    }

    /**
     * Add a custom theme via the devtools "Custom themes" tool.
     * Mocks the request to the custom theme URL and returns a fake local custom theme.
     * Assumes a room is currently open.
     */
    async addCustomTheme() {
        const dialog = await this.openCustomThemesDevtool();

        await this.page.route(this.CUSTOM_THEME_URL, (route) =>
            route.fulfill({ body: JSON.stringify(this.CUSTOM_THEME) }),
        );
        await dialog.getByRole("textbox", { name: "Custom theme URL" }).fill(this.CUSTOM_THEME_URL);
        await dialog.getByRole("button", { name: "Add custom theme" }).click();
        // Wait for the theme to be fetched and listed before removing the route,
        // otherwise the fetch can race the unroute and silently fail
        await expect(dialog.getByRole("listitem", { name: this.CUSTOM_THEME.name })).toBeVisible();
        await this.page.unroute(this.CUSTOM_THEME_URL);

        await this.app.closeDialog();
    }

    /**
     * Remove the custom theme via the devtools "Custom themes" tool.
     * Assumes a room is currently open.
     */
    async removeCustomTheme() {
        const dialog = await this.openCustomThemesDevtool();

        await dialog
            .getByRole("listitem", { name: this.CUSTOM_THEME.name })
            .getByRole("button", { name: "Delete" })
            .click();

        await this.app.closeDialog();
    }

    // Message layout Panel

    /**
     * Create and display a room named Test Room
     */
    async createAndDisplayRoom(): Promise<string> {
        const roomId = await this.app.client.createRoom({ name: "Test Room" });
        await this.app.viewRoomByName("Test Room");
        return roomId;
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
     * Return the compact layout switch
     */
    getCompactLayoutSwitch() {
        return this.getMessageLayoutPanel().getByRole("switch", { name: "Show compact text and messages" });
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
