/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test as base } from "../../element-web-test";

const test = base.extend({
    // Same as the base `user` fixture, but delays the first `/sync` response so we can inspect
    // the app's state while the client is still waiting for it to complete.
    user: async ({ pageWithCredentials: page, credentials }, use) => {
        let delayedOnce = false;
        await page.route("**/_matrix/client/*/sync*", async (route) => {
            if (!delayedOnce) {
                delayedOnce = true;
                await new Promise((resolve) => setTimeout(resolve, 4000));
            }
            await route.continue();
        });

        await page.goto("/");
        // Deliberately do NOT wait for `.mx_MatrixChat` here (unlike the base fixture) — this
        // test needs to inspect state before the first sync completes.
        await use(credentials);
    },
});

test.describe("session restore", () => {
    test("should not show the logged-in view until the first sync completes", async ({ page, user }) => {
        test.slow();

        // The app should still be on the pre-sync splash screen while /sync is delayed.
        await expect(page.getByTestId("spinner")).toBeVisible();

        // Wait *some* time* to check that the spinner doesn't insta-resolve.
        await page.waitForTimeout(2000);
        await expect(page.locator(".mx_MatrixChat")).not.toBeVisible();

        // Once the delayed /sync resolves, the real logged-in view should appear.
        await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
    });
});
