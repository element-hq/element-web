/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { MobileAppVariant } from "../../../src/vector/mobile_guide/mobile-apps";

const variants = [MobileAppVariant.Classic, MobileAppVariant.X, MobileAppVariant.Pro];

const IPHONE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

test.describe("Mobile Guide redirect", () => {
    test.use({
        userAgent: IPHONE_USER_AGENT,
        viewport: { width: 390, height: 844 },
    });

    test("should send a mobile browser to the mobile guide by default", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/mobile_guide\/?$/);
    });

    test.describe("with mobile_guide_toast disabled", () => {
        test.use({ config: { mobile_guide_toast: false } });

        test("should leave a mobile browser in the web app", async ({ page }) => {
            await page.goto("/");
            await expect(page.locator(".mx_Welcome")).toBeVisible();
            expect(page.url()).not.toContain("mobile_guide");
        });
    });
});

test.describe("Mobile Guide Screenshots", { tag: "@screenshot" }, () => {
    for (const variant of variants) {
        test.describe(`for variant ${variant}`, () => {
            test.use({
                config: {
                    default_server_config: {
                        "m.homeserver": {
                            base_url: "https://matrix.server.invalid",
                            server_name: "server.invalid",
                        },
                    },
                    mobile_guide_app_variant: variant,
                },
                viewport: { width: 390, height: 844 }, // iPhone 16e
            });

            test("should match the mobile_guide screenshot", async ({ page, axe }) => {
                await page.goto("/mobile_guide/");
                await expect(page).toMatchScreenshot(`mobile-guide-${variant}.png`);
                await expect(axe).toHaveNoViolations();
            });
        });
    }
});
