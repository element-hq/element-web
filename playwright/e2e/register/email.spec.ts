/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { emailHomeserver } from "../../plugins/homeserver/synapse/emailHomeserver.ts";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.use(emailHomeserver);
test.use({
    config: ({ config }, use) =>
        use({
            ...config,
            default_server_config: {
                ...config.default_server_config,
                "m.identity_server": {
                    base_url: "https://server.invalid",
                },
            },
        }),
});

test.describe("Email Registration", async () => {
    test.skip(isDendrite, "not yet wired up");

    test.beforeEach(async ({ homeserver, page }) => {
        await page.goto("/#/register");
    });

    test(
        "registers an account and lands on the home page",
        { tag: "@screenshot" },
        async ({ page, mailpitClient, request, checkA11y }) => {
            await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
            // Hide the server text as it contains the randomly allocated Homeserver port
            const screenshotOptions = { mask: [page.locator(".mx_ServerPicker_server")] };

            await page.getByRole("textbox", { name: "Username" }).fill("alice");
            await page.getByPlaceholder("Password", { exact: true }).fill("totally a great password");
            await page.getByPlaceholder("Confirm password").fill("totally a great password");
            await page.getByPlaceholder("Email").fill("alice@email.com");
            await page.getByRole("button", { name: "Register" }).click();

            await expect(page.getByText("Check your email to continue")).toBeVisible();
            await expect(page).toMatchScreenshot("registration_check_your_email.png", screenshotOptions);
            await checkA11y();

            await expect(page.getByText("An error was encountered when sending the email")).not.toBeVisible();

            const messages = await mailpitClient.listMessages();
            expect(messages.messages).toHaveLength(1);
            expect(messages.messages[0].To[0].Address).toEqual("alice@email.com");
            const text = await mailpitClient.renderMessageText(messages.messages[0].ID);
            const [emailLink] = text.match(/http.+/);
            await request.get(emailLink); // "Click" the link in the email

            await expect(page.getByText("Welcome alice")).toBeVisible();
        },
    );
});
