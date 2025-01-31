/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { masHomeserver } from "../../plugins/homeserver/synapse/masHomeserver";
import { registerAccountMas } from "../oidc";
import { deleteCachedSecrets } from "./utils";

test.use(masHomeserver);
test.describe("Key storage out of sync toast", () => {
    test.skip(isDendrite, "does not yet support MAS");

    let recoveryKey;

    test.beforeEach(async ({ page, app, mailpitClient }) => {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailpitClient, "alice", "alice@email.com", "Pa$sW0rD!");

        await expect(page.getByRole("heading", { level: 1, name: "Welcome alice" })).toBeVisible();

        // We won't be prompted for crypto setup unless we have na e2e room, so make one
        await page.getByRole("button", { name: "Add room" }).click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("Test room");
        await page.getByRole("button", { name: "Create room" }).click();

        // Now set up recovery (otherwise we'll delete the only copy of the secret)
        await page.getByLabel("User menu").click();
        await page.getByLabel("All settings").click();
        await page.getByRole("tab", { name: "Encryption" }).click();
        await page.getByRole("button", { name: "Set up recovery" }).click();
        await page.getByRole("button", { name: "Continue" }).click();
        recoveryKey = await page.getByTestId("recoveryKey").textContent();
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("textbox", { name: "Enter recovery key" }).fill(recoveryKey);
        await page.getByRole("button", { name: "Finish set up" }).click();

        await expect(page.getByRole("button", { name: "Change recovery key" })).toBeVisible();

        await deleteCachedSecrets(page);

        await expect(page.getByRole("button", { name: "Enter recovery key" })).toBeVisible();
    });

    test("should display 'key storage out of sync' is keys not cached", { tag: "@screenshot" }, async ({ page }) => {
        // This toast is wider than normal: take a screenshot to assert that it's presented how it should be
        //await expect(page.getByRole("alert").first()).toMatchScreenshot("key-storage-out-of-sync-toast.png");
    });

    test("should prompt for recovery key if 'enter recovery key' pressed", async ({ page }) => {
        await page.getByRole("button", { name: "Enter recovery key" }).click();

        await page.getByRole("textbox", { name: "Security key" }).fill(recoveryKey);
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByRole("button", { name: "Enter recovery key" })).not.toBeVisible();
    });

    test("should open settings to reset flow if 'forgot recovery key' pressed", async ({ page }) => {
        await page.getByRole("button", { name: "Forgot recovery key?" }).click();

        await expect(
            page.getByRole("heading", { name: "Forgot your recovery key? You’ll need to reset your identity." }),
        ).toBeVisible();
    });
});
