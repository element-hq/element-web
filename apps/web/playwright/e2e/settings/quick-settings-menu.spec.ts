/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Quick settings menu", () => {
    test("should be rendered properly", { tag: "@screenshot" }, async ({ app, page, user, axe }) => {
        await page.getByRole("button", { name: "Quick settings" }).click();
        // Assert that the top heading is renderedc
        const settings = page.getByTestId("quick-settings-menu");
        await expect(settings).toBeVisible();
        await expect(settings).toMatchScreenshot("quick-settings.png");

        await expect(axe).toHaveNoViolations();
    });

    test("should show the theme options without scrolling", async ({ page, user }) => {
        await page.getByRole("button", { name: "Quick settings" }).click();
        await page.getByRole("button", { name: "Theme" }).click();

        const menu = page.locator(".mx_QuickThemeSwitcher .mx_Dropdown_menu");
        await expect(menu).toBeVisible();
        // Guard: the built-in themes plus "Match system" are what makes the menu overflow, so the
        // assertion below is meaningless if the list came up short.
        expect(await menu.getByRole("option").count()).toBeGreaterThanOrEqual(3);

        // The menu is not a scroll container: nothing is hidden above or below its visible box.
        expect(await menu.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);

        // ...and the taller menu still lands on screen. Quick settings sits at the bottom of the
        // window, so simply uncapping a menu that drops downwards trades the scroll bar for an
        // option below the fold, which is worse.
        const menuBottom = await menu.evaluate((el) => el.getBoundingClientRect().bottom);
        expect(menuBottom).toBeLessThanOrEqual(page.viewportSize()!.height);
    });
});
