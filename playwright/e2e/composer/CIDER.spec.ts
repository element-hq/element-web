/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";

const CtrlOrMeta = process.platform === "darwin" ? "Meta" : "Control";

test.describe("Composer", () => {
    test.use({
        displayName: "Janet",
        botCreateOpts: {
            displayName: "Bob",
        },
    });

    test.use({
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "Composing Room" });
            await app.viewRoomByName("Composing Room");
            await use({ roomId });
        },
    });

    test.beforeEach(async ({ room }) => {}); // trigger room fixture

    test.describe("CIDER", () => {
        test("sends a message when you click send or press Enter", async ({ page }) => {
            const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });

            // Type a message
            await composer.pressSequentially("my message 0");
            // It has not been sent yet
            await expect(page.locator(".mx_EventTile_body", { hasText: "my message 0" })).not.toBeVisible();

            // Click send
            await page.getByRole("button", { name: "Send message" }).click();
            // It has been sent
            await expect(
                page.locator(".mx_EventTile_last .mx_EventTile_body", { hasText: "my message 0" }),
            ).toBeVisible();

            // Type another and press Enter afterward
            await composer.pressSequentially("my message 1");
            await composer.press("Enter");
            // It was sent
            await expect(
                page.locator(".mx_EventTile_last .mx_EventTile_body", { hasText: "my message 1" }),
            ).toBeVisible();
        });

        test("can write formatted text", async ({ page }) => {
            const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });

            await composer.pressSequentially("my bold");
            await composer.press(`${CtrlOrMeta}+KeyB`);
            await composer.pressSequentially(" message");
            await page.getByRole("button", { name: "Send message" }).click();
            // Note: both "bold" and "message" are bold, which is probably surprising
            await expect(page.locator(".mx_EventTile_body strong", { hasText: "bold message" })).toBeVisible();
        });

        test("should allow user to input emoji via graphical picker", async ({ page, app }) => {
            await app.getComposer(false).getByRole("button", { name: "Emoji" }).click();

            await page.getByTestId("mx_EmojiPicker").locator(".mx_EmojiPicker_item", { hasText: "😇" }).click();

            await page.locator(".mx_ContextualMenu_background").click(); // Close emoji picker
            await page.getByRole("textbox", { name: "Send an unencrypted message…" }).press("Enter"); // Send message

            await expect(page.locator(".mx_EventTile_body", { hasText: "😇" })).toBeVisible();
        });

        test.describe("render emoji picker with larger viewport height", async () => {
            test.use({ viewport: { width: 1280, height: 720 } });
            test("render emoji picker", { tag: "@screenshot" }, async ({ page, app }) => {
                await app.getComposer(false).getByRole("button", { name: "Emoji" }).click();
                await expect(page.getByTestId("mx_EmojiPicker")).toMatchScreenshot("emoji-picker.png");
            });
        });

        test.describe("render emoji picker with small viewport height", async () => {
            test.use({ viewport: { width: 1280, height: 360 } });
            test("render emoji picker", { tag: "@screenshot" }, async ({ page, app }) => {
                await app.getComposer(false).getByRole("button", { name: "Emoji" }).click();
                await expect(page.getByTestId("mx_EmojiPicker")).toMatchScreenshot("emoji-picker-small.png");
            });
        });

        test("should have focus lock in emoji picker", async ({ page, app }) => {
            const emojiButton = app.getComposer(false).getByRole("button", { name: "Emoji" });

            // Open emoji picker by clicking the button
            await emojiButton.click();

            // Wait for emoji picker to be visible
            const emojiPicker = page.getByTestId("mx_EmojiPicker");
            await expect(emojiPicker).toBeVisible();

            // Get initial focused element (should be search input)
            const searchInput = emojiPicker.getByRole("textbox", { name: "Search" });
            await expect(searchInput).toBeFocused();

            // Try to tab multiple times - focus should stay within emoji picker
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");
            await page.keyboard.press("Tab");

            // Verify we're still within the emoji picker (not back to composer)
            const focusedElement = await page.evaluate(() => document.activeElement?.closest(".mx_EmojiPicker"));
            expect(focusedElement).not.toBeNull();

            // Close with Escape key
            await page.keyboard.press("Escape");

            // Verify emoji picker is closed
            await expect(emojiPicker).not.toBeVisible();

            // Verify focus returns to emoji button
            await expect(emojiButton).toBeFocused();
        });

        test.describe("when Control+Enter is required to send", () => {
            test.beforeEach(async ({ app }) => {
                await app.settings.setValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            test("only sends when you press Control+Enter", async ({ page }) => {
                const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
                // Type a message and press Enter
                await composer.pressSequentially("my message 3");
                await composer.press("Enter");
                // It has not been sent yet
                await expect(page.locator(".mx_EventTile_body", { hasText: "my message 3" })).not.toBeVisible();

                // Press Control+Enter
                await composer.press(`${CtrlOrMeta}+Enter`);
                // It was sent
                await expect(
                    page.locator(".mx_EventTile_last .mx_EventTile_body", { hasText: "my message 3" }),
                ).toBeVisible();
            });
        });

        test("can send mention", { tag: "@screenshot" }, async ({ page, bot, app }) => {
            // Set up a private room so we have another user to mention
            await app.client.createRoom({
                is_direct: true,
                invite: [bot.credentials.userId],
            });
            await app.viewRoomByName("Bob");

            const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
            await composer.pressSequentially("@bob");

            // Note that we include the user ID here as the room tile is also an 'option' role
            // with text 'Bob'
            await page.getByRole("option", { name: `Bob ${bot.credentials.userId}` }).click();
            await expect(composer.getByText("Bob")).toBeVisible();
            await expect(composer).toMatchScreenshot("mention.png");
            await composer.press("Enter");
            await expect(page.locator(".mx_EventTile_body", { hasText: "Bob" })).toBeVisible();
        });
    });
});
