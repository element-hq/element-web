/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { registerAccountMas } from "../oidc";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { TestClientServerAPI } from "../csAPI";
import { masHomeserver } from "../../plugins/homeserver/synapse/masHomeserver.ts";

// These tests register an account with MAS because then we go through the "normal" registration flow
// and crypto gets set up. Using the 'user' fixture create a user and synthesizes an existing login,
// which is faster but leaves us without crypto set up.
test.use(masHomeserver);
test.describe("Encryption state after registration", () => {
    test.skip(isDendrite, "does not yet support MAS");

    test("Key backup is enabled by default", async ({ page, mailpitClient, app }, testInfo) => {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailpitClient, `alice_${testInfo.testId}`, "alice@email.com", "Pa$sW0rD!");

        await app.settings.openUserSettings("Security & Privacy");
        await expect(page.getByText("This session is backing up your keys.")).toBeVisible();
    });

    test("user is prompted to set up recovery", async ({ page, mailpitClient, app }, testInfo) => {
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailpitClient, `alice_${testInfo.testId}`, "alice@email.com", "Pa$sW0rD!");

        await page.getByRole("button", { name: "Add room" }).click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("test room");
        await page.getByRole("button", { name: "Create room" }).click();

        await expect(page.getByRole("heading", { name: "Set up recovery" })).toBeVisible();
    });
});

test.describe("Key backup reset from elsewhere", () => {
    test.skip(isDendrite, "does not yet support MAS");

    test("Key backup is disabled when reset from elsewhere", async ({
        page,
        mailpitClient,
        request,
        homeserver,
    }, testInfo) => {
        const testUsername = `alice_${testInfo.testId}`;
        const testPassword = "Pa$sW0rD!";

        // there's a delay before keys are uploaded so the error doesn't appear immediately: use a fake
        // clock so we can skip the delay
        await page.clock.install();

        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await registerAccountMas(page, mailpitClient, testUsername, "alice@email.com", testPassword);

        await page.getByRole("button", { name: "Add room" }).click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("test room");
        await page.getByRole("button", { name: "Create room" }).click();

        const accessToken = await page.evaluate(() => window.mxMatrixClientPeg.get().getAccessToken());

        const csAPI = new TestClientServerAPI(request, homeserver, accessToken);

        const backupInfo = await csAPI.getCurrentBackupInfo();

        await csAPI.deleteBackupVersion(backupInfo.version);

        await page.getByRole("textbox", { name: "Send an encrypted message…" }).fill("/discardsession");
        await page.getByRole("button", { name: "Send message" }).click();

        await page.getByRole("textbox", { name: "Send an encrypted message…" }).fill("Message with broken key backup");
        await page.getByRole("button", { name: "Send message" }).click();

        // Should be the message we sent plus the room creation event
        await expect(page.locator(".mx_EventTile")).toHaveCount(2);
        await expect(
            page.locator(".mx_RoomView_MessageList > .mx_EventTile_last .mx_EventTile_receiptSent"),
        ).toBeVisible();

        // Wait for it to try uploading the key
        await page.clock.fastForward(20000);

        await expect(page.getByRole("heading", { level: 1, name: "New Recovery Method" })).toBeVisible();
    });
});
