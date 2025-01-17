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
            const composer = page.getByRole("textbox", { name: "Send a message…" });

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
            const composer = page.getByRole("textbox", { name: "Send a message…" });

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
            await page.getByRole("textbox", { name: "Send a message…" }).press("Enter"); // Send message

            await expect(page.locator(".mx_EventTile_body", { hasText: "😇" })).toBeVisible();
        });

        test.describe("when Control+Enter is required to send", () => {
            test.beforeEach(async ({ app }) => {
                await app.settings.setValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            test("only sends when you press Control+Enter", async ({ page }) => {
                const composer = page.getByRole("textbox", { name: "Send a message…" });
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
    });
});
