/*
Copyright 2023 Suguru Hirahara

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

const USER_NAME = "Bob";
const USER_NAME_NEW = "Alice";
const IntegrationManager = "scalar.vector.im";

test.describe("General user settings tab", () => {
    let userId: string;

    test.use({
        displayName: USER_NAME,
        config: {
            default_country_code: "US", // For checking the international country calling code
        },
        uut: async ({ app, user }, use) => {
            const locator = await app.settings.openUserSettings("General");
            await use(locator);
        },
    });

    test("should be rendered properly", async ({ uut }) => {
        await expect(uut).toHaveScreenshot("general.png", {
            // Exclude userId from snapshots
            mask: [uut.locator(".mx_ProfileSettings_profile_controls > p")],
        });

        // Assert that the top heading is rendered
        await expect(uut.getByRole("heading", { name: "General" })).toBeVisible();

        const profile = uut.locator(".mx_ProfileSettings_profile");
        await profile.scrollIntoViewIfNeeded();
        await expect(profile.getByRole("textbox", { name: "Display Name" })).toHaveValue(USER_NAME);

        // Assert that a userId is rendered
        await expect(profile.locator(".mx_ProfileSettings_profile_controls_userId", { hasText: userId })).toBeVisible();

        // Check avatar setting
        const avatar = profile.locator(".mx_AvatarSetting_avatar");
        await avatar.hover();

        // Hover effect
        await expect(avatar.locator(".mx_AvatarSetting_hoverBg")).toBeVisible();
        await expect(avatar.locator(".mx_AvatarSetting_hover span").getByText("Upload")).toBeVisible();

        // Wait until spinners disappear
        await expect(uut.getByTestId("accountSection").locator(".mx_Spinner")).not.toBeVisible();
        await expect(uut.getByTestId("discoverySection").locator(".mx_Spinner")).not.toBeVisible();

        const accountSection = uut.getByTestId("accountSection");
        // Assert that input areas for changing a password exists
        const changePassword = accountSection.locator("form.mx_GeneralUserSettingsTab_section--account_changePassword");
        await changePassword.scrollIntoViewIfNeeded();
        await expect(changePassword.getByLabel("Current password")).toBeVisible();
        await expect(changePassword.getByLabel("New Password")).toBeVisible();
        await expect(changePassword.getByLabel("Confirm password")).toBeVisible();

        // Check email addresses area
        const emailAddresses = uut.getByTestId("mx_AccountEmailAddresses");
        await emailAddresses.scrollIntoViewIfNeeded();
        // Assert that an input area for a new email address is rendered
        await expect(emailAddresses.getByRole("textbox", { name: "Email Address" })).toBeVisible();
        // Assert the add button is visible
        await expect(emailAddresses.getByRole("button", { name: "Add" })).toBeVisible();

        // Check phone numbers area
        const phoneNumbers = uut.getByTestId("mx_AccountPhoneNumbers");
        await phoneNumbers.scrollIntoViewIfNeeded();
        // Assert that an input area for a new phone number is rendered
        await expect(phoneNumbers.getByRole("textbox", { name: "Phone Number" })).toBeVisible();
        // Assert that the add button is rendered
        await expect(phoneNumbers.getByRole("button", { name: "Add" })).toBeVisible();

        // Check language and region setting dropdown
        const languageInput = uut.locator(".mx_GeneralUserSettingsTab_section_languageInput");
        await languageInput.scrollIntoViewIfNeeded();
        // Check the default value
        await expect(languageInput.getByText("English")).toBeVisible();
        // Click the button to display the dropdown menu
        await languageInput.getByRole("button", { name: "Language Dropdown" }).click();
        // Assert that the default option is rendered and highlighted
        languageInput.getByRole("option", { name: /Albanian/ });
        await expect(languageInput.getByRole("option", { name: /Albanian/ })).toHaveClass(
            /mx_Dropdown_option_highlight/,
        );
        await expect(languageInput.getByRole("option", { name: /Deutsch/ })).toBeVisible();
        // Click again to close the dropdown
        await languageInput.getByRole("button", { name: "Language Dropdown" }).click();
        // Assert that the default value is rendered again
        await expect(languageInput.getByText("English")).toBeVisible();

        const setIdServer = uut.locator(".mx_SetIdServer");
        await setIdServer.scrollIntoViewIfNeeded();
        // Assert that an input area for identity server exists
        await expect(setIdServer.getByRole("textbox", { name: "Enter a new identity server" })).toBeVisible();

        const setIntegrationManager = uut.locator(".mx_SetIntegrationManager");
        await setIntegrationManager.scrollIntoViewIfNeeded();
        await expect(
            setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager", { hasText: IntegrationManager }),
        ).toBeVisible();
        // Make sure integration manager's toggle switch is enabled
        await expect(setIntegrationManager.locator(".mx_ToggleSwitch_enabled")).toBeVisible();
        await expect(setIntegrationManager.locator(".mx_SetIntegrationManager_heading_manager")).toHaveText(
            "Manage integrations(scalar.vector.im)",
        );

        // Assert the account deactivation button is displayed
        const accountManagementSection = uut.getByTestId("account-management-section");
        await accountManagementSection.scrollIntoViewIfNeeded();
        await expect(accountManagementSection.getByRole("button", { name: "Deactivate Account" })).toHaveClass(
            /mx_AccessibleButton_kind_danger/,
        );
    });

    test("should support adding and removing a profile picture", async ({ uut }) => {
        const profileSettings = uut.locator(".mx_ProfileSettings");
        // Upload a picture
        await profileSettings
            .locator(".mx_ProfileSettings_avatarUpload")
            .setInputFiles("playwright/sample-files/riot.png");

        // Find and click "Remove" link button
        await profileSettings.locator(".mx_ProfileSettings_profile").getByRole("button", { name: "Remove" }).click();

        // Assert that the link button disappeared
        await expect(
            profileSettings.locator(".mx_AvatarSetting_avatar .mx_AccessibleButton_kind_link_sm"),
        ).not.toBeVisible();
    });

    test("should set a country calling code based on default_country_code", async ({ uut }) => {
        // Check phone numbers area
        const accountPhoneNumbers = uut.getByTestId("mx_AccountPhoneNumbers");
        await accountPhoneNumbers.scrollIntoViewIfNeeded();
        // Assert that an input area for a new phone number is rendered
        await expect(accountPhoneNumbers.getByRole("textbox", { name: "Phone Number" })).toBeVisible();

        // Check a new phone number dropdown menu
        const dropdown = accountPhoneNumbers.locator(".mx_PhoneNumbers_country");
        await dropdown.scrollIntoViewIfNeeded();
        // Assert that the country calling code of the United States is visible
        await expect(dropdown.getByText(/\+1/)).toBeVisible();

        // Click the button to display the dropdown menu
        await dropdown.getByRole("button", { name: "Country Dropdown" }).click();

        // Assert that the option for calling code of the United Kingdom is visible
        await expect(dropdown.getByRole("option", { name: /United Kingdom/ })).toBeVisible();

        // Click again to close the dropdown
        await dropdown.getByRole("button", { name: "Country Dropdown" }).click();

        // Assert that the default value is rendered again
        await expect(dropdown.getByText(/\+1/)).toBeVisible();

        await expect(accountPhoneNumbers.getByRole("button", { name: "Add" })).toBeVisible();
    });

    test("should support changing a display name", async ({ uut, page, app }) => {
        // Change the diaplay name to USER_NAME_NEW
        const displayNameInput = uut
            .locator(".mx_SettingsTab .mx_ProfileSettings")
            .getByRole("textbox", { name: "Display Name" });
        await displayNameInput.fill(USER_NAME_NEW);
        await displayNameInput.press("Enter");

        await app.closeDialog();

        // Assert the avatar's initial characters are set
        await expect(page.locator(".mx_UserMenu .mx_BaseAvatar").getByText("A")).toBeVisible(); // Alice
        await expect(page.locator(".mx_RoomView_wrapper .mx_BaseAvatar").getByText("A")).toBeVisible(); // Alice
    });
});
