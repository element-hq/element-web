/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page, expect, type TestInfo } from "@playwright/test";

import { type Credentials, type HomeserverInstance } from "../../plugins/homeserver";

/** Visit the login page, choose to log in with "OAuth test", register a new account, and redirect back to Element
 */
export async function doTokenRegistration(
    page: Page,
    homeserver: HomeserverInstance,
    testInfo: TestInfo,
): Promise<Credentials & { displayName: string }> {
    await page.goto("/#/login");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.baseUrl);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // wait for the dialog to go away
    await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);

    // click on "Continue with OAuth test"
    await page.getByRole("button", { name: "Continue with OAuth test" }).click();

    // wait for the Test OAuth Page to load
    await expect(page.getByText("Test OAuth page")).toBeVisible();

    // click the submit button
    await page.getByRole("button", { name: "Submit" }).click();

    // Synapse prompts us to pick a user ID
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("textbox", { name: "Username (required)" }).fill(`alice_${testInfo.testId}`);

    // wait for username validation to start, and complete
    await expect(page.locator("#field-username-output")).toHaveText("");
    await page.getByRole("button", { name: "Continue" }).click();

    // Synapse prompts us to grant permission to Element
    page.getByRole("heading", { name: "Continue to your account" });
    await page.getByRole("link", { name: "Continue" }).click();

    // Eventually, we should end up at the home screen.
    await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();

    return page.evaluate(() => ({
        accessToken: window.mxMatrixClientPeg.get().getAccessToken(),
        userId: window.mxMatrixClientPeg.get().getUserId(),
        deviceId: window.mxMatrixClientPeg.get().getDeviceId(),
        homeServer: window.mxMatrixClientPeg.get().getHomeserverUrl(),
        password: null,
        displayName: "Alice",
        username: window.mxMatrixClientPeg.get().getUserIdLocalpart(),
    }));
}

/**
 * Intercept calls to /sync and have them fail with a soft-logout
 *
 * Any further requests to /sync with the same access token are blocked.
 */
export async function interceptRequestsWithSoftLogout(page: Page, user: Credentials): Promise<void> {
    await page.route("**/_matrix/client/*/sync*", async (route, req) => {
        const accessToken = await req.headerValue("Authorization");

        // now, if the access token on this request matches the expired one, block it
        if (accessToken === `Bearer ${user.accessToken}`) {
            console.log("Intercepting request with soft-logged-out access token");
            await route.fulfill({
                status: 401,
                json: {
                    errcode: "M_UNKNOWN_TOKEN",
                    error: "Soft logout",
                    soft_logout: true,
                },
            });
            return;
        }

        // otherwise, pass through as normal
        await route.continue();
    });

    const promise = page.waitForResponse((resp) => resp.url().includes("/sync") && resp.status() === 401);

    // do something to make the active /sync return: create a new room
    await page.evaluate(() => {
        // don't wait for this to complete: it probably won't, because of the broken sync
        void window.mxMatrixClientPeg.get().createRoom({});
    });

    await promise;
}
