/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";

/**
 * Tests for the timeline behind the `feature_new_timeline` Labs flag.
 */

/** px from the live end still counted as being there; matches the view's own threshold. */
const AT_END_THRESHOLD_PX = 4;

/** The row the timeline draws for an event. Rows are keyed by event id. */
const timelineRow = (page: Page, eventId: string): Locator =>
    page.locator(`.mx_TimelineView_tile[data-key="${eventId}"]`);

/** The element that scrolls. */
const timelineScroller = (page: Page): Locator => page.getByTestId("timeline-scroller");

/** Waits for the timeline to come to rest at the live end. */
const expectAtLiveEnd = async (page: Page): Promise<void> => {
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const el = document.querySelector('[data-testid="timeline-scroller"]');
                    if (!(el instanceof HTMLElement)) return Number.MAX_SAFE_INTEGER;
                    return el.scrollHeight - el.clientHeight - el.scrollTop;
                }),
            { timeout: 15_000 },
        )
        .toBeLessThanOrEqual(AT_END_THRESHOLD_PX);
};

test.describe("New timeline", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_new_timeline"],
    });

    test("replaces the old timeline and draws the room's messages", async ({ page, app, user }) => {
        const roomId = await app.client.createRoom({ name: "New timeline" });
        const first = await app.client.sendMessage(roomId, "Hello from Alice");
        const second = await app.client.sendMessage(roomId, "And a second message");

        await app.viewRoomById(roomId);

        await expect(page.locator(".mx_NewTimelinePanel")).toBeVisible();
        // The flag replaces the panel rather than adding to it, so the old timeline's
        // scroll container should not be in the room at all.
        await expect(page.locator(".mx_RoomView_timeline .mx_ScrollPanel")).toHaveCount(0);

        // Looking the rows up by event id also checks that the view model put each
        // message in its own row, rather than just that the text is somewhere on screen.
        await expect(timelineRow(page, first.event_id)).toContainText("Hello from Alice");
        await expect(timelineRow(page, second.event_id)).toContainText("And a second message");
    });

    test("puts a message sent from the composer at the live end", async ({ page, app, user }) => {
        const roomId = await app.client.createRoom({ name: "Composer send" });
        // Comfortably more than fills the panel, so the timeline has to scroll down to
        // the new message rather than it happening to fit already.
        for (let i = 1; i <= 20; i++) {
            await app.client.sendMessage(roomId, `Earlier message ${i}. ${"Padding. ".repeat(30)}`);
        }

        await app.viewRoomById(roomId);
        await expect(page.locator(".mx_NewTimelinePanel")).toBeVisible();

        const composer = app.getComposerField();
        await composer.fill("Sent from the composer");
        await composer.press("Enter");

        // The message the composer sent is drawn in the timeline.
        await expect(page.locator(".mx_TimelineView_tile", { hasText: "Sent from the composer" })).toHaveCount(1);
    });

    test("scrolls back to the live end from the jump-to-bottom button", async ({ page, app, user }) => {
        const roomId = await app.client.createRoom({ name: "Jump to bottom" });
        // Enough to make the timeline several screens tall, so scrolling up leaves the
        // live end well behind.
        for (let i = 1; i <= 20; i++) {
            await app.client.sendMessage(roomId, `Message ${i}. ${"Padding. ".repeat(30)}`);
        }
        const newest = await app.client.sendMessage(roomId, "The newest message");

        await app.viewRoomById(roomId);
        await expect(timelineRow(page, newest.event_id)).toHaveCount(1);

        await timelineScroller(page).hover();
        await page.mouse.wheel(0, -3000);

        const jumpToBottom = page.getByRole("button", { name: "Scroll to most recent messages" });
        await expect(jumpToBottom).toBeVisible();
        await jumpToBottom.click();

        await expectAtLiveEnd(page);
        await expect(timelineRow(page, newest.event_id)).toHaveCount(1);
        // Back at the live end, so the button has nothing left to do.
        await expect(jumpToBottom).not.toBeVisible();
    });

    test("loads older history when the reader scrolls to the top", async ({ page, app, user }) => {
        // Seeding this many messages takes a while.
        test.slow();

        const roomId = await app.client.createRoom({ name: "Older history" });
        const oldest = await app.client.sendMessage(roomId, "The very first message");
        // More messages than the timeline loads up front, so reaching the first one
        // needs a request to the server rather than events the client already holds.
        for (let i = 1; i <= 120; i++) {
            await app.client.sendMessage(roomId, `Filler ${i}`);
        }

        await app.viewRoomById(roomId);
        await expect(page.locator(".mx_NewTimelinePanel")).toBeVisible();
        // Nothing can put this row on screen except a fetch, so it stays absent until one happens.
        await expect(timelineRow(page, oldest.event_id)).toHaveCount(0);

        await timelineScroller(page).hover();
        // Each scroll that reaches the top asks for one more batch of history, so keep
        // scrolling up until the first message arrives.
        await expect
            .poll(
                async () => {
                    await page.mouse.wheel(0, -2000);
                    return timelineRow(page, oldest.event_id).count();
                },
                { timeout: 30_000, intervals: [250] },
            )
            .toBeGreaterThan(0);

        await expect(timelineRow(page, oldest.event_id)).toContainText("The very first message");
    });
});
