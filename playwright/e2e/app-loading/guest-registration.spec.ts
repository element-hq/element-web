/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

/*
 * Tests for application startup with guest registration enabled on the server.
 */

import { expect, test } from "../../element-web-test";

test.use({
    startHomeserverOpts: "guest-enabled",
    config: async ({ homeserver }, use) => {
        await use({
            default_server_config: {
                "m.homeserver": { base_url: homeserver.config.baseUrl },
            },
        });
    },
});

test("Shows the welcome page by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("Room link correctly loads a room view", async ({ page }) => {
    await page.goto("/#/room/!room:id");
    await page.waitForSelector(".mx_MatrixChat", { timeout: 30000 });
    await expect(page).toHaveURL(/\/#\/room\/!room:id$/);
    await expect(page.getByRole("heading", { name: "Join the conversation with an account" })).toBeVisible();
});
