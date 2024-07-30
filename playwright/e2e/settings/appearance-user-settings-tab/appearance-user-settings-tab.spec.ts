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

import { expect, test } from ".";

test.describe("Appearance user settings tab", () => {
    test.use({
        displayName: "Hanako",
    });

    test("should be rendered properly", async ({ page, user, app }) => {
        const tab = await app.settings.openUserSettings("Appearance");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        // Assert that "Hide advanced" link button is rendered
        await expect(tab.getByRole("button", { name: "Hide advanced" })).toBeVisible();

        await expect(tab).toMatchScreenshot("appearance-tab.png");
    });

    test("should support changing font size by using the font size dropdown", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");

        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");
        const fontDropdown = tab.locator(".mx_FontScalingPanel_Dropdown");
        await expect(fontDropdown.getByLabel("Font size")).toBeVisible();

        // Default browser font size is 16px and the select value is 0
        // -4 value is 12px
        await fontDropdown.getByLabel("Font size").selectOption({ value: "-4" });

        await expect(page).toMatchScreenshot("window-12px.png", { includeDialogBackground: true });
    });

    test("should support enabling system font", async ({ page, app, user }) => {
        await app.settings.openUserSettings("Appearance");
        const tab = page.getByTestId("mx_AppearanceUserSettingsTab");

        // Click "Show advanced" link button
        await tab.getByRole("button", { name: "Show advanced" }).click();

        await tab.locator(".mx_Checkbox", { hasText: "Use bundled emoji font" }).click();
        await tab.locator(".mx_Checkbox", { hasText: "Use a system font" }).click();

        // Assert that the font-family value was removed
        await expect(page.locator("body")).toHaveCSS("font-family", '""');
    });
});
