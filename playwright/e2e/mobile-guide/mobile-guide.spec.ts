/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { MobileAppVariant } from "../../../src/vector/mobile_guide/mobile-apps";

const variants = [MobileAppVariant.Classic, MobileAppVariant.X, MobileAppVariant.Pro];

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
