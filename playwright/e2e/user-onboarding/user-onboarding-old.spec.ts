/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
        await app.openUserSettings("Preferences");
        await expect(page.getByText("Show shortcut to welcome checklist above the room list")).not.toBeVisible();
    });
});
