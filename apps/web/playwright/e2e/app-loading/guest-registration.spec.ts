/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tests for application startup with guest registration enabled on the server.
 */

import { expect, test } from "../../element-web-test";

test.use({
    synapseConfig: {
        allow_guest_access: true,
    },
});

test("Shows the welcome page by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("Room link correctly loads a room view", async ({ page }) => {
    await page.goto("/#/room/!room:id");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
    await expect(page).toHaveURL(/\/#\/room\/!room:id$/);
    await expect(page.getByRole("heading", { name: "Join the conversation with an account" })).toBeVisible();
});
