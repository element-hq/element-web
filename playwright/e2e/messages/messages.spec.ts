/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

/* See readme.md for tips on writing these tests. */

import { Locator, Page } from "playwright-core";

import { test, expect } from "../../element-web-test";

async function sendMessage(page: Page, message: string): Promise<Locator> {
    await page.getByRole("textbox", { name: "Send a message…" }).fill(message);
    await page.getByRole("button", { name: "Send message" }).click();

    const msgTile = page.locator(".mx_EventTile_last");
    await msgTile.locator(".mx_EventTile_receiptSent").waitFor();
    return msgTile;
}

async function sendMultilineMessages(page: Page, messages: string[]) {
    await page.getByRole("textbox", { name: "Send a message…" }).focus();
    for (let i = 0; i < messages.length; i++) {
        await page.keyboard.type(messages[i]);
        if (i < messages.length - 1) await page.keyboard.press("Shift+Enter");
    }

    await page.getByRole("button", { name: "Send message" }).click();

    const msgTile = page.locator(".mx_EventTile_last");
    await msgTile.locator(".mx_EventTile_receiptSent").waitFor();
    return msgTile;
}

async function replyMessage(page: Page, message: Locator, replyMessage: string): Promise<Locator> {
    const line = message.locator(".mx_EventTile_line");
    await line.hover();
    await line.getByRole("button", { name: "Reply", exact: true }).click();

    await page.getByRole("textbox", { name: "Send a reply…" }).fill(replyMessage);
    await page.getByRole("button", { name: "Send message" }).click();

    const msgTile = page.locator(".mx_EventTile_last");
    await msgTile.locator(".mx_EventTile_receiptSent").waitFor();
    return msgTile;
}

async function editMessage(page: Page, message: Locator, newMsg: string): Promise<void> {
    const line = message.locator(".mx_EventTile_line");
    await line.hover();
    await line.getByRole("button", { name: "Edit" }).click();
    const editComposer = page.getByRole("textbox", { name: "Edit message" });
    await page.getByLabel("User menu").hover(); // Just to un-hover the message line
    await editComposer.fill(newMsg);
    await editComposer.press("Enter");
}

test.describe("Message rendering", () => {
    [
        { direction: "ltr", displayName: "Quentin" },
        { direction: "rtl", displayName: "كوينتين" },
    ].forEach(({ direction, displayName }) => {
        test.describe(`with ${direction} display name`, () => {
            test.use({
                displayName,
                room: async ({ user, app }, use) => {
                    const roomId = await app.client.createRoom({ name: "Test room" });
                    await use({ roomId });
                },
            });

            test("should render a basic LTR text message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "Hello, world!");
                await expect(msgTile).toMatchScreenshot(`basic-message-ltr-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });

            test("should render an LTR emote", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "/me lays an egg");
                await expect(msgTile).toMatchScreenshot(`emote-ltr-${direction}displayname.png`);
            });

            test("should render an LTR rich text emote", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "/me lays a *free range* egg");
                await expect(msgTile).toMatchScreenshot(`emote-rich-ltr-${direction}displayname.png`);
            });

            test("should render an edited LTR message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "Hello, world!");

                await editMessage(page, msgTile, "Hello, universe!");

                await expect(msgTile).toMatchScreenshot(`edited-message-ltr-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });

            test("should render a reply of a LTR message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMultilineMessages(page, [
                    "Fist line",
                    "Second line",
                    "Third line",
                    "Fourth line",
                ]);

                await replyMessage(page, msgTile, "response to multiline message");
                await expect(msgTile).toMatchScreenshot(`reply-message-ltr-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });

            test("should render a basic RTL text message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "مرحبا بالعالم!");
                await expect(msgTile).toMatchScreenshot(`basic-message-rtl-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });

            test("should render an RTL emote", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "/me يضع بيضة");
                await expect(msgTile).toMatchScreenshot(`emote-rtl-${direction}displayname.png`);
            });

            test("should render a richtext RTL emote", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "/me أضع بيضة *حرة النطاق*");
                await expect(msgTile).toMatchScreenshot(`emote-rich-rtl-${direction}displayname.png`);
            });

            test("should render an edited RTL message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMessage(page, "مرحبا بالعالم!");

                await editMessage(page, msgTile, "مرحبا بالكون!");

                await expect(msgTile).toMatchScreenshot(`edited-message-rtl-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });

            test("should render a reply of a RTL message", async ({ page, user, app, room }) => {
                await page.goto(`#/room/${room.roomId}`);

                const msgTile = await sendMultilineMessages(page, [
                    "مرحبا بالعالم!",
                    "مرحبا بالعالم!",
                    "مرحبا بالعالم!",
                    "مرحبا بالعالم!",
                ]);

                await replyMessage(page, msgTile, "مرحبا بالعالم!");
                await expect(msgTile).toMatchScreenshot(`reply-message-trl-${direction}displayname.png`, {
                    mask: [page.locator(".mx_MessageTimestamp")],
                });
            });
        });
    });
});
