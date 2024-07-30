/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { test, expect } from "../../element-web-test";

test(`shows error page if browser lacks Intl support`, async ({ page }) => {
    await page.addInitScript({ content: `delete window.Intl;` });
    await page.goto("/");

    // Lack of Intl support causes the app bundle to fail to load, so we get the iframed
    // static error page and need to explicitly look in the iframe because Playwright doesn't
    // recurse into iframes when looking for elements
    const header = page.frameLocator("iframe").getByText("Unsupported browser");
    await expect(header).toBeVisible();

    await expect(page).toMatchScreenshot("unsupported-browser.png");
});

test(`shows error page if browser lacks WebAssembly support`, async ({ page }) => {
    await page.addInitScript({ content: `delete window.WebAssembly;` });
    await page.goto("/");

    // Lack of WebAssembly support doesn't cause the bundle to fail loading, so we get
    // CompatibilityView, i.e. no iframes.
    const header = page.getByText("Element does not support this browser");
    await expect(header).toBeVisible();

    await expect(page).toMatchScreenshot("unsupported-browser-CompatibilityView.png");
});
