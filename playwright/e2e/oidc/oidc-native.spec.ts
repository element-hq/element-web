/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test, expect, registerAccountMas } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("OIDC Native", () => {
    test.skip(isDendrite, "does not yet support MAS");
    test.slow(); // trace recording takes a while here

    test.use({
        labsFlags: ["feature_oidc_native_flow"],
    });

    test("can register the oauth2 client and an account", async ({ context, page, homeserver, mailhog, app, mas }) => {
        const tokenUri = `http://localhost:${mas.port}/oauth2/token`;
        const tokenApiPromise = page.waitForRequest(
            (request) => request.url() === tokenUri && request.postDataJSON()["grant_type"] === "authorization_code",
        );

        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailhog.api, "alice", "alice@email.com", "Pa$sW0rD!");

        // Eventually, we should end up at the home screen.
        await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: "Welcome alice", exact: true })).toBeVisible();

        const tokenApiRequest = await tokenApiPromise;
        expect(tokenApiRequest.postDataJSON()["grant_type"]).toBe("authorization_code");

        const deviceId = await page.evaluate<string>(() => window.localStorage.mx_device_id);

        await app.settings.openUserSettings("Account");
        const newPagePromise = context.waitForEvent("page");
        await page.getByRole("button", { name: "Manage account" }).click();
        await app.settings.closeDialog();

        // Assert MAS sees the session as OIDC Native
        const newPage = await newPagePromise;
        await newPage.getByText("Sessions").click();
        await newPage.getByText(deviceId).click();
        await expect(newPage.getByText("Element")).toBeVisible();
        await expect(newPage.getByText("oauth2_session:")).toBeVisible();
        await expect(newPage.getByText("http://localhost:8080/")).toBeVisible();
        await newPage.close();

        // Assert logging out revokes both tokens
        const revokeUri = `http://localhost:${mas.port}/oauth2/revoke`;
        const revokeAccessTokenPromise = page.waitForRequest(
            (request) => request.url() === revokeUri && request.postDataJSON()["token_type_hint"] === "access_token",
        );
        const revokeRefreshTokenPromise = page.waitForRequest(
            (request) => request.url() === revokeUri && request.postDataJSON()["token_type_hint"] === "refresh_token",
        );
        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();
        await revokeAccessTokenPromise;
        await revokeRefreshTokenPromise;
    });
});
