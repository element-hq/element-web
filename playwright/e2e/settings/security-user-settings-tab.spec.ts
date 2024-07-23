/*
Copyright 2023 Suguru Hirahara
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

        test.beforeEach(async ({ page, user }) => {
            // Dismiss "Notification" toast
            await page
                .locator(".mx_Toast_toast", { hasText: "Notifications" })
                .getByRole("button", { name: "Dismiss" })
                .click();

            await page.locator(".mx_Toast_buttons").getByRole("button", { name: "Yes" }).click(); // Allow analytics
        });

        test.describe("AnalyticsLearnMoreDialog", () => {
            test("should be rendered properly", async ({ app, page }) => {
                const tab = await app.settings.openUserSettings("Security");
                await tab.getByRole("button", { name: "Learn more" }).click();
                await expect(page.locator(".mx_AnalyticsLearnMoreDialog_wrapper .mx_Dialog")).toMatchScreenshot(
                    "Security-user-settings-tab-with-posthog-enable-b5d89-csLearnMoreDialog-should-be-rendered-properly-1.png",
                );
            });
        });

        test("should contain section to set ID server", async ({ app }) => {
            const tab = await app.settings.openUserSettings("Security");

            const setIdServer = tab.locator(".mx_SetIdServer");
            await setIdServer.scrollIntoViewIfNeeded();
            // Assert that an input area for identity server exists
            await expect(setIdServer.getByRole("textbox", { name: "Enter a new identity server" })).toBeVisible();
        });

        test("should enable show integrations as enabled", async ({ app, page }) => {
            const tab = await app.settings.openUserSettings("Security");

            const setIntegrationManager = tab.locator(".mx_SetIntegrationManager");
            await setIntegrationManager.scrollIntoViewIfNeeded();
            await expect(
                setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager", {
                    hasText: IntegrationManager,
                }),
            ).toBeVisible();
            // Make sure integration manager's toggle switch is enabled
            await expect(setIntegrationManager.locator(".mx_ToggleSwitch_enabled")).toBeVisible();
            await expect(setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager")).toHaveText(
                "Manage integrations(scalar.vector.im)",
            );
        });
    });
});
