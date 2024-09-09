/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Page, expect } from "@playwright/test";

import { Credentials, HomeserverInstance } from "../../plugins/homeserver";

/** Visit the login page, choose to log in with "OAuth test", register a new account, and redirect back to Element
 */
export async function doTokenRegistration(
    page: Page,
    homeserver: HomeserverInstance,
): Promise<Credentials & { displayName: string }> {
    await page.goto("/#/login");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
    await page.getByRole("button", { name: "Continue" }).click();
    // wait for the dialog to go away
    await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);

    // click on "Continue with OAuth test"
    await page.getByRole("button", { name: "Continue with OAuth test" }).click();

    // wait for the Test OAuth Page to load
    await expect(page.getByText("Test OAuth page")).toBeVisible();

    // click the submit button
    await page.getByRole("button", { name: "Submit" }).click();

    // Synapse prompts us to pick a user ID
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("textbox", { name: "Username (required)" }).fill("alice");

    // wait for username validation to start, and complete
    await expect(page.locator("#field-username-output")).toHaveText("");
    await page.getByRole("button", { name: "Continue" }).click();

    // Synapse prompts us to grant permission to Element
    page.getByRole("heading", { name: "Continue to your account" });
    await page.getByRole("link", { name: "Continue" }).click();

    // Eventually, we should end up at the home screen.
    await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Welcome Alice", exact: true })).toBeVisible();

    return page.evaluate(() => ({
        accessToken: window.mxMatrixClientPeg.get().getAccessToken(),
        userId: window.mxMatrixClientPeg.get().getUserId(),
        deviceId: window.mxMatrixClientPeg.get().getDeviceId(),
        homeServer: window.mxMatrixClientPeg.get().getHomeserverUrl(),
        password: null,
        displayName: "Alice",
    }));
}
