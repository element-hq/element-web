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

    test("should be rendered properly", async ({ app, page, user }) => {
        page.setViewportSize({ width: 1024, height: 3300 });
        const tab = await app.settings.openUserSettings("Preferences");
        // Assert that the top heading is rendered
        await expect(tab.getByRole("heading", { name: "Preferences" })).toBeVisible();
        await expect(tab).toMatchScreenshot("Preferences-user-settings-tab-should-be-rendered-properly-1.png");
    });

    test("should be able to change the app language", async ({ uut, user }) => {
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
        timezoneInput.getByRole("option", { name: /Africa\/Abidjan/ }).click();
        // Check the new value
        await expect(timezoneValue.getByText("Africa/Abidjan")).toBeVisible();
    });
});
