/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("UserView", () => {
    test.use({
        displayName: "Violet",
        botCreateOpts: { displayName: "Usman" },
    });

    test("should render the user view as expected", { tag: "@screenshot" }, async ({ page, homeserver, user, bot }) => {
        await page.goto(`/#/user/${bot.credentials.userId}`);

        const rightPanel = page.locator("#mx_RightPanel");
        await expect(rightPanel.getByRole("heading", { name: bot.credentials.displayName, exact: true })).toBeVisible();
        await expect(rightPanel).toMatchScreenshot("user-info.png", {
            mask: [page.locator(".mx_UserInfo_profile_mxid")],
            css: `
                /* Use monospace font for consistent mask width */
                .mx_UserInfo_profile_mxid {
                    font-family: Inconsolata !important;
                }
            `,
        });
    });
});
