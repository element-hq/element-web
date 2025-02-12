/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test.ts";
import { registerAccountMas } from ".";
import { ElementAppPage } from "../../pages/ElementAppPage.ts";
import { masHomeserver } from "../../plugins/homeserver/synapse/masHomeserver.ts";

test.use(masHomeserver);
test.describe("OIDC Native", { tag: ["@no-firefox", "@no-webkit"] }, () => {
    test.slow(); // trace recording takes a while here

    test("can register the oauth2 client and an account", async ({
        context,
        page,
        homeserver,
        mailpitClient,
        mas,
    }, testInfo) => {
        await page.clock.install();

        const tokenUri = `${mas.baseUrl}/oauth2/token`;
        const tokenApiPromise = page.waitForRequest(
            (request) => request.url() === tokenUri && request.postDataJSON()["grant_type"] === "authorization_code",
        );

        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();

        const userId = `alice_${testInfo.testId}`;
        await registerAccountMas(page, mailpitClient, userId, "alice@email.com", "Pa$sW0rD!");

        // Eventually, we should end up at the home screen.
        await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: `Welcome ${userId}`, exact: true })).toBeVisible();
        await page.clock.runFor(20000); // run the timer so we see the token request

        const tokenApiRequest = await tokenApiPromise;
        expect(tokenApiRequest.postDataJSON()["grant_type"]).toBe("authorization_code");

        const deviceId = await page.evaluate<string>(() => window.localStorage.mx_device_id);

        const app = new ElementAppPage(page);
        await app.settings.openUserSettings("Account");
        const newPagePromise = context.waitForEvent("page");
        await page.getByRole("button", { name: "Manage account" }).click();
        await app.settings.closeDialog();

        // Assert MAS sees the session as OIDC Native
        const newPage = await newPagePromise;
        await newPage.getByText("Devices").click();
        await newPage.getByText(deviceId).click();
        await expect(newPage.getByText("Element")).toBeVisible();
        await expect(newPage.getByText("http://localhost:8080/")).toBeVisible();
        await expect(newPage).toHaveURL(/\/oauth2_session/);
        await newPage.close();

        // Assert logging out revokes both tokens
        const revokeUri = `${mas.baseUrl}/oauth2/revoke`;
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
