/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { type Locator, type Page } from "@playwright/test";

import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";

async function box(locator: Locator): Promise<{ start: number; end: number }> {
    const rect = await locator.boundingBox();
    if (!rect) throw new Error("expected the element to be laid out");
    return { start: Math.round(rect.x), end: Math.round(rect.x + rect.width) };
}

async function insets(scope: Locator): Promise<{ avatar: number; avatarWidth: number; line: number; tileEnd: number }> {
    const panel = await box(scope.locator(".mx_RoomView_messagePanel"));
    const tile = scope.locator('.mx_EventTile[data-layout="bubble"][data-self="false"]').last();
    const tileBox = await box(tile);
    const avatar = await box(tile.locator(".mx_EventTile_avatar"));
    const line = await box(tile.locator(".mx_EventTile_line"));
    return {
        avatar: avatar.start - panel.start,
        avatarWidth: avatar.end - avatar.start,
        line: line.start - panel.start,
        tileEnd: panel.end - tileBox.end,
    };
}

async function groupInsets(
    scope: Locator,
    text: string,
): Promise<{ avatarHeight: number; sender: number; body: number; lineEnd: number }> {
    const panel = await box(scope.locator(".mx_RoomView_messagePanel"));
    const tile = scope.locator('.mx_EventTile[data-layout="group"]').filter({ hasText: text }).last();
    const avatar = await tile.locator(".mx_EventTile_avatar").boundingBox();
    if (!avatar) throw new Error("expected the avatar to be laid out");
    const sender = await box(tile.locator(".mx_DisambiguatedProfile"));
    const body = await box(tile.locator(".mx_EventTile_body"));
    const line = await box(tile.locator(".mx_EventTile_line"));
    return {
        avatarHeight: Math.round(avatar.height),
        sender: sender.start - panel.start,
        body: body.start - panel.start,
        lineEnd: panel.end - line.end,
    };
}

