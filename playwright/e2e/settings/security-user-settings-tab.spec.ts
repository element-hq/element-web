/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

const IntegrationManager = "scalar.vector.im";

test.describe("Security user settings tab", () => {
    test.describe("with posthog enabled", () => {
        test.use({
            displayName: "Hanako",
            // Enable posthog
            config: {
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
                privacy_policy_url: "example.tld", // Set privacy policy URL to enable privacyPolicyLink
            },
        });

        test.beforeEach(async ({ page, app, user }) => {
            // Dismiss "Notification" toast
            await app.closeNotificationToast();
            await page.locator(".mx_Toast_buttons").getByRole("button", { name: "Yes" }).click(); // Allow analytics
        });

        test.describe("AnalyticsLearnMoreDialog", () => {
            test("should be rendered properly", { tag: "@screenshot" }, async ({ app, page, user }) => {
                const tab = await app.settings.openUserSettings("Security");
                await tab.getByRole("button", { name: "Learn more" }).click();
                await expect(page.locator(".mx_AnalyticsLearnMoreDialog_wrapper .mx_Dialog")).toMatchScreenshot(
                    "Security-user-settings-tab-with-posthog-enable-b5d89-csLearnMoreDialog-should-be-rendered-properly-1.png",
                );
            });
        });

        test("should be able to set an ID server", async ({ app, context, user, page }) => {
            const tab = await app.settings.openUserSettings("Security");

            await context.route("https://identity.example.org/_matrix/identity/v2", async (route) => {
                await route.fulfill({
                    status: 200,
                    json: {},
                });
            });
            await context.route("https://identity.example.org/_matrix/identity/v2/account/register", async (route) => {
                await route.fulfill({
                    status: 200,
                    json: {
                        token: "AToken",
                    },
                });
            });
            await context.route("https://identity.example.org/_matrix/identity/v2/account", async (route) => {
                await route.fulfill({
                    status: 200,
                    json: {
                        user_id: user.userId,
                    },
                });
            });
            await context.route("https://identity.example.org/_matrix/identity/v2/terms", async (route) => {
                await route.fulfill({
                    status: 200,
                    json: {
                        policies: {},
                    },
                });
            });
            const setIdServer = tab.locator(".mx_IdentityServerPicker");
            await setIdServer.scrollIntoViewIfNeeded();

            const textElement = setIdServer.getByRole("textbox", { name: "Enter a new identity server" });
            await textElement.click();
            await textElement.fill("https://identity.example.org");
            await setIdServer.getByRole("button", { name: "Change" }).click();

            await expect(setIdServer.getByText("Checking server")).toBeVisible();
            // Accept terms
            await page.getByTestId("dialog-primary-button").click();
            // Check identity has changed.
            await expect(setIdServer.getByText("Your identity server has been changed")).toBeVisible();
            // Ensure section title is updated.
            await expect(tab.getByText(`Identity server (identity.example.org)`, { exact: true })).toBeVisible();
        });

        test("should show integrations as enabled", async ({ app, page, user }) => {
            const tab = await app.settings.openUserSettings("Security");

            const setIntegrationManager = tab.locator(".mx_SetIntegrationManager");
            await setIntegrationManager.scrollIntoViewIfNeeded();
            await expect(
                setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager", {
                    hasText: IntegrationManager,
                }),
            ).toBeVisible();
            // Make sure integration manager's toggle switch is enabled
            const toggleswitch = setIntegrationManager.getByLabel("Enable the integration manager");
            await expect(toggleswitch).toBeVisible();
            await expect(toggleswitch).toBeChecked();
            await expect(setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager")).toHaveText(
                "Manage integrations(scalar.vector.im)",
            );
        });
    });
});
