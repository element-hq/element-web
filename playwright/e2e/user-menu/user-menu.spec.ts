/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("User Menu", () => {
    test.use({ displayName: "Jeff" });

    test("should contain our name & userId", { tag: "@screenshot" }, async ({ page, user }) => {
        await page.getByRole("button", { name: "User menu", exact: true }).click();
        const menu = page.getByRole("menu");

        await expect(menu.locator(".mx_UserMenu_contextMenu_displayName", { hasText: user.displayName })).toBeVisible();
        await expect(menu.locator(".mx_UserMenu_contextMenu_userId", { hasText: user.userId })).toBeVisible();
        await expect(menu).toMatchScreenshot("user-menu.png");
    });
});