test.describe("Full-size thread view", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3489");
    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    test.beforeEach(async ({ page }: { page: Page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_lhs_size", "0");
        });
    });

    test("aligns bubble tiles with the room timeline they replace", async ({ page, app, bot }) => {
        await app.settings.setValue("Threads.fullSizeView", null, SettingLevel.DEVICE, true);
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

        const roomId = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials!.userId);
        await bot.joinRoom(roomId);
        await page.goto("/#/room/" + roomId);

        const roomView = page.locator(".mx_RoomView_body");
        const textbox = roomView.getByRole("textbox", { name: "Send an unencrypted message…" });
        await textbox.fill("Hello Mr. Bot");
        await textbox.press("Enter");

        const threadId = await roomView
            .locator(".mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: "Hello Mr. Bot" })
            .getAttribute("data-scroll-tokens");

        await bot.sendMessage(roomId, "Reply from the bot", threadId!);
        await bot.sendMessage(roomId, "A message in the room itself");

        await expect(roomView.getByText("A message in the room itself")).toBeVisible();
        const room = await insets(roomView);

        await roomView.locator(".mx_ThreadSummary").click();

        const threadView = page.locator(".mx_ThreadView_fullSize");
        await expect(threadView.getByText("Reply from the bot")).toBeVisible();
        const thread = await insets(threadView);

        expect(thread).toEqual(room);
        expect(thread.avatar).toBeGreaterThanOrEqual(0);
    });

    test("restores the room scroll position when the thread is closed", async ({ page, app, bot }) => {
        await app.settings.setValue("Threads.fullSizeView", null, SettingLevel.DEVICE, true);

        const roomId = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials!.userId);
        await bot.joinRoom(roomId);
        await page.goto("/#/room/" + roomId);

        const roomView = page.locator(".mx_RoomView_body");
        const textbox = roomView.getByRole("textbox", { name: "Send an unencrypted message…" });
        await textbox.fill("Thread root");
        await textbox.press("Enter");

        const threadId = await roomView
            .locator(".mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: "Thread root" })
            .getAttribute("data-scroll-tokens");
        await bot.sendMessage(roomId, "Reply from the bot", threadId!);

        for (let i = 0; i < 40; i++) await bot.sendMessage(roomId, `Filler ${i}`);
        await expect(roomView.getByText("Filler 39")).toBeVisible();

        const rootTile = roomView.locator(".mx_EventTile[data-scroll-tokens]").filter({ hasText: "Thread root" });
        const summary = roomView.locator(".mx_ThreadSummary");
        await rootTile.scrollIntoViewIfNeeded();
        await expect(summary).toBeVisible();
        await expect(roomView.getByText("Filler 39")).not.toBeInViewport();

        const rootOffset = async (): Promise<number> => {
            const panel = await roomView.locator(".mx_RoomView_messagePanel").boundingBox();
            const tile = await rootTile.boundingBox();
            if (!panel || !tile) throw new Error("expected the thread root to be laid out");
            return Math.round(tile.y - panel.y);
        };

        await page.waitForTimeout(500);
        const before = await rootOffset();

        await summary.click();
        await expect(page.locator(".mx_ThreadView_fullSize").getByText("Reply from the bot")).toBeVisible();

        await page
            .locator(".mx_ThreadHeader")
            .getByRole("button", { name: /^Back to / })
            .click();
        await expect(summary).toBeVisible();
        await expect(rootTile).toBeInViewport();

        await expect.poll(rootOffset).toBe(before);
    });

    test.describe("with read receipts turned off", () => {
        test.beforeEach(async ({ page }: { page: Page }) => {
            await page.addInitScript(() => {
                window.localStorage.setItem("mx_local_settings", JSON.stringify({ hideReadReceipts: true }));
            });
        });

        test("gives a group tile the same text column as the room timeline", async ({ page, app, bot }) => {
            await app.settings.setValue("Threads.fullSizeView", null, SettingLevel.DEVICE, true);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);

            const roomId = await app.client.createRoom({});
            await app.client.inviteUser(roomId, bot.credentials!.userId);
            await bot.joinRoom(roomId);
            await page.goto("/#/room/" + roomId);

            const roomView = page.locator(".mx_RoomView_body");
            const textbox = roomView.getByRole("textbox", { name: "Send an unencrypted message…" });
            await textbox.fill("Hello Mr. Bot");
            await textbox.press("Enter");

            const threadId = await roomView
                .locator(".mx_EventTile[data-scroll-tokens]")
                .filter({ hasText: "Hello Mr. Bot" })
                .getAttribute("data-scroll-tokens");

            await bot.sendMessage(roomId, "Reply from the bot", threadId!);
            await bot.sendMessage(roomId, "A message in the room itself");

            await expect(roomView.getByText("A message in the room itself")).toBeVisible();
            const room = await groupInsets(roomView, "A message in the room itself");

            await roomView.locator(".mx_ThreadSummary").click();

            const threadView = page.locator(".mx_ThreadView_fullSize");
            await expect(threadView.getByText("Reply from the bot")).toBeVisible();

            expect(await groupInsets(threadView, "Reply from the bot")).toEqual(room);
        });
    });

    test("keeps the room status bar above the thread composer", async ({ page, app, bot }) => {
        await app.settings.setValue("Threads.fullSizeView", null, SettingLevel.DEVICE, true);

        const roomId = await app.client.createRoom({});
        await app.client.inviteUser(roomId, bot.credentials!.userId);
        await bot.joinRoom(roomId);
        await page.goto("/#/room/" + roomId);

        const roomView = page.locator(".mx_RoomView_body");
        const textbox = roomView.getByRole("textbox", { name: "Send an unencrypted message…" });
        await textbox.fill("Hello Mr. Bot");
        await textbox.press("Enter");

        const threadId = await roomView
            .locator(".mx_EventTile[data-scroll-tokens]")
            .filter({ hasText: "Hello Mr. Bot" })
            .getAttribute("data-scroll-tokens");

        await bot.sendMessage(roomId, "Reply from the bot", threadId!);
        await bot.sendMessage(roomId, "A message in the room itself");

        await expect(roomView.getByText("A message in the room itself")).toBeVisible();

        await roomView.locator(".mx_ThreadSummary").click();

        const threadView = page.locator(".mx_ThreadView_fullSize");
        await expect(threadView.getByText("Reply from the bot")).toBeVisible();

        const statusArea = await roomView.locator(".mx_RoomView_statusArea").boundingBox();
        const composer = await threadView.locator(".mx_MessageComposer").boundingBox();
        if (!statusArea || !composer) throw new Error("expected the status area and the composer to be laid out");
        expect(statusArea.y).toBeLessThanOrEqual(composer.y);
    });
});
