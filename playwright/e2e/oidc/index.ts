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

import { API, Messages } from "mailhog";
import { Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";
import { MatrixAuthenticationService } from "../../plugins/matrix-authentication-service";
import { StartHomeserverOpts } from "../../plugins/homeserver";

export const test = base.extend<{
    masPrepare: MatrixAuthenticationService;
    mas: MatrixAuthenticationService;
}>({
    // There's a bit of a chicken and egg problem between MAS & Synapse where they each need to know how to reach each other
    // so spinning up a MAS is split into the prepare & start stage: prepare mas -> homeserver -> start mas to disentangle this.
    masPrepare: async ({ context }, use) => {
        const mas = new MatrixAuthenticationService(context);
        await mas.prepare();
        await use(mas);
    },
    mas: [
        async ({ masPrepare: mas, homeserver, mailhog }, use, testInfo) => {
            await mas.start(homeserver, mailhog.instance);
            await use(mas);
            await mas.stop(testInfo);
        },
        { auto: true },
    ],
    startHomeserverOpts: async ({ masPrepare }, use) => {
        await use({
            template: "mas-oidc",
            variables: {
                MAS_PORT: masPrepare.port,
            },
        });
    },
    config: async ({ homeserver, startHomeserverOpts, context }, use) => {
        const issuer = `http://localhost:${(startHomeserverOpts as StartHomeserverOpts).variables["MAS_PORT"]}/`;
        const wellKnown = {
            "m.homeserver": {
                base_url: homeserver.config.baseUrl,
            },
            "org.matrix.msc2965.authentication": {
                issuer,
                account: `${issuer}account`,
            },
        };

        // Ensure org.matrix.msc2965.authentication is in well-known
        await context.route("https://localhost/.well-known/matrix/client", async (route) => {
            await route.fulfill({ json: wellKnown });
        });

        await use({
            default_server_config: wellKnown,
        });
    },
});

export { expect };

export async function registerAccountMas(
    page: Page,
    mailhog: API,
    username: string,
    email: string,
    password: string,
): Promise<void> {
    await expect(page.getByText("Please sign in to continue:")).toBeVisible();

    await page.getByRole("link", { name: "Create Account" }).click();
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await page.getByRole("textbox", { name: "Email address" }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "Confirm Password" }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();

    let messages: Messages;
    await expect(async () => {
        messages = await mailhog.messages();
        expect(messages.items).toHaveLength(1);
    }).toPass();
    expect(messages.items[0].to).toEqual(`${username} <${email}>`);
    const [code] = messages.items[0].text.match(/(\d{6})/);

    await page.getByRole("textbox", { name: "6-digit code" }).fill(code);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Allow access to your account?")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
}
