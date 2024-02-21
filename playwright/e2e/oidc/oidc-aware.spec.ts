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

import { test, expect, registerAccountMas } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("OIDC Aware", () => {
    test.skip(isDendrite, "does not yet support MAS");
    test.slow(); // trace recording takes a while here

    test("can register an account and manage it", async ({ context, page, homeserver, mailhog, app }) => {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailhog.api, "alice", "alice@email.com", "Pa$sW0rD!");

        // Eventually, we should end up at the home screen.
        await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: "Welcome alice", exact: true })).toBeVisible();

        // Open settings and navigate to account management
        await app.settings.openUserSettings("General");
        const newPagePromise = context.waitForEvent("page");
        await page.getByRole("button", { name: "Manage account" }).click();

        // Assert new tab opened
        const newPage = await newPagePromise;
        await expect(newPage.getByText("Primary email")).toBeVisible();
    });
});
