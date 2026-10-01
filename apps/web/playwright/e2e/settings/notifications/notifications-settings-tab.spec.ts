/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../../element-web-test";

test.describe("Notifications tab", () => {
    test.use({
        displayName: "Alice",
    });

    test("should display notification settings", { tag: "@screenshot" }, async ({ page, app, user, axe }) => {
        await page.setViewportSize({ width: 1024, height: 1400 });
        const settings = await app.settings.openUserSettings("Notifications");
        await settings.getByLabel("Enable notifications for this account").check();
        await settings.getByLabel("Enable notifications for this device").check();

        axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
        await expect(axe).toHaveNoViolations();
        await expect(settings).toMatchScreenshot("standard-notification-settings.png");
    });
});
