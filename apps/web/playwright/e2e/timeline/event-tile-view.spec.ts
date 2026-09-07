/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page } from "@playwright/test";
import { expect, test } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";

const roomMessageList = (page: Page) => page.locator(".mx_RoomView_MessageList");

test.describe("EventTileView application coverage", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "Bob",
            autoAcceptInvites: true,
        },
    });

    test(
        "renders grouped messages from both users in each layout",
        { tag: "@screenshot" },
        async ({ page, app, bot }) => {
            const roomId = await app.client.createRoom({ name: "EventTile layouts" });
            await app.client.inviteUser(roomId, bot.credentials!.userId);
            await bot.joinRoom(roomId);

            await app.client.sendMessage(roomId, "Alice first");
            await app.client.sendMessage(roomId, "Alice continuation");
            await bot.sendMessage(roomId, "Bob first");
            await bot.sendMessage(roomId, "Bob continuation");

            await app.viewRoomById(roomId);
            const messages = roomMessageList(page);
            const messageTiles = messages.locator(".mx_EventTile").filter({
                has: page.getByTestId("event-tile-slot-body"),
                hasText: /Alice first|Alice continuation|Bob first|Bob continuation/,
            });

            for (const layout of [Layout.Group, Layout.Bubble, Layout.IRC]) {
                await app.settings.setValue("layout", null, SettingLevel.DEVICE, layout);
                await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);

                await expect(messageTiles).toHaveCount(4);

                await expect(messages).toMatchScreenshot(`event-tile-${layout}.png`, {
                    css: ".mx_MessageTimestamp { visibility: hidden; }",
                });
            }

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            await expect(messageTiles).toHaveCount(4);
            await expect(messages).toMatchScreenshot("event-tile-group-compact.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
            });
        },
    );

    test(
        "keeps tile interaction states in the application DOM",
        { tag: "@screenshot" },
        async ({ page, app, bot, user }, testInfo) => {
            const roomId = await app.client.createRoom({ name: "EventTile interactions" });
            await app.client.inviteUser(roomId, bot.credentials!.userId);
            await bot.joinRoom(roomId);

            const event = await app.client.sendMessage(roomId, "Interaction target");
            await app.viewRoomById(roomId);

            const tile = page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${event.event_id}']`);
            const line = tile.locator(".mx_EventTile_line");
            const actionBar = tile
                .getByTestId("event-tile-slot-actionBar")
                .getByRole("toolbar", { name: "Message Actions" });

            await line.hover();
            await expect(actionBar).toBeVisible();
            await expect(tile.locator(".mx_MessageTimestamp")).toBeVisible();
            await expect(tile).toMatchScreenshot("event-tile-hovered.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
                hideJumpToBottomButton: true,
            });

            // Move the pointer away so the following assertions exercise keyboard focus rather than hover.
            await page.mouse.move(0, 0);
            await expect(actionBar).not.toBeVisible();

            await page.getByRole("textbox", { name: "Send an unencrypted message…" }).focus();
            // what-input listens for keyboard events and records the modality on <html>.
            await page.keyboard.press("ArrowRight");
            await expect(page.locator("html")).toHaveAttribute("data-whatinput", "keyboard");
            await tile.focus();
            await expect(tile).toBeFocused();
            await expect(actionBar).toBeVisible();
            await expect(tile.locator(".mx_MessageTimestamp")).toBeVisible();

            await line.click({ button: "right" });
            await expect(page.locator(".mx_IconizedContextMenu")).toBeVisible();
            // The context menu is rendered in a portal above the tile, so capturing the tile alone clips its menu.
            await expect(page).toMatchScreenshot("event-tile-context-menu-selected.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
                hideJumpToBottomButton: true,
            });
            await page.keyboard.press("Escape");
            await expect(tile).toMatchScreenshot("event-tile-context-menu-closed.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
                hideJumpToBottomButton: true,
            });

            const highlightedEvent = await bot.sendMessage(roomId, {
                "msgtype": "m.text",
                "body": "Highlighted notification",
                "format": "org.matrix.custom.html",
                "formatted_body": `<a href="https://matrix.to/#/${user.userId}">Highlighted notification</a>`,
                "m.mentions": {
                    user_ids: [user.userId],
                },
            });
            if (!["Dendrite", "Pinecone"].includes(testInfo.project.name)) {
                const highlightedTile = page.locator(`.mx_EventTile[data-event-id='${highlightedEvent.event_id}']`);
                await expect(highlightedTile).toMatchScreenshot("event-tile-highlighted.png", {
                    css: ".mx_MessageTimestamp { visibility: hidden; }",
                    hideJumpToBottomButton: true,
                });
            }

            await page.goto(`/#/room/${roomId}/${event.event_id}`);
            const selectedTile = page.locator(`.mx_EventTile[data-event-id='${event.event_id}']`);
            await expect(selectedTile).toMatchScreenshot("event-tile-permalink-selected.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
                hideJumpToBottomButton: true,
            });

            await selectedTile.locator(".mx_EventTile_line").hover();
            const editButton = selectedTile.getByRole("button", { name: "Edit", exact: true });
            await expect(editButton).toBeVisible();
            await editButton.click();
            await expect(selectedTile).toMatchScreenshot("event-tile-editing.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
                hideJumpToBottomButton: true,
            });
            await expect(page.getByRole("textbox", { name: "Edit message" })).toBeVisible();
            await page.getByRole("textbox", { name: "Edit message" }).fill("Interaction target edited");
            await page.getByRole("textbox", { name: "Edit message" }).press("Enter");
            await expect(page.locator(".mx_EventTile", { hasText: "Interaction target edited" })).toBeVisible();
        },
    );

    test(
        "distinguishes matching and contextual search tiles and preserves result links",
        { tag: "@screenshot" },
        async ({ page, app, bot }, testInfo) => {
            test.skip(
                ["Dendrite", "Pinecone"].includes(testInfo.project.name),
                "The configured homeserver has server-side search disabled",
            );

            const roomId = await app.client.createRoom({
                name: "EventTile search",
            });
            await app.client.inviteUser(roomId, bot.credentials!.userId);
            await bot.joinRoom(roomId);

            const contextBefore = await app.client.sendMessage(roomId, "context before");
            const root = await app.client.sendMessage(roomId, "match root link https://example.org");
            const other = await bot.sendMessage(roomId, "match other link");
            const contextAfter = await bot.sendMessage(roomId, "context after");

            await app.viewRoomById(roomId);
            await app.toggleRoomInfoPanel();
            const search = page.locator(".mx_RoomSummaryCard_search").getByRole("searchbox");
            await search.fill("match");
            await search.press("Enter");

            const results = page.locator(".mx_RoomView_searchResultsPanel");
            const matching = results.locator(".mx_EventTile").filter({
                has: page.locator(".mx_EventTile_searchHighlight"),
            });
            const rootTile = results
                .locator(`.mx_EventTile[data-event-id='${root.event_id}']`)
                .filter({ has: page.locator(".mx_EventTile_searchHighlight") });
            const otherTile = results
                .locator(`.mx_EventTile[data-event-id='${other.event_id}']`)
                .filter({ has: page.locator(".mx_EventTile_searchHighlight") });
            await expect(matching).toHaveCount(2);
            for (const event of [contextBefore, contextAfter]) {
                await expect(results.locator(`.mx_EventTile[data-event-id='${event.event_id}']`)).toHaveCount(1);
            }

            await expect(rootTile).toHaveCount(1);
            await expect(otherTile).toHaveCount(1);
            for (const tile of [rootTile, otherTile]) {
                await expect(tile.locator(".mx_EventTile_searchHighlight")).toBeVisible();
            }

            await expect(rootTile.locator(`a[href='#/room/${roomId}/${root.event_id}']`)).toBeVisible();
            await expect(otherTile.locator(`a[href='#/room/${roomId}/${other.event_id}']`)).toBeVisible();

            await expect(results).toMatchScreenshot("search-results-event-tiles.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
            });

            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            await expect(matching).toHaveCount(2);
        },
    );

    test(
        "renders threaded search information and preserves the result link",
        { tag: "@screenshot" },
        async ({ page, app, bot }, testInfo) => {
            test.skip(
                ["Dendrite", "Pinecone"].includes(testInfo.project.name),
                "The configured homeserver has server-side search disabled",
            );

            const roomId = await app.client.createRoom({ name: "EventTile threaded search" });
            await app.client.inviteUser(roomId, bot.credentials!.userId);
            await bot.joinRoom(roomId);

            const root = await app.client.sendMessage(roomId, "match root");
            const reply = await bot.sendMessage(roomId, "match threaded reply", root.event_id);

            await app.viewRoomById(roomId);
            await app.toggleRoomInfoPanel();
            const search = page.locator(".mx_RoomSummaryCard_search").getByRole("searchbox");
            await search.fill("match");
            await search.press("Enter");

            const results = page.locator(".mx_RoomView_searchResultsPanel");
            const replyTile = results
                .locator(`.mx_EventTile[data-event-id='${reply.event_id}']`)
                .filter({ has: page.locator(".mx_EventTile_searchHighlight") });
            await expect(replyTile).toHaveCount(1);
            await expect(replyTile.locator(".mx_ThreadSummary_icon")).toBeVisible();
            await expect(replyTile.locator(".mx_ThreadSummary_icon")).toHaveAttribute(
                "href",
                `#/room/${roomId}/${reply.event_id}`,
            );

            const threadSummaries = results.locator(".mx_ThreadSummary");
            await expect(threadSummaries).toHaveCount(2);
            for (const summary of await threadSummaries.all()) {
                await expect(summary).toContainText("1 reply");
            }

            await expect(results).toMatchScreenshot("threaded-search-event-tiles.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
            });
        },
    );

    test.describe("populated notification panel", () => {
        test.use({ labsFlags: ["feature_notifications"] });

        test(
            "renders notification EventTiles as populated group-layout previews",
            { tag: "@screenshot" },
            async ({ page, app, bot, user }, testInfo) => {
                test.skip(
                    ["Dendrite", "Pinecone"].includes(testInfo.project.name),
                    "The configured homeserver does not populate the global notification timeline for this fixture",
                );

                const sourceRoomId = await app.client.createRoom({
                    name: "Notification source",
                });
                await app.client.inviteUser(sourceRoomId, bot.credentials!.userId);
                await bot.joinRoom(sourceRoomId);
                const parkingRoomId = await app.client.createRoom({ name: "Notification parking" });
                const notificationText =
                    "Notification event with enough text to span more than two lines in the notification preview";

                await app.viewRoomById(parkingRoomId);
                const notificationEvent = await bot.sendMessage(sourceRoomId, {
                    "msgtype": "m.text",
                    "body": notificationText,
                    "format": "org.matrix.custom.html",
                    "formatted_body": `<a href="https://matrix.to/#/${user.userId}">${notificationText}</a>`,
                    "m.mentions": {
                        user_ids: [user.userId],
                    },
                });

                await expect
                    .poll(() =>
                        app.client.evaluate(
                            (client, eventId) =>
                                client
                                    .getNotifTimelineSet()
                                    ?.getLiveTimeline()
                                    .getEvents()
                                    .some((event) => event.getId() === eventId),
                            notificationEvent.event_id,
                        ),
                    )
                    .toBe(true);

                await page.getByRole("button", { name: "Notifications" }).click();
                const panel = page.locator(".mx_ThreadPanel");
                const tile = panel.locator(".mx_EventTile", { hasText: notificationText });
                await expect(tile).toBeVisible();
                await expect(tile.getByTestId("event-tile-slot-body")).toBeVisible();
                await expect(tile.getByTestId("event-tile-slot-sender")).toContainText("Bob");
                await expect(tile).toMatchScreenshot("notification-event-tile.png", {
                    css: ".mx_MessageTimestamp { visibility: hidden; }",
                });
            },
        );
    });
});
