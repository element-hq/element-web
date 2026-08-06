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

    test("renders own and other-user messages with layout and section metadata", async ({ page, app, bot }) => {
        const roomId = await app.client.createRoom({ name: "EventTile layouts" });
        await app.client.inviteUser(roomId, bot.credentials!.userId);
        await bot.joinRoom(roomId);

        await app.client.sendMessage(roomId, "Alice first");
        await app.client.sendMessage(roomId, "Alice continuation");
        await bot.sendMessage(roomId, "Bob first");
        await bot.sendMessage(roomId, "Bob continuation");

        await app.viewRoomById(roomId);
        const messages = roomMessageList(page);
        const tileFor = (message: string) => messages.locator(".mx_EventTile").filter({ hasText: message }).last();

        for (const layout of [Layout.Group, Layout.Bubble, Layout.IRC]) {
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, layout);
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, false);

            const aliceFirst = tileFor("Alice first");
            const aliceContinuation = tileFor("Alice continuation");
            const bobFirst = tileFor("Bob first");
            const bobContinuation = tileFor("Bob continuation");

            await expect(
                messages.locator(`.mx_EventTile[data-layout='${layout}']`).filter({
                    has: page.locator(".mx_EventTile_body"),
                }),
            ).toHaveCount(4);
            await expect(aliceFirst).toHaveAttribute("data-layout", layout);
            await expect(aliceFirst).toHaveAttribute("data-self", "true");
            await expect(aliceFirst).toHaveAttribute("data-event-id", /.+/);
            await expect(bobFirst).toHaveAttribute("data-self", "false");

            await expect(aliceFirst).not.toHaveClass(/mx_EventTile_continuation/);
            await expect(aliceContinuation).toHaveClass(/mx_EventTile_continuation/);
            await expect(aliceContinuation).toHaveClass(/mx_EventTile_lastInSection/);
            await expect(bobFirst).not.toHaveClass(/mx_EventTile_continuation/);
            await expect(bobContinuation).toHaveClass(/mx_EventTile_continuation/);
            await expect(bobContinuation).toHaveClass(/mx_EventTile_lastInSection/);
            await expect(bobContinuation).toHaveClass(/mx_EventTile_last/);
        }

        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
        await expect(
            messages.locator(".mx_EventTile[data-layout='group']").filter({ has: page.locator(".mx_EventTile_body") }),
        ).toHaveCount(4);
        await expect(tileFor("Alice continuation")).toHaveClass(/mx_EventTile_continuation/);
        await expect(tileFor("Bob continuation")).toHaveClass(/mx_EventTile_lastInSection/);
    });

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
            const actionBar = tile.locator(".mx_MessageActionBar");

            await line.hover();
            await expect(actionBar).toBeVisible();
            await expect(tile.locator(".mx_MessageTimestamp")).toBeVisible();
            await expect(tile).toMatchScreenshot("event-tile-hovered.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
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
            await expect(tile).toHaveClass(/mx_EventTile_selected/);
            await expect(page.locator(".mx_IconizedContextMenu")).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(tile).not.toHaveClass(/mx_EventTile_selected/);

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
                await expect(highlightedTile).toHaveClass(/mx_EventTile_highlight/);
            }

            await page.goto(`/#/room/${roomId}/${event.event_id}`);
            const selectedTile = page.locator(`.mx_EventTile[data-event-id='${event.event_id}']`);
            await expect(selectedTile).toHaveClass(/mx_EventTile_selected/);

            await selectedTile.locator(".mx_EventTile_line").hover();
            await selectedTile.getByRole("button", { name: "Edit", exact: true }).click();
            await expect(selectedTile).toHaveClass(/mx_EventTile_isEditing/);
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

            await app.client.sendMessage(roomId, "context before");
            const root = await app.client.sendMessage(roomId, "match root link https://example.org");
            const reply = await bot.sendMessage(roomId, {
                "msgtype": "m.text",
                "body": "match threaded reply",
                "m.relates_to": {
                    "rel_type": "m.thread",
                    "event_id": root.event_id,
                    "m.in_reply_to": { event_id: root.event_id },
                },
            });
            await bot.sendMessage(roomId, "context after");

            await app.viewRoomById(roomId);
            const timelineSummary = page.locator(".mx_RoomView_body .mx_ThreadSummary");
            await expect(timelineSummary.getByText("Bob")).toBeAttached();
            await expect(timelineSummary.getByText("match threaded reply")).toBeAttached();
            await app.toggleRoomInfoPanel();
            const search = page.locator(".mx_RoomSummaryCard_search").getByRole("searchbox");
            await search.fill("match");
            await search.press("Enter");

            const results = page.locator(".mx_RoomView_searchResultsPanel");
            const matching = results.locator(".mx_EventTile:not(.mx_EventTile_contextual)");
            const contextual = results.locator(".mx_EventTile.mx_EventTile_contextual");
            await expect(matching).toHaveCount(2);
            expect(await contextual.count()).toBeGreaterThan(0);
            await expect(contextual.first()).toHaveCSS("opacity", "0.4");

            for (const tile of await matching.all()) {
                await expect(tile.locator(".mx_EventTile_searchHighlight")).toBeVisible();
                await expect(tile).toHaveAttribute("data-layout", /group|bubble|irc/);
            }

            const rootTile = matching.filter({ hasText: "match root link" });
            await expect(rootTile.locator(`a[href='#/room/${roomId}/${root.event_id}']`)).toBeVisible();

            const replyTile = matching.filter({ hasText: "match threaded reply" });
            await expect(replyTile.locator(".mx_ThreadSummary_icon")).toHaveAttribute(
                "href",
                `#/room/${roomId}/${reply.event_id}`,
            );

            await expect(results).toMatchScreenshot("search-results-event-tiles.png", {
                css: ".mx_MessageTimestamp { visibility: hidden; }",
            });

            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            await expect(
                results.locator(".mx_EventTile:not(.mx_EventTile_contextual)[data-layout='bubble']"),
            ).toHaveCount(2);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await app.settings.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            await expect(
                results.locator(".mx_EventTile:not(.mx_EventTile_contextual)[data-layout='group']"),
            ).toHaveCount(2);
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

                await app.viewRoomById(parkingRoomId);
                const notificationEvent = await bot.sendMessage(sourceRoomId, {
                    "msgtype": "m.text",
                    "body": "Notification event",
                    "format": "org.matrix.custom.html",
                    "formatted_body": `<a href="https://matrix.to/#/${user.userId}">Notification event</a>`,
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
                const tile = panel.locator(".mx_EventTile", { hasText: "Notification event" });
                await expect(tile).toBeVisible();
                await expect(tile).toHaveAttribute("data-layout", "group");
                await expect(tile).toHaveAttribute("data-self", "false");
                await expect(tile).toHaveClass(/mx_EventTile_clamp/);
                await expect(tile.locator(".mx_EventTile_details")).toContainText("Bob");
                await expect(tile).toMatchScreenshot("notification-event-tile.png", {
                    css: ".mx_MessageTimestamp { visibility: hidden; }",
                });
            },
        );
    });
});
