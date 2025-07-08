/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

test.describe("Notifications 2 tab", () => {
    test.use({
        displayName: "Alice",
    });

    test("should display notification settings", {tag: "@screenshot"}, async ({ page, app, user }) => {
        await app.settings.setValue("feature_notification_settings2", null, SettingLevel.DEVICE, true);
        await page.setViewportSize({ width: 1024, height: 2000 });
        const settings = await app.settings.openUserSettings("Notifications");
        await expect(settings).toMatchScreenshot("standard-notifications-2-settings.png", {
            // Mask the mxid.
            mask: [settings.locator("#mx_NotificationSettings2_MentionCheckbox span")]
        });
    });
});
