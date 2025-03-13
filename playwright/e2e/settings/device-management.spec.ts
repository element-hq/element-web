/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { uiaLongSessionTimeoutHomeserver } from "../../plugins/homeserver/synapse/uiaLongSessionTimeoutHomeserver.ts";

// This is needed to not get stopped by UIA when deleting other devices
test.use(uiaLongSessionTimeoutHomeserver);
test.describe("Device manager", () => {
    test.use({
        displayName: "Alice",
    });

    test.beforeEach(async ({ homeserver, user }) => {
        // create 3 extra sessions to manage
        for (let i = 0; i < 3; i++) {
            await homeserver.loginUser(user.userId, user.password);
        }
    });

    test("should display sessions", async ({ page, app }) => {
        await app.settings.openUserSettings("Sessions");
        const tab = page.locator(".mx_SettingsTab");

        await expect(tab.getByText("Current session", { exact: true })).toBeVisible();

        const currentSessionSection = tab.getByTestId("current-session-section");
        await expect(currentSessionSection.getByText("Unverified session")).toBeVisible();

        // current session details opened
        await currentSessionSection.getByRole("button", { name: "Show details" }).click();
        await expect(currentSessionSection.getByText("Session details")).toBeVisible();

        // close current session details
        await currentSessionSection.getByRole("button", { name: "Hide details" }).click();
        await expect(currentSessionSection.getByText("Session details")).not.toBeVisible();

        const securityRecommendationsSection = tab.getByTestId("security-recommendations-section");
        await expect(securityRecommendationsSection.getByText("Security recommendations")).toBeVisible();
        await securityRecommendationsSection.getByRole("button", { name: "View all (3)" }).click();

        /**
         * Other sessions section
         */
        await expect(tab.getByText("Other sessions")).toBeVisible();
        // filter applied after clicking through from security recommendations
        await expect(tab.getByLabel("Filter devices")).toHaveText("Show: Unverified");
        const filteredDeviceListItems = tab.locator(".mx_FilteredDeviceList_listItem");
        await expect(filteredDeviceListItems).toHaveCount(3);

        // select two sessions
        // force click as the input element itself is not visible (its size is zero)
        await filteredDeviceListItems.first().click({ force: true });
        await filteredDeviceListItems.last().click({ force: true });

        // sign out from list selection action buttons
        await tab.getByRole("button", { name: "Sign out", exact: true }).click();
        await page.getByRole("dialog").getByTestId("dialog-primary-button").click();

        // list updated after sign out
        await expect(filteredDeviceListItems).toHaveCount(1);
        // security recommendation count updated
        await expect(tab.getByRole("button", { name: "View all (1)" })).toBeVisible();

        const sessionName = `Alice's device`;
        // open the first session
        const firstSession = filteredDeviceListItems.first();
        await firstSession.getByRole("button", { name: "Show details" }).click();

        await expect(firstSession.getByText("Session details")).toBeVisible();

        await firstSession.getByRole("button", { name: "Rename" }).click();
        await firstSession.getByTestId("device-rename-input").type(sessionName);
        await firstSession.getByRole("button", { name: "Save" }).click();
        // there should be a spinner while device updates
        await expect(firstSession.locator(".mx_Spinner")).toBeVisible();
        // wait for spinner to complete
        await expect(firstSession.locator(".mx_Spinner")).not.toBeVisible();

        // session name updated in details
        await expect(firstSession.locator(".mx_DeviceDetailHeading h4").getByText(sessionName)).toBeVisible();
        // and main list item
        await expect(firstSession.locator(".mx_DeviceTile h4").getByText(sessionName)).toBeVisible();

        // sign out using the device details sign out
        await firstSession.getByRole("button", { name: "Sign out of this session" }).click();

        // confirm the signout
        await page.getByRole("dialog").getByTestId("dialog-primary-button").click();

        // no other sessions or security recommendations sections when only one session
        await expect(tab.getByText("Other sessions")).not.toBeVisible();
        await expect(tab.getByTestId("security-recommendations-section")).not.toBeVisible();
    });
});
