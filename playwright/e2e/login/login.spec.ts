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

import { checkA11y, injectAxe } from "axe-playwright";

import { test, expect } from "../../element-web-test";

test.describe("Consent", () => {
    test.describe("m.login.password", () => {
        test.use({ startHomeserverOpts: "consent" });

        const username = "user1234";
        const password = "p4s5W0rD";

        test.beforeEach(async ({ page, homeserver }) => {
            await homeserver.registerUser(username, password);
            await page.goto("/#/login");
        });

        test("logs in with an existing account and lands on the home screen", async ({ page, homeserver }) => {
            await injectAxe(page);

            // first pick the homeserver, as otherwise the user picker won't be visible
            await page.getByRole("button", { name: "Edit" }).click();
            await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            // wait for the dialog to go away
            await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);

            await expect(page.locator(".mx_Spinner")).toHaveCount(0);
            await expect(page.locator(".mx_ServerPicker_server")).toHaveText(homeserver.config.baseUrl);

            await page.getByRole("button", { name: "Edit" }).click();

            // select the default server again
            await page.locator(".mx_StyledRadioButton").first().click();
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);
            await expect(page.locator(".mx_Spinner")).toHaveCount(0);
            // name of default server
            await expect(page.locator(".mx_ServerPicker_server")).toHaveText("server.invalid");

            // switch back to the custom homeserver
            await page.getByRole("button", { name: "Edit" }).click();
            await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            // wait for the dialog to go away
            await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);

            await expect(page.locator(".mx_Spinner")).toHaveCount(0);
            await expect(page.locator(".mx_ServerPicker_server")).toHaveText(homeserver.config.baseUrl);

            await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24688
            // cy.percySnapshot("Login");
            await checkA11y(page);

            await page.getByRole("textbox", { name: "Username" }).fill(username);
            await page.getByPlaceholder("Password").fill(password);
            await page.getByRole("button", { name: "Sign in" }).click();

            await expect(page).toHaveURL(/\/#\/home$/);
        });
    });
});
