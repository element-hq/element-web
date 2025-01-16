/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("PSTN", () => {
    test.beforeEach(async ({ page }) => {
        // Mock the third party protocols endpoint to look like the HS has PSTN support
        await page.route("**/_matrix/client/v3/thirdparty/protocols", async (route) => {
            await route.fulfill({
                status: 200,
                json: {
                    "im.vector.protocol.pstn": {},
                },
            });
        });
    });

    test("should render dialpad as expected", { tag: "@screenshot" }, async ({ page, user, toasts }) => {
        await toasts.rejectToast("Notifications");
        await toasts.assertNoToasts();

        await expect(page.locator(".mx_LeftPanel_filterContainer")).toMatchScreenshot("dialpad-trigger.png");
        await page.getByLabel("Open dial pad").click();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("dialpad.png");
    });
});
