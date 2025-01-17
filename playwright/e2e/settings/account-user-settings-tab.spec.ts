/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

const USER_NAME = "Bob";
const USER_NAME_NEW = "Alice";

test.describe("Account user settings tab", () => {
    test.use({
        displayName: USER_NAME,
        config: {
            default_country_code: "US", // For checking the international country calling code
        },
        uut: async ({ app, user }, use) => {
            const locator = await app.settings.openUserSettings("Account");
            await use(locator);
        },
    });

    test("should be rendered properly", { tag: "@screenshot" }, async ({ uut, user }) => {
        await expect(uut).toMatchScreenshot("account.png");

        // Assert that the top heading is rendered
        await expect(uut.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

        const profile = uut.locator(".mx_UserProfileSettings_profile");
        await profile.scrollIntoViewIfNeeded();
        await expect(profile.getByRole("textbox", { name: "Display Name" })).toHaveValue(USER_NAME);

        // Assert that a userId is rendered
        await expect(uut.getByLabel("Username")).toHaveText(user.userId);

        // Wait until spinners disappear
        await expect(uut.getByTestId("accountSection").locator(".mx_Spinner")).not.toBeVisible();
        await expect(uut.getByTestId("discoverySection").locator(".mx_Spinner")).not.toBeVisible();

        const accountSection = uut.getByTestId("accountSection");
        await accountSection.scrollIntoViewIfNeeded();
        // Assert that input areas for changing a password exists
        await expect(accountSection.getByLabel("Current password")).toBeVisible();
        await expect(accountSection.getByLabel("New Password")).toBeVisible();
        await expect(accountSection.getByLabel("Confirm password")).toBeVisible();

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

        // Assert the account deactivation button is displayed
        const accountManagementSection = uut.getByTestId("account-management-section");
        await accountManagementSection.scrollIntoViewIfNeeded();
        await expect(accountManagementSection.getByRole("button", { name: "Deactivate Account" })).toHaveClass(
            /mx_AccessibleButton_kind_danger/,
        );
    });

    test("should respond to small screen sizes", { tag: "@screenshot" }, async ({ page, uut }) => {
        await page.setViewportSize({ width: 700, height: 600 });
        await expect(uut).toMatchScreenshot("account-smallscreen.png");
    });

    test("should show tooltips on narrow screen", async ({ page, uut }) => {
        await page.setViewportSize({ width: 700, height: 600 });
        await page.getByRole("tab", { name: "Account" }).hover();
        await expect(page.getByRole("tooltip")).toHaveText("Account");
    });

    test("should support adding and removing a profile picture", async ({ uut, page }) => {
        const profileSettings = uut.locator(".mx_UserProfileSettings");
        // Upload a picture
        await profileSettings.getByAltText("Upload").setInputFiles("playwright/sample-files/riot.png");

        // Image should be visible
        await expect(profileSettings.locator(".mx_AvatarSetting_avatar img")).toBeVisible();

        // Open the menu & click remove
        await profileSettings.getByRole("button", { name: "Profile Picture" }).click();
        await page.getByRole("menuitem", { name: "Remove" }).click();

        // Assert that the image disappeared
        await expect(profileSettings.locator(".mx_AvatarSetting_avatar img")).not.toBeVisible();
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
            .locator(".mx_SettingsTab .mx_UserProfileSettings")
            .getByRole("textbox", { name: "Display Name" });
        await displayNameInput.fill(USER_NAME_NEW);
        await displayNameInput.press("Enter");

        await app.closeDialog();

        // Assert the avatar's initial characters are set
        await expect(page.locator(".mx_UserMenu .mx_BaseAvatar").getByText("A")).toBeVisible(); // Alice
        await expect(page.locator(".mx_RoomView_wrapper .mx_BaseAvatar").getByText("A")).toBeVisible(); // Alice
    });

    // ported to a playwright test because the jest test was very flakey for no obvious reason
    test("should display an error if the code is incorrect when adding a phone number", async ({ uut, page }) => {
        const dummyUrl = "https://nowhere.dummy/_matrix/client/unstable/add_threepid/msisdn/submit_token";

        await page.route(
            `**/_matrix/client/v3/account/3pid/msisdn/requestToken`,
            async (route) => {
                await route.fulfill({
                    json: {
                        success: true,
                        sid: "1",
                        msisdn: "447700900000",
                        intl_fmt: "+44 7700 900000",
                        submit_url: dummyUrl,
                    },
                });
            },
            { times: 1 },
        );

        await page.route(
            dummyUrl,
            async (route) => {
                await route.fulfill({
                    status: 400,
                    json: {
                        errcode: "M_THREEPID_AUTH_FAILED",
                        error: "That code is definitely wrong",
                    },
                });
            },
            { times: 1 },
        );

        const phoneSection = page.getByTestId("mx_AccountPhoneNumbers");
        await phoneSection.getByRole("textbox", { name: "Phone Number" }).fill("07700900000");
        await phoneSection.getByRole("button", { name: "Add" }).click();

        await phoneSection
            .getByRole("textbox", { name: "Verification code" })
            .fill("A small eurasian field mouse dancing the paso doble");

        await phoneSection.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByRole("heading", { name: "Unable to verify phone number." })).toBeVisible();
    });
});
