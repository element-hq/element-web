/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { doTokenRegistration, interceptRequestsWithSoftLogout } from "./utils";
import { legacyOAuthHomeserver } from "../../plugins/homeserver/synapse/legacyOAuthHomeserver.ts";

test.use({
    displayName: "Alice",
    config: {
        // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
        // We point that to a guaranteed-invalid domain.
        default_server_config: {
            "m.homeserver": {
                base_url: "https://server.invalid",
            },
        },
    },
});

test.use(legacyOAuthHomeserver);
test.describe("Soft logout with SSO user", () => {
    test.use({
        user: async ({ page, homeserver }, use, testInfo) => {
            const user = await doTokenRegistration(page, homeserver, testInfo);

            // Eventually, we should end up at the home screen.
            await expect(page).toHaveURL(/\/#\/home$/);
            await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();

            await use(user);
        },
    });

    test("shows the soft-logout page when a request fails, and allows a re-login", async ({ page, user }) => {
        await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();

        await interceptRequestsWithSoftLogout(page, user);

        await expect(page.getByText("You're signed out")).toBeVisible();
        await page.getByRole("button", { name: "Continue with OAuth test" }).click();

        // click the submit button
        await page.getByRole("button", { name: "Submit" }).click();

        // Synapse prompts us to grant permission to Element
        await expect(page.getByRole("heading", { name: "Continue to your account" })).toBeVisible();
        await page.getByRole("link", { name: "Continue" }).click();

        // back to the welcome page
        await expect(page).toHaveURL(/\/#\/home$/);
        await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();
    });
});
