/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { test, expect } from "../../element-web-test";

test.describe("Registration", () => {
    test.use({ startHomeserverOpts: "consent" });

    test.beforeEach(async ({ page }) => {
        await page.goto("/#/register");
    });

    test("registers an account and lands on the home screen", async ({ homeserver, page, checkA11y, crypto }) => {
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();

        await expect(page.locator(".mx_Dialog")).toMatchScreenshot("server-picker.png");
        await checkA11y();

        await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        // wait for the dialog to go away
        await expect(page.getByRole("dialog")).not.toBeVisible();

        await expect(page.getByRole("textbox", { name: "Username", exact: true })).toBeVisible();
        // Hide the server text as it contains the randomly allocated Homeserver port
        const screenshotOptions = { mask: [page.locator(".mx_ServerPicker_server")] };
        await expect(page).toMatchScreenshot("registration.png", screenshotOptions);
        await checkA11y();

        await page.getByRole("textbox", { name: "Username", exact: true }).fill("alice");
        await page.getByPlaceholder("Password", { exact: true }).fill("totally a great password");
        await page.getByPlaceholder("Confirm password", { exact: true }).fill("totally a great password");
        await page.getByRole("button", { name: "Register", exact: true }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(page).toMatchScreenshot("email-prompt.png", screenshotOptions);
        await checkA11y();
        await dialog.getByRole("button", { name: "Continue", exact: true }).click();

        await expect(page.locator(".mx_InteractiveAuthEntryComponents_termsPolicy")).toBeVisible();
        await expect(page).toMatchScreenshot("terms-prompt.png", screenshotOptions);
        await checkA11y();

        const termsPolicy = page.locator(".mx_InteractiveAuthEntryComponents_termsPolicy");
        await termsPolicy.getByRole("checkbox").click(); // Click the checkbox before terms of service anchor link
        await expect(termsPolicy.getByLabel("Privacy Policy")).toBeVisible();

        await page.getByRole("button", { name: "Accept", exact: true }).click();

        await expect(page.locator(".mx_UseCaseSelection_skip")).toBeVisible();
        await expect(page).toMatchScreenshot("use-case-selection.png", screenshotOptions);
        await checkA11y();
        await page.getByRole("button", { name: "Skip", exact: true }).click();

        await expect(page).toHaveURL(/\/#\/home$/);

        /*
         * Cross-signing checks
         */
        // check that the device considers itself verified
        await page.getByRole("button", { name: "User menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "All settings", exact: true }).click();
        await page.getByRole("tab", { name: "Sessions", exact: true }).click();
        await expect(page.getByTestId("current-session-section").getByTestId("device-metadata-isVerified")).toHaveText(
            "Verified",
        );

        // check that cross-signing keys have been uploaded.
        await crypto.assertDeviceIsCrossSigned();
    });

    test("should require username to fulfil requirements and be available", async ({ homeserver, page }) => {
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        // wait for the dialog to go away
        await expect(page.getByRole("dialog")).not.toBeVisible();

        await expect(page.getByRole("textbox", { name: "Username", exact: true })).toBeVisible();

        await page.route("**/_matrix/client/*/register/available?username=_alice", async (route) => {
            await route.fulfill({
                status: 400,
                json: {
                    errcode: "M_INVALID_USERNAME",
                    error: "User ID may not begin with _",
                },
            });
        });
        await page.getByRole("textbox", { name: "Username", exact: true }).fill("_alice");
        await expect(page.getByRole("alert").filter({ hasText: "Some characters not allowed" })).toBeVisible();

        await page.route("**/_matrix/client/*/register/available?username=bob", async (route) => {
            await route.fulfill({
                status: 400,
                json: {
                    errcode: "M_USER_IN_USE",
                    error: "The desired username is already taken",
                },
            });
        });
        await page.getByRole("textbox", { name: "Username", exact: true }).fill("bob");
        await expect(page.getByRole("alert").filter({ hasText: "Someone already has that username" })).toBeVisible();

        await page.getByRole("textbox", { name: "Username", exact: true }).fill("foobar");
        await expect(page.getByRole("alert")).not.toBeVisible();
    });
});
