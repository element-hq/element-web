/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator } from "@playwright/test";

import { test, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

test.describe("Voice & Video room settings tab", () => {
    const roomName = "Test room";

    test.use({
        displayName: "Alice",
    });

    let settings: Locator;

    test.beforeEach(async ({ user, app, page }) => {
        // Execute client actions before setting, as the setting will force a reload.
        await app.client.createRoom({ name: roomName });
        await app.settings.setValue("feature_group_calls", null, SettingLevel.DEVICE, true);
        await app.viewRoomByName(roomName);
        settings = await app.settings.openRoomSettings("Voice & Video");
    });

    test(
        "should be able to toggle on Element Call in the room",
        { tag: "@screenshot" },
        async ({ page, app, user, axe }) => {
            await page.setViewportSize({ width: 1024, height: 1400 });
            const callToggle = settings.getByLabel("Enable Element Call as an additional calling option in this room");
            await callToggle.check();
            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            await expect(settings).toMatchScreenshot("room-video-settings.png");
        },
    );
});
