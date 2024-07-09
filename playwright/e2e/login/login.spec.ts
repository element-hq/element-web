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

import { expect, test } from "../../element-web-test";
import { doTokenRegistration } from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { selectHomeserver } from "../utils";

test.describe("Login", () => {
    test.describe("Password login", () => {
        test.use({ startHomeserverOpts: "consent" });

        const username = "user1234";
        const password = "p4s5W0rD";

        test.beforeEach(async ({ homeserver }) => {
            await homeserver.registerUser(username, password);
        });

        test("Loads the welcome page by default; then logs in with an existing account and lands on the home screen", async ({
            page,
            homeserver,
            checkA11y,
        }) => {
            await page.goto("/");

            // Should give us the welcome page initially
            await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();

            // Start the login process
            await page.getByRole("link", { name: "Sign in" }).click();

            // first pick the homeserver, as otherwise the user picker won't be visible
            await selectHomeserver(page, homeserver.config.baseUrl);

            await page.getByRole("button", { name: "Edit" }).click();

            // select the default server again
            await page.locator(".mx_StyledRadioButton").first().click();
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);
            await expect(page.locator(".mx_Spinner")).toHaveCount(0);
            // name of default server
            await expect(page.locator(".mx_ServerPicker_server")).toHaveText("server.invalid");

            // switch back to the custom homeserver
            await selectHomeserver(page, homeserver.config.baseUrl);

            await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24688
            // cy.percySnapshot("Login");
            await checkA11y();

            await page.getByRole("textbox", { name: "Username" }).fill(username);
            await page.getByPlaceholder("Password").fill(password);
            await page.getByRole("button", { name: "Sign in" }).click();

            await expect(page).toHaveURL(/\/#\/home$/);
        });

        test("Follows the original link after login", async ({ page, homeserver }) => {
            await page.goto("/#/room/!room:id"); // should redirect to the welcome page
            await page.getByRole("link", { name: "Sign in" }).click();

            await selectHomeserver(page, homeserver.config.baseUrl);

            await page.getByRole("textbox", { name: "Username" }).fill(username);
            await page.getByPlaceholder("Password").fill(password);
            await page.getByRole("button", { name: "Sign in" }).click();

            await expect(page).toHaveURL(/\/#\/room\/!room:id$/);
            await expect(page.getByRole("button", { name: "Join the discussion" })).toBeVisible();
        });
    });

    // tests for old-style SSO login, in which we exchange tokens with Synapse, and Synapse talks to an auth server
    test.describe("SSO login", () => {
        test.skip(isDendrite, "does not yet support SSO");

        test.use({
            startHomeserverOpts: ({ oAuthServer }, use) =>
                use({
                    template: "default",
                    oAuthServerPort: oAuthServer.port,
                }),
        });

        test("logs in with SSO and lands on the home screen", async ({ page, homeserver }) => {
            // If this test fails with a screen showing "Timeout connecting to remote server", it is most likely due to
            // your firewall settings: Synapse is unable to reach the OIDC server.
            //
            // If you are using ufw, try something like:
            //    sudo ufw allow in on docker0
            //
            await doTokenRegistration(page, homeserver);
        });
    });

    test.describe("logout", () => {
        test.use({ startHomeserverOpts: "consent" });

        test("should go to login page on logout", async ({ page, user }) => {
            await page.getByRole("button", { name: "User menu" }).click();
            await expect(page.getByText(user.displayName, { exact: true })).toBeVisible();

            // Allow the outstanding requests queue to settle before logging out
            await page.waitForTimeout(2000);

            await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
            await expect(page).toHaveURL(/\/#\/login$/);
        });
    });

    test.describe("logout with logout_redirect_url", () => {
        test.use({
            startHomeserverOpts: "consent",
            config: {
                // We redirect to decoder-ring because it's a predictable page that isn't Element itself.
                // We could use example.org, matrix.org, or something else, however this puts dependency of external
                // infrastructure on our tests. In the same vein, we don't really want to figure out how to ship a
                // `test-landing.html` page when running with an uncontrolled Element (via `yarn start`).
                // Using the decoder-ring is just as fine, and we can search for strategic names.
                logout_redirect_url: "/decoder-ring/",
            },
        });

        test("should respect logout_redirect_url", async ({ page, user }) => {
            await page.getByRole("button", { name: "User menu" }).click();
            await expect(page.getByText(user.displayName, { exact: true })).toBeVisible();

            // give a change for the outstanding requests queue to settle before logging out
            await page.waitForTimeout(2000);

            await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
            await expect(page).toHaveURL(/\/decoder-ring\/$/);
        });
    });
});
