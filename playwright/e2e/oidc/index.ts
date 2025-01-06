/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { API, Messages } from "mailhog";
import { Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";

export const test = base.extend<{}>({
    config: async ({ homeserver, mas, context }, use) => {
        const issuer = `http://localhost:${mas.getMappedPort(8080)}/`;
        const wellKnown = {
            "m.homeserver": {
                base_url: homeserver.baseUrl,
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
