/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

        test(
            "should change the message layout from modern to bubble",
            { tag: "@screenshot" },
            async ({ page, app, user, util }) => {
                await util.assertScreenshot(util.getMessageLayoutPanel(), "message-layout-panel-modern.png");

                await util.getBubbleLayout().click();

                // Assert that modern are irc layout are not selected
                await expect(util.getBubbleLayout()).toBeChecked();
                await expect(util.getModernLayout()).not.toBeChecked();
                await expect(util.getIRCLayout()).not.toBeChecked();

                // Assert that the room layout is set to bubble layout
                await util.assertBubbleLayout();
                await util.assertScreenshot(util.getMessageLayoutPanel(), "message-layout-panel-bubble.png");
            },
        );

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
