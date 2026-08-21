/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from ".";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { Layout } from "../../../../src/settings/enums/Layout";

test.describe("Appearance user settings tab", () => {
    test.use({
        displayName: "Hanako",
    });

    /**
     * The bubble layout must use the same width as the modern layout.
     *
     * This needs a viewport wide enough that `.mx_RoomView_body` itself exceeds 1200px, which is roughly 1650px once
     * the room list is accounted for. At the default 1280px viewport the body is far narrower than that, so a
     * regression here is invisible and this test would pass against it.
     */
    test.describe("Wide window", () => {
        test.use({ viewport: { width: 1800, height: 900 } });

        test("should use the same width for the bubble layout as for the modern layout", async ({
            page,
            app,
            user,
            util,
        }) => {
            await util.createAndDisplayRoom();
            const timeline = page.locator(".mx_RoomView_timeline");
            const composer = page.locator(".mx_MessageComposer");

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await util.assertModernLayout();
            const modernTimeline = await timeline.boundingBox();
            const modernComposer = await composer.boundingBox();

            // Guard the premise: the room body must be wide enough for a width cap to be observable at all.
            const body = await page.locator(".mx_RoomView_body").boundingBox();
            expect(body!.width).toBeGreaterThan(1200);

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await util.assertBubbleLayout();
            expect(await timeline.boundingBox()).toEqual(modernTimeline);
            expect(await composer.boundingBox()).toEqual(modernComposer);
        });
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
            await expect(util.getCompactLayoutSwitch()).not.toBeChecked();

            await util.getCompactLayoutSwitch().click();
            await util.assertCompactLayout();
        });

        test("should disable compact layout when the modern layout is not selected", async ({
            page,
            app,
            user,
            util,
        }) => {
            await expect(util.getCompactLayoutSwitch()).not.toBeDisabled();

            // Select the bubble layout, which should disable the compact layout checkbox
            await util.getBubbleLayout().click();
            await expect(util.getCompactLayoutSwitch()).toBeDisabled();
        });
    });
});
