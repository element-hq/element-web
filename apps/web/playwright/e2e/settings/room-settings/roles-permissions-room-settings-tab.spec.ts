/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Roles & Permissions room settings tab", () => {
    const roomName = "Test room";

    test.use({
        displayName: "Alice",
    });

    let settings: Locator;

    test.beforeEach(async ({ user, app }) => {
        await app.client.createRoom({ name: roomName });
        await app.viewRoomByName(roomName);
        settings = await app.settings.openRoomSettings("Roles & Permissions");
    });

    test("should be able to change the role of a user", async ({ page, app, user, axe }) => {
        const privilegedUserSection = settings.locator(".mx_SettingsFieldset").first();
        const applyButton = privilegedUserSection.getByRole("button", { name: "Apply" });

        // Alice is admin (100) and the Apply button should be disabled
        await expect(applyButton).toBeDisabled();
        let combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("100");

        // Change the role of Alice to Moderator (50)
        await combobox.selectOption("Moderator");

        // Should display a modal to warn that we are demoting the only admin user
        const modal = page.locator(".mx_Dialog", {
            hasText: "Warning",
        });
        await expect(modal).toBeVisible();
        // Click on the continue button in the modal
        await modal.getByRole("button", { name: "Continue" }).click();

        const respPromise = page.waitForRequest("**/state/**");
        await applyButton.click();
        await respPromise;
        await expect(combobox).toHaveValue("50");

        // Reload and check Alice is still Moderator (50)
        await page.reload();
        settings = await app.settings.openRoomSettings("Roles & Permissions");
        combobox = privilegedUserSection.getByRole("combobox", { name: user.userId });
        await expect(combobox).toHaveValue("50");

        await expect(axe).toHaveNoViolations();
    });

    test("should not show policy server settings by default", async () => {
        await expect(settings.getByRole("group", { name: "Policy server" })).not.toBeVisible();
    });

    test.describe("with policy server setup enabled", () => {
        test.use({
            labsFlags: ["feature_policy_server_setup"],
        });

        const policyServerName = "policy.example.org";
        const publicKeys = { ed25519: "not_a_real_key" };

        test.beforeEach(async ({ page }) => {
            // Serve the well-known documents the client looks up on the entered server name
            await page.route(`https://${policyServerName}/.well-known/matrix/policy_server`, async (route) => {
                await route.fulfill({ json: { public_keys: publicKeys } });
            });
            await page.route(`https://${policyServerName}/.well-known/matrix/support`, async (route) => {
                await route.fulfill({ status: 404, json: {} });
            });
        });

        test("should be able to set and clear the room's policy server", async ({ page }) => {
            const section = settings.getByRole("group", { name: "Policy server" });
            const serverNameInput = section.getByRole("textbox", { name: "Policy server name" });
            const applyButton = section.getByRole("button", { name: "Apply" });

            await expect(serverNameInput).toHaveValue("");
            await expect(applyButton).toBeDisabled();

            // Set the policy server: the client resolves the public keys and sends m.room.policy
            await serverNameInput.fill(policyServerName);
            const setRequest = page.waitForRequest(
                (request) => request.method() === "PUT" && /\/state\/m\.room\.policy\/?$/.test(request.url()),
            );
            await applyButton.click();
            expect((await setRequest).postDataJSON()).toEqual({ via: policyServerName, public_keys: publicKeys });

            await expect(serverNameInput).toHaveValue(policyServerName);
            await expect(applyButton).toBeDisabled();
            await expect(section.getByText("This policy server may need additional setup")).toBeVisible();

            // Clear it again by applying an empty value
            await serverNameInput.clear();
            const clearRequest = page.waitForRequest(
                (request) => request.method() === "PUT" && /\/state\/m\.room\.policy\/?$/.test(request.url()),
            );
            await applyButton.click();
            expect((await clearRequest).postDataJSON()).toEqual({});

            await expect(applyButton).toBeDisabled();
            await expect(section.getByText("This policy server may need additional setup")).not.toBeVisible();
        });

        test("should report a server name that is not a policy server", async ({ page }) => {
            await page.route("https://nothing.example.org/.well-known/matrix/policy_server", async (route) => {
                await route.fulfill({ status: 404 });
            });

            const section = settings.getByRole("group", { name: "Policy server" });
            await section.getByRole("textbox", { name: "Policy server name" }).fill("nothing.example.org");
            await section.getByRole("button", { name: "Apply" }).click();

            await expect(section.getByText("Could not find a policy server at this server name")).toBeVisible();
        });
    });
});
