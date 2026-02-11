/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { interceptRequestsWithSoftLogout } from "./utils";

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

test.describe("Soft logout with password user", () => {
    test("shows the soft-logout page when a request fails, and allows a re-login", async ({ page, user }) => {
        await interceptRequestsWithSoftLogout(page, user);
        await expect(page.getByText("You're signed out")).toBeVisible();
        await page.getByPlaceholder("Password").fill(user.password);
        await page.getByPlaceholder("Password").press("Enter");

        // back to the welcome page
        await expect(page).toHaveURL(/\/#\/home/);
        await expect(page.getByRole("heading", { name: "Now, let's help you get started", exact: true })).toBeVisible();
    });

    test("still shows the soft-logout page when the page is reloaded after a soft-logout", async ({ page, user }) => {
        await interceptRequestsWithSoftLogout(page, user);
        await expect(page.getByText("You're signed out")).toBeVisible();
        await page.reload();
        await expect(page.getByText("You're signed out")).toBeVisible();
    });
});
