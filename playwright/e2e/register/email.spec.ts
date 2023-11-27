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

import { test, expect } from "../../element-web-test";
import { MailHogServer } from "../../plugins/mailhog";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Email Registration", async () => {
    test.skip(isDendrite, "not yet wired up");

    test.use({
        // eslint-disable-next-line no-empty-pattern
        mailhog: async ({}, use) => {
            const mailhog = new MailHogServer();
            const instance = await mailhog.start();
            await use(instance);
            await mailhog.stop();
        },
        startHomeserverOpts: ({ mailhog }, use) =>
            use({
                template: "email",
                variables: {
                    SMTP_HOST: "{{HOST_DOCKER_INTERNAL}}", // This will get replaced in synapseStart
                    SMTP_PORT: mailhog.instance.smtpPort,
                },
            }),
        config: ({ homeserver }, use) =>
            use({
                default_server_config: {
                    "m.homeserver": {
                        base_url: homeserver.config.baseUrl,
                    },
                    "m.identity_server": {
                        base_url: "https://server.invalid",
                    },
                },
            }),
    });

    test.beforeEach(async ({ page }) => {
        await page.goto("/#/register");
    });

    test("registers an account and lands on the use case selection screen", async ({
        page,
        mailhog,
        request,
        checkA11y,
    }) => {
        await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
        // Hide the server text as it contains the randomly allocated Homeserver port
        const screenshotOptions = { mask: [page.locator(".mx_ServerPicker_server")] };

        await page.getByRole("textbox", { name: "Username" }).fill("alice");
        await page.getByPlaceholder("Password", { exact: true }).fill("totally a great password");
        await page.getByPlaceholder("Confirm password").fill("totally a great password");
        await page.getByPlaceholder("Email").fill("alice@email.com");
        await page.getByRole("button", { name: "Register" }).click();

        await expect(page.getByText("Check your email to continue")).toBeVisible();
        await expect(page).toHaveScreenshot("registration_check_your_email.png", screenshotOptions);
        await checkA11y();

        await expect(page.getByText("An error was encountered when sending the email")).not.toBeVisible();

        const messages = await mailhog.api.messages();
        expect(messages.items).toHaveLength(1);
        expect(messages.items[0].to).toEqual("alice@email.com");
        const [emailLink] = messages.items[0].text.match(/http.+/);
        await request.get(emailLink); // "Click" the link in the email

        await expect(page.locator(".mx_UseCaseSelection_skip")).toBeVisible();
    });
});
