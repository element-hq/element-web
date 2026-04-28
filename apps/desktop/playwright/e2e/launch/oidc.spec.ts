/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-desktop-test.js";

declare global {
    interface ElectronPlatform {
        getOidcCallbackUrl(): URL;
    }

    interface Window {
        mxPlatformPeg: {
            get(): ElectronPlatform;
        };
    }
}

test.describe("OIDC Native", () => {
    test.slow();

    test.beforeEach(async ({ page }) => {
        await page.locator(".mx_Welcome").waitFor();
    });

    test("should use OIDC callback URL without authority component", async ({ page }) => {
        await expect(
            page.evaluate<string>(() => {
                return window.mxPlatformPeg.get().getOidcCallbackUrl().toString();
            }),
        ).resolves.toMatch(/io\.element\.(desktop|nightly):\/vector\/webapp\//);
    });
});
