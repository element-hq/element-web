/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test(`shows error page if browser lacks Intl support`, { tag: "@screenshot" }, async ({ page }) => {
    await page.addInitScript({ content: `delete window.Intl;` });
    await page.goto("/");

    // Lack of Intl support causes the app bundle to fail to load, so we get the iframed
    // static error page and need to explicitly look in the iframe because Playwright doesn't
    // recurse into iframes when looking for elements
    const header = page.frameLocator("iframe").getByText("Unsupported browser");
    await expect(header).toBeVisible();

    await expect(page).toMatchScreenshot("unsupported-browser.png");
});

test(`shows error page if browser lacks WebAssembly support`, { tag: "@screenshot" }, async ({ page }) => {
    await page.addInitScript({ content: `delete window.WebAssembly;` });
    await page.goto("/");

    // Lack of WebAssembly support doesn't cause the bundle to fail loading, so we get
    // CompatibilityView, i.e. no iframes.
    const header = page.getByText("Element does not support this browser");
    await expect(header).toBeVisible();

    await expect(page).toMatchScreenshot("unsupported-browser-CompatibilityView.png");
});
