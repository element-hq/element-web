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

test.describe("User Onboarding (new user)", () => {
    test.use({
        displayName: "Jane Doe",
    });

    // This first beforeEach happens before the `user` fixture runs
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_registration_time", "1656633601");
        });
    });

    test.beforeEach(async ({ page, user }) => {
        await expect(page.locator(".mx_UserOnboardingPage")).toBeVisible();
        await expect(page.getByRole("button", { name: "Welcome" })).toBeVisible();
        await expect(page.locator(".mx_UserOnboardingList")).toBeVisible();
    });

    test("page is shown and preference exists", async ({ page, app }) => {
        await expect(page.locator(".mx_UserOnboardingPage")).toMatchScreenshot();
        await app.settings.openUserSettings("Preferences");
        await expect(page.getByText("Show shortcut to welcome checklist above the room list")).toBeVisible();
    });

    test("app download dialog", async ({ page }) => {
        await page.getByRole("button", { name: "Download apps" }).click();
        await expect(
            page.getByRole("dialog").getByRole("heading", { level: 2, name: "Download Element" }),
        ).toBeVisible();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot();
    });

    test("using find friends action should increase progress", async ({ page, homeserver }) => {
        const bot = await homeserver.registerUser("botbob", "password", "BotBob");

        const oldProgress = parseFloat(await page.getByRole("progressbar").getAttribute("value"));
        await page.getByRole("button", { name: "Find friends" }).click();
        await page.locator(".mx_InviteDialog_editor").getByRole("textbox").fill(bot.userId);
        await page.getByRole("button", { name: "Go" }).click();
        await expect(page.locator(".mx_InviteDialog_buttonAndSpinner")).not.toBeVisible();

        const message = "Hi!";
        const composer = page.getByRole("textbox", { name: "Send a message…" });
        await composer.fill(`${message}`);
        await composer.press("Enter");
        await expect(page.locator(".mx_MTextBody.mx_EventTile_content", { hasText: message })).toBeVisible();

        await page.goto("/#/home");
        await expect(page.locator(".mx_UserOnboardingPage")).toBeVisible();
        await expect(page.getByRole("button", { name: "Welcome" })).toBeVisible();
        await expect(page.locator(".mx_UserOnboardingList")).toBeVisible();

        await page.waitForTimeout(500); // await progress bar animation
        const progress = parseFloat(await page.getByRole("progressbar").getAttribute("value"));
        expect(progress).toBeGreaterThan(oldProgress);
    });
});
