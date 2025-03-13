/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { consentHomeserver } from "../../plugins/homeserver/synapse/consentHomeserver.ts";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.use(consentHomeserver);
test.use({
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

test.describe("Registration", () => {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");

    test.beforeEach(async ({ page }) => {
        await page.goto("/#/register");
    });

    test(
        "registers an account and lands on the home screen",
        { tag: "@screenshot" },
        async ({ homeserver, page, checkA11y, crypto }) => {
            await page.getByRole("button", { name: "Edit", exact: true }).click();
            await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();

            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("server-picker.png");
            await checkA11y();

            await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.baseUrl);
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            // wait for the dialog to go away
            await expect(page.getByRole("dialog")).not.toBeVisible();

            await expect(page.getByRole("textbox", { name: "Username", exact: true })).toBeVisible();
            // Hide the server text as it contains the randomly allocated Homeserver port
            const screenshotOptions = {
                mask: [page.locator(".mx_ServerPicker_server")],
                includeDialogBackground: true,
            };
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
            await expect(page).toHaveURL(/\/#\/home$/);

            /*
             * Cross-signing checks
             */
            // check that the device considers itself verified
            await page.getByRole("button", { name: "User menu", exact: true }).click();
            await page.getByRole("menuitem", { name: "All settings", exact: true }).click();
            await page.getByRole("tab", { name: "Sessions", exact: true }).click();
            await expect(
                page.getByTestId("current-session-section").getByTestId("device-metadata-isVerified"),
            ).toHaveText("Verified");

            // check that cross-signing keys have been uploaded.
            await crypto.assertDeviceIsCrossSigned();
        },
    );

    test("should require username to fulfil requirements and be available", async ({ homeserver, page }) => {
        await page.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.baseUrl);
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
        await expect(page.getByRole("tooltip").filter({ hasText: "Some characters not allowed" })).toBeVisible();

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
        await expect(page.getByRole("tooltip").filter({ hasText: "Someone already has that username" })).toBeVisible();

        await page.getByRole("textbox", { name: "Username", exact: true }).fill("foobar");
        await expect(page.getByRole("tooltip")).not.toBeVisible();
    });
});
