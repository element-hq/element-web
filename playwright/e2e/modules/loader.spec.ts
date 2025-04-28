/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Module loading", () => {
    test.use({
        displayName: "Manny",
    });

    test.describe("Example Module", () => {
        test.use({
            config: {
                modules: ["/modules/example-module.js"],
            },
            page: async ({ page }, use) => {
                await page.route("/modules/example-module.js", async (route) => {
                    await route.fulfill({ path: "playwright/sample-files/example-module.js" });
                });
                await use(page);
            },
        });

        test("should show alert", async ({ page }) => {
            const dialogPromise = page.waitForEvent("dialog");
            await page.goto("/");
            const dialog = await dialogPromise;
            expect(dialog.message()).toBe("Testing module loading successful!");
        });
    });
});
