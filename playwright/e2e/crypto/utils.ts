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

import { type Page, expect } from "@playwright/test";

import { Credentials, HomeserverInstance } from "../../plugins/homeserver";

/**
 * Fill in the login form in element with the given creds.
 *
 * If a `securityKey` is given, verifies the new device using the key.
 */
export async function logIntoElement(
    page: Page,
    homeserver: HomeserverInstance,
    credentials: Credentials,
    securityKey?: string,
) {
    await page.goto("/#/login");

    // select homeserver
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
    await page.getByRole("button", { name: "Continue" }).click();

    // wait for the dialog to go away
    await expect(page.locator(".mx_ServerPickerDialog")).not.toBeVisible();

    await page.getByRole("textbox", { name: "Username" }).fill(credentials.userId);
    await page.getByPlaceholder("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // if a securityKey was given, verify the new device
    if (securityKey !== undefined) {
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Security Key" }).click();
        // Fill in the security key
        await page.locator(".mx_Dialog").locator('input[type="password"]').fill(securityKey);
        await page.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();
        await page.getByRole("button", { name: "Done" }).click();
    }
}
