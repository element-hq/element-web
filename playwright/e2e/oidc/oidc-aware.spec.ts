/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test, expect, registerAccountMas } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("OIDC Aware", () => {
    test.skip(isDendrite, "does not yet support MAS");
    test.slow(); // trace recording takes a while here

    test("can register an account and manage it", async ({ context, page, homeserver, mailhog, app }) => {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailhog.api, "alice", "alice@email.com", "Pa$sW0rD!");

        // Eventually, we should end up at the home screen.
        await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: "Welcome alice", exact: true })).toBeVisible();

        // Open settings and navigate to account management
        await app.settings.openUserSettings("Account");
        const newPagePromise = context.waitForEvent("page");
        await page.getByRole("button", { name: "Manage account" }).click();

        // Assert new tab opened
        const newPage = await newPagePromise;
        await expect(newPage.getByText("Primary email")).toBeVisible();
    });
});
