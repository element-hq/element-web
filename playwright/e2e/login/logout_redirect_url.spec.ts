/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import { consentHomeserver } from "../../plugins/homeserver/synapse/consentHomeserver.ts";

test.use(consentHomeserver);
test.use({
    config: {
        // We redirect to decoder-ring because it's a predictable page that isn't Element itself.
        // We could use example.org, matrix.org, or something else, however this puts dependency of external
        // infrastructure on our tests. In the same vein, we don't really want to figure out how to ship a
        // `test-landing.html` page when running with an uncontrolled Element (via `yarn start`).
        // Using the decoder-ring is just as fine, and we can search for strategic names.
        logout_redirect_url: "/decoder-ring/",
    },
});

test.describe("logout with logout_redirect_url", () => {
    test("should respect logout_redirect_url", async ({ page, user }) => {
        await page.getByRole("button", { name: "User menu" }).click();
        await expect(page.getByText(user.displayName, { exact: true })).toBeVisible();

        // give a change for the outstanding requests queue to settle before logging out
        await page.waitForTimeout(2000);

        await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
        await expect(page).toHaveURL(/\/decoder-ring\/$/);
    });
});
