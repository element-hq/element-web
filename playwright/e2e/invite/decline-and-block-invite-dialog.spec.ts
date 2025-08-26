/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Decline and block invite dialog", function () {
    test.use({
        displayName: "Hanako",
    });

    test(
        "should show decline and block dialog for a room",
        { tag: "@screenshot" },
        async ({ page, app, user, bot, axe }) => {
            await bot.createRoom({ name: "Test Room", invite: [user.userId] });
            await app.viewRoomByName("Test Room");
            await page.getByRole("button", { name: "Decline and block" }).click();

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("decline-and-block-invite-empty.png");
        },
    );
});
