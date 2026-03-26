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
                brand: "TestBrand",
                modules: ["/modules/example-module.js"],
            },
            page: async ({ page }, use) => {
                await page.route("/modules/example-module.js", async (route) => {
                    await route.fulfill({ path: "playwright/sample-files/example-module.js" });
                });
                await use(page);
            },
        });

        const testCases = [
            ["en", "TestBrand module loading successful!"],
            ["de", "TestBrand-Module erfolgreich geladen!"],
        ];

        for (const [lang, message] of testCases) {
            test.describe(`language-${lang}`, () => {
                test.use({
                    config: async ({ config }, use) => {
                        await use({
                            ...config,
                            setting_defaults: {
                                language: lang,
                            },
                        });
                    },
                });

                test("should show alert", async ({ page }) => {
                    const dialogPromise = page.waitForEvent("dialog");
                    await page.goto("/");
                    const dialog = await dialogPromise;
                    expect(dialog.message()).toBe(message);
                });
            });
        }
    });
});
