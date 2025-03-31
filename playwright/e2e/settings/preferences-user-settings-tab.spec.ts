/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.use({
    locale: "en-GB",
    timezoneId: "Europe/London",
});

test.describe("Preferences user settings tab", () => {
    test.use({
        displayName: "Bob",
        uut: async ({ app, user }, use) => {
            const locator = await app.settings.openUserSettings("Preferences");
            await use(locator);
        },
    });

    test("should be rendered properly", { tag: "@screenshot" }, async ({ app, page, user }) => {
        await page.setViewportSize({ width: 1024, height: 3300 });
        const tab = await app.settings.openUserSettings("Preferences");
        // Assert that the top heading is rendered
        await expect(tab.getByRole("heading", { name: "Preferences" })).toBeVisible();
        await expect(tab).toMatchScreenshot("Preferences-user-settings-tab-should-be-rendered-properly-1.png", {
            // masked due to daylight saving time
            mask: [tab.locator("#mx_dropdownUserTimezone_value")],
        });
    });

    test("should be able to change the app language", { tag: ["@no-firefox", "@no-webkit"] }, async ({ uut, user }) => {
        // Check language and region setting dropdown
        const languageInput = uut.getByRole("button", { name: "Language Dropdown" });
        await languageInput.scrollIntoViewIfNeeded();
        // Check the default value
        await expect(languageInput.getByText("English")).toBeVisible();
        // Click the button to display the dropdown menu
        await languageInput.click();
        // Assert that the default option is rendered and highlighted
        languageInput.getByRole("option", { name: /Albanian/ });
        await expect(languageInput.getByRole("option", { name: /Albanian/ })).toHaveClass(
            /mx_Dropdown_option_highlight/,
        );
        await expect(languageInput.getByRole("option", { name: /Deutsch/ })).toBeVisible();
        // Click again to close the dropdown
        await languageInput.click();
        // Assert that the default value is rendered again
        await expect(languageInput.getByText("English")).toBeVisible();
    });

    test("should be able to change the timezone", async ({ uut, user }) => {
        // Check language and region setting dropdown
        const timezoneInput = uut.locator(".mx_dropdownUserTimezone");
        const timezoneValue = uut.locator("#mx_dropdownUserTimezone_value");
        await timezoneInput.scrollIntoViewIfNeeded();
        // Check the default value
        await expect(timezoneValue.getByText("Browser default")).toBeVisible();
        // Click the button to display the dropdown menu
        await timezoneInput.getByRole("button", { name: "Set timezone" }).click();
        // Select a different value
        await timezoneInput.getByRole("option", { name: /Africa\/Abidjan/ }).click();
        // Check the new value
        await expect(timezoneValue.getByText("Africa/Abidjan")).toBeVisible();
    });
});
