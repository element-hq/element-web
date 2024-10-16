/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
        await expect(page.locator(".mx_UserOnboardingPage")).toMatchScreenshot(
            "User-Onboarding-new-user-page-is-shown-and-preference-exists-1.png",
        );
        await app.settings.openUserSettings("Preferences");
        await expect(page.getByText("Show shortcut to welcome checklist above the room list")).toBeVisible();
    });

    test("app download dialog", async ({ page }) => {
        await page.getByRole("button", { name: "Download apps" }).click();
        await expect(
            page.getByRole("dialog").getByRole("heading", { level: 1, name: "Download Element" }),
        ).toBeVisible();
        await expect(page.locator(".mx_Dialog")).toMatchScreenshot(
            "User-Onboarding-new-user-app-download-dialog-1.png",
            {
                // Set a constant bg behind the modal to ensure screenshot stability
                css: `
                    .mx_AppDownloadDialog_wrapper {
                        background: black;
                    }
                `,
            },
        );
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
