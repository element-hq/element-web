/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page } from "playwright-core";
import { test, expect } from "../../element-web-test";

const screenshotOptions = (page?: Page) => ({
    // Hide the UserID
    css: `
        span[data-testid="userId"] {
            display: none !important;
        }
    `,
});

test.describe("User Menu", () => {
    test.use({ displayName: "Jeff" });

    test("should contain our name & userId", { tag: "@screenshot" }, async ({ page, user }) => {
        await page.getByRole("button", { name: "User menu", exact: true }).click();
        const menu = page.getByRole("menu");

        await expect(menu.getByText(user.displayName)).toBeVisible();
        await expect(menu.getByText(user.userId)).toBeVisible();
        await expect(menu).toMatchScreenshot("user-menu.png", screenshotOptions(page));
    });
});
