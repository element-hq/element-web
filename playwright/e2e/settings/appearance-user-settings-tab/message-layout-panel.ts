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

    test.describe("Message Layout Panel", () => {
        test.beforeEach(async ({ app, user, util }) => {
            await util.createAndDisplayRoom();
            await util.assertModernLayout();
            await util.openAppearanceTab();
        });

        test("should change the message layout from modern to bubble", async ({ page, app, user, util }) => {
            await util.assertScreenshot(util.getMessageLayoutPanel(), "message-layout-panel-modern.png");

            await util.getBubbleLayout().click();

            // Assert that modern are irc layout are not selected
            await expect(util.getBubbleLayout()).toBeChecked();
            await expect(util.getModernLayout()).not.toBeChecked();
            await expect(util.getIRCLayout()).not.toBeChecked();

            // Assert that the room layout is set to bubble layout
            await util.assertBubbleLayout();
            await util.assertScreenshot(util.getMessageLayoutPanel(), "message-layout-panel-bubble.png");
        });

        test("should enable compact layout when the modern layout is selected", async ({ page, app, user, util }) => {
            await expect(util.getCompactLayoutCheckbox()).not.toBeChecked();

            await util.getCompactLayoutCheckbox().click();
            await util.assertCompactLayout();
        });

        test("should disable compact layout when the modern layout is not selected", async ({
            page,
            app,
            user,
            util,
        }) => {
            await expect(util.getCompactLayoutCheckbox()).not.toBeDisabled();

            // Select the bubble layout, which should disable the compact layout checkbox
            await util.getBubbleLayout().click();
            await expect(util.getCompactLayoutCheckbox()).toBeDisabled();
        });
    });
});
