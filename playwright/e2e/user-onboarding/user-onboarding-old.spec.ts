/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("User Onboarding (old user)", () => {
    test.use({
        displayName: "Jane Doe",
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_registration_time", "2");
        });
    });

    test("page and preference are hidden", async ({ page, user, app }) => {
        await expect(page.locator(".mx_UserOnboardingPage")).not.toBeVisible();
        await expect(page.locator(".mx_UserOnboardingButton")).not.toBeVisible();
        await app.settings.openUserSettings("Preferences");
        await expect(page.getByText("Show shortcut to welcome checklist above the room list")).not.toBeVisible();
    });
});
