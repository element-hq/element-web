/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";
import { rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from ".";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

// A 2x2 magenta PNG: enough to prove the upload round-trip and give the custom tile something to show.
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4ECwESJ5uFhAADrOwMBnDeHDwAAAABJRU5ErkJggg==",
    "base64",
);

/**
 * Locate the panel by class, not by test id: webpack drops `data-testid` from the production bundle that the
 * `CI=1` web server serves, so `getByTestId("chatBackgroundPanel")` finds nothing even though it renders.
 */
const chatBackgroundPanel = (page: Page) =>
    page.locator(".mx_SettingsSubsection").filter({ has: page.locator(".mx_ChatBackgroundPanel_rail") });

/**
 * The tile a user actually clicks. The radio itself is deliberately hidden behind the preview, so driving it
 * directly is both unclickable and a lie about how the control is used.
 */
const tile = (page: Page, name: string) =>
    chatBackgroundPanel(page).locator(".mx_ChatBackgroundPanel_tile", { hasText: name });

test.describe("Chat background panel", () => {
    test.use({ displayName: "Hanako" });

    test("lets the user pick, upload and clear a wallpaper", async ({ page, app, user, util, axe }) => {
        await rejectToast(page, "Verify this device");
        await util.disableSystemTheme();
        await util.openAppearanceTab();

        const panel = chatBackgroundPanel(page);
        await expect(panel).toBeVisible();

        // Nothing is chosen, so the opacity slider has nothing to act on.
        await expect(panel.getByRole("radio", { name: "None" })).toBeChecked();
        await expect(panel.getByRole("slider")).toBeDisabled();

        // The tiles stay on a single row, so the section never pushes the rest of the tab out of reach.
        const railBox = await panel.locator(".mx_ChatBackgroundPanel_rail").boundingBox();
        const tileBox = await panel.locator(".mx_ChatBackgroundPanel_tile").first().boundingBox();
        expect(railBox).not.toBeNull();
        expect(tileBox).not.toBeNull();
        expect(railBox!.height).toBeLessThan(tileBox!.height * 2);

        await tile(page, "Doodles").click();
        await expect(panel.getByRole("radio", { name: "Doodles" })).toBeChecked();
        await expect(panel.getByRole("slider")).toBeEnabled();

        // The wallpaper reaches the timeline, not just the setting.
        await util.closeAppearanceTab();
        await util.createAndDisplayRoom();
        await expect(page.locator(".mx_RoomView_timeline")).toHaveCSS("--mx-chat-background-repeat", "repeat");

        await util.openAppearanceTab();
        await panel.locator('input[type="file"]').setInputFiles({
            name: "wallpaper.png",
            mimeType: "image/png",
            buffer: PNG,
        });

        // Uploading selects the image, and its tile survives picking a preset afterwards -- otherwise the only
        // way back to it is to upload it again.
        const custom = panel.getByRole("radio", { name: "Custom image" });
        await expect(custom).toBeChecked();
        await tile(page, "Paper").click();
        await expect(panel.getByRole("radio", { name: "Paper" })).toBeChecked();
        await expect(custom).toBeVisible();

        // Re-selecting it restores the uploaded image rather than doing nothing.
        await tile(page, "Custom image").click();
        await expect(custom).toBeChecked();

        await expect(axe).toHaveNoViolations();

        // Removing drops the tile and falls back to no wallpaper.
        await panel.getByRole("button", { name: "Remove" }).click();
        await expect(custom).not.toBeVisible();
        await expect(panel.getByRole("radio", { name: "None" })).toBeChecked();
    });

    test("renders the rail in the dark theme", async ({ page, app, user, util }) => {
        await rejectToast(page, "Verify this device");
        await util.disableSystemTheme();
        await app.settings.setValue("theme", null, SettingLevel.DEVICE, "dark");
        await util.openAppearanceTab();

        const panel = chatBackgroundPanel(page);
        await expect(panel).toBeVisible();
        await tile(page, "Dusk glow").click();
        await expect(panel.getByRole("radio", { name: "Dusk glow" })).toBeChecked();
    });

    test("moves between tiles with the arrow keys", async ({ page, app, user, util }) => {
        await rejectToast(page, "Verify this device");
        await util.openAppearanceTab();

        const panel = chatBackgroundPanel(page);
        await panel.getByRole("radio", { name: "None" }).focus();

        // The rail is a native radio group: one tab stop, walked with the arrow keys.
        await page.keyboard.press("ArrowRight");
        await expect(panel.getByRole("radio", { name: "Doodles" })).toBeChecked();
        await expect(panel.getByRole("radio", { name: "Doodles" })).toBeFocused();

        await page.keyboard.press("ArrowRight");
        await expect(panel.getByRole("radio", { name: "Paper" })).toBeChecked();
        await expect(panel.getByRole("radio", { name: "Paper" })).toBeFocused();
    });
});
