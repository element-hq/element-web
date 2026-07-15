/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";

test.describe("Platform API", () => {
    test.use({
        displayName: "Manny",
        config: {
            modules: ["/modules/platform-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/platform-module.js", async (route) => {
                await route.fulfill({ path: getSampleFilePath("platform-module.js") });
            });
            await use(page);
        },
    });

    test("should read a pickle key via api.platform.getPickleKey", async ({ page }) => {
        const dialogPromise = page.waitForEvent("dialog");
        await page.goto("/");
        const dialog = await dialogPromise;
        expect(dialog.message()).toBe("null");
    });
});
