/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { doTokenRegistration } from "./utils";
import { Credentials } from "../../plugins/utils/homeserver";

test.describe("Soft logout", () => {
    test.use({
        displayName: "Alice",
        startHomeserverOpts: ({ oAuthServer }, use) =>
            use({
                template: "default",
                oAuthServerPort: oAuthServer.port,
            }),
    });

    test.describe("with password user", () => {
        test("shows the soft-logout page when a request fails, and allows a re-login", async ({ page, user }) => {
            await interceptRequestsWithSoftLogout(page, user);
            await expect(page.getByText("You're signed out")).toBeVisible();
            await page.getByPlaceholder("Password").fill(user.password);
            await page.getByPlaceholder("Password").press("Enter");

            // back to the welcome page
            await expect(page).toHaveURL(/\/#\/home/);
            await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();
        });

        test("still shows the soft-logout page when the page is reloaded after a soft-logout", async ({
            page,
            user,
        }) => {
            await interceptRequestsWithSoftLogout(page, user);
            await expect(page.getByText("You're signed out")).toBeVisible();
            await page.reload();
            await expect(page.getByText("You're signed out")).toBeVisible();
        });
    });

    test.describe("with SSO user", () => {
        test.use({
            user: async ({ page, homeserver }, use) => {
                const user = await doTokenRegistration(page, homeserver);

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
});

/**
 * Intercept calls to /sync and have them fail with a soft-logout
 *
 * Any further requests to /sync with the same access token are blocked.
 */
async function interceptRequestsWithSoftLogout(page: Page, user: Credentials): Promise<void> {
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

    // do something to make the active /sync return: create a new room
    await page.evaluate(() => {
        // don't wait for this to complete: it probably won't, because of the broken sync
        window.mxMatrixClientPeg.get().createRoom({});
    });

    await page.waitForResponse((resp) => resp.url().includes("/sync") && resp.status() === 401);
}
