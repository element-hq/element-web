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

    test("should vertically center the remove button of a keyword", async ({ app, user }) => {
        const settings = await app.settings.openUserSettings("Notifications");
        await settings.getByRole("textbox", { name: "Keyword", exact: true }).fill("crocodile");
        await settings.getByRole("button", { name: "Add", exact: true }).click();

        const keyword = settings.getByRole("listitem").filter({ hasText: "crocodile" });
        const keywordBox = await keyword.boundingBox();
        const removeBox = await keyword.getByRole("button", { name: "Remove" }).boundingBox();
        expect(removeBox!.y - keywordBox!.y).toBeCloseTo(
            keywordBox!.y + keywordBox!.height - (removeBox!.y + removeBox!.height),
            0,
        );
    });
});
