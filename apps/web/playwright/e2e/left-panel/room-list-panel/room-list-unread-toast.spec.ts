/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";
import { rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../../element-web-test";
import { type ElementAppPage } from "../../../pages/ElementAppPage";
import { getRoomList, getRoomOptionsMenu, getSectionHeader } from "./utils";

/**
 * The unread-activity toast ("Unread messages") appears at the bottom of the room list when a room with a
 * notification count (the green decoration) is scrolled below the visible area. Clicking it scrolls that
 * room into view. Rooms with only an unread-activity dot (white/black) must not trigger it.
 */
test.describe("Room list unread activity toast", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
    });

    const getToast = (page: Page) => page.getByRole("button", { name: "Unread messages" });

    /**
     * Create `count` filler rooms whose names sort alphabetically before any room named "zzz …",
     * so that under A-Z sorting they fill the top of the list and push the "zzz …" room below the fold.
     */
    async function createFillerRooms(app: ElementAppPage, count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            await app.client.createRoom({ name: `room ${String(i).padStart(2, "0")}` });
        }
    }

    /** Switch the room list to alphabetical sorting so room positions are deterministic. */
    async function sortAlphabetically(page: Page): Promise<void> {
        await getRoomOptionsMenu(page).click();
        await page.getByRole("menuitemradio", { name: "A-Z" }).click();
    }

    test.describe("flat list", () => {
        test.beforeEach(async ({ page, app, user }) => {
            // Toasts are displayed above the room list; dismiss the unrelated ones.
            await rejectToast(page, "Verify this device");
            await rejectToast(page, "Notifications");
            // Focus the user menu so room rows are not decorated by hover.
            await page.getByRole("button", { name: "User menu" }).focus();
        });

        test("shows a toast for a notifying room below the fold and scrolls to it on click", async ({
            page,
            app,
            bot,
        }) => {
            const roomList = getRoomList(page);

            // A room with a real notification count, named so it sorts to the very bottom under A-Z.
            const targetId = await app.client.createRoom({ name: "zzz unread room" });
            await app.client.inviteUser(targetId, bot.credentials.userId);
            await bot.joinRoom(targetId);

            // Enough filler rooms to push the target well below the visible area.
            await createFillerRooms(app, 20);

            await sortAlphabetically(page);

            // The bot notifies the target room, producing a green notification count.
            await bot.sendMessage(targetId, "Hello from the bottom!");

            const targetRow = roomList.getByRole("option", { name: "Open room zzz unread room" });

            // The toast appears because the notifying room is below the fold, and the room itself is offscreen.
            await expect(getToast(page)).toBeVisible();
            await expect(targetRow).not.toBeInViewport();

            // Clicking the toast scrolls the notifying room into view…
            await getToast(page).click();
            await expect(targetRow).toBeInViewport();

            // …and the toast goes away once there is nothing left unread below the fold.
            await expect(getToast(page)).not.toBeVisible();
        });

        test("does not show a toast when the only unread room below the fold has an activity dot", async ({
            page,
            app,
            bot,
        }) => {
            const roomList = getRoomList(page);

            // Another room to park on, so the activity room stays unread (focused rooms are marked read).
            const otherRoomId = await app.client.createRoom({ name: "aaa other room" });

            // The target's unread state will only ever be an activity dot, never a notification count: set it
            // to "@mentions & keywords" so a plain (non-mention) message produces activity rather than a count.
            const targetId = await app.client.createRoom({ name: "zzz activity room" });
            await app.client.inviteUser(targetId, bot.credentials.userId);
            await bot.joinRoom(targetId);

            await app.viewRoomById(targetId);
            await app.settings.openRoomSettings("Notifications");
            await page.getByText("@mentions and replies only").click();
            await app.settings.closeDialog();

            // Enable showing activity (dots) in the room list, so the activity dot is actually rendered.
            await app.settings.openUserSettings("Notifications");
            await page
                .getByRole("switch", { name: "Show all activity in the room list (dots or number of unread messages)" })
                .check();
            await app.settings.closeDialog();

            // Park on the other room so the target stays unread, then send a plain (non-mention) message.
            await app.viewRoomById(otherRoomId);
            await bot.sendMessage(targetId, "just activity, no mention");

            // The target shows an unread-activity dot: a decoration with no count (no digits).
            const targetRow = roomList.getByRole("option", { name: "Open room zzz activity room" });
            const decoration = targetRow.getByTestId("notification-decoration");
            await expect(decoration).toBeVisible();
            await expect(decoration).not.toHaveText(/\d/);

            // Push the activity-dot room below the fold with filler rooms and A-Z sorting.
            await createFillerRooms(app, 20);
            await sortAlphabetically(page);

            // The list has settled (a top filler room is visible) but the activity dot must not raise the toast.
            await expect(roomList.getByRole("option", { name: "Open room room 00" })).toBeVisible();
            await expect(targetRow).not.toBeInViewport();
            await expect(getToast(page)).not.toBeVisible();
        });
    });

    test.describe("sections", () => {
        test.beforeEach(async ({ page, app, user }) => {
            await rejectToast(page, "Verify this device");
            await rejectToast(page, "Notifications");
            await page.getByRole("button", { name: "User menu" }).focus();
        });

        test("shows a toast for a collapsed section that hides a notifying room", async ({ page, app, bot }) => {
            const roomList = getRoomList(page);

            // A regular (Chats) room with a notification count.
            const notifyId = await app.client.createRoom({ name: "chats notify room" });
            await app.client.inviteUser(notifyId, bot.credentials.userId);
            await bot.joinRoom(notifyId);

            // A favourite room so the list renders in section mode from the start.
            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, roomId) => {
                await client.setRoomTag(roomId, "m.favourite");
            }, favouriteId);

            const chatsHeader = getSectionHeader(page, "Chats");
            await expect(chatsHeader).toBeVisible();

            // Notify the Chats room and collapse the section while its header is still on screen.
            await bot.sendMessage(notifyId, "Hidden in a collapsed section");
            await expect(
                roomList
                    .getByRole("row", { name: "Open room chats notify room" })
                    .getByTestId("notification-decoration"),
            ).toBeVisible();
            await chatsHeader.click();
            await expect(chatsHeader).toHaveAttribute("aria-expanded", "false");

            // Grow the Favourites section until the collapsed Chats header is pushed below the fold.
            for (let i = 0; i < 20; i++) {
                const id = await app.client.createRoom({ name: `favourite ${String(i).padStart(2, "0")}` });
                await app.client.evaluate(async (client, roomId) => {
                    await client.setRoomTag(roomId, "m.favourite");
                }, id);
            }

            // Wait until the collapsed Chats header has been pushed offscreen (all favourites synced).
            await expect(chatsHeader).not.toBeInViewport();

            // The collapsed Chats header is offscreen, but its hidden notification raises the toast.
            await expect(getToast(page)).toBeVisible();

            // Clicking the toast scrolls the collapsed section header into view.
            await getToast(page).click();
            await expect(chatsHeader).toBeInViewport();
        });
    });
});
