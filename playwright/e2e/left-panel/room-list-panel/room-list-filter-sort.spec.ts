/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, test } from "../../../element-web-test";
import type { Page } from "@playwright/test";

test.describe("Room list filters and sort", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
        labsFlags: ["feature_new_room_list"],
    });

    function getPrimaryFilters(page: Page) {
        return page.getByRole("listbox", { name: "Room list filters" });
    }

    /**
     * Get the room list
     * @param page
     */
    function getRoomList(page: Page) {
        return page.getByTestId("room-list");
    }

    test.beforeEach(async ({ page, app, bot, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
    });

    test.describe("Scroll behaviour", () => {
        test("should scroll to the top of list when filter is applied and active room is not in filtered list", async ({
            page,
            app,
        }) => {
            const createFavouriteRoom = async (name: string) => {
                const id = await app.client.createRoom({
                    name,
                });
                await app.client.evaluate(async (client, favouriteId) => {
                    await client.setRoomTag(favouriteId, "m.favourite", { order: 0.5 });
                }, id);
            };

            // Create 5 favourite rooms
            let i = 0;
            for (; i < 5; i++) {
                await createFavouriteRoom(`room${i}-fav`);
            }

            // Create a non-favourite room
            await app.client.createRoom({ name: `room-non-fav` });

            // Create rest of the favourite rooms
            for (; i < 20; i++) {
                await createFavouriteRoom(`room${i}-fav`);
            }

            // Open the non-favourite room
            const roomListView = getRoomList(page);
            const tile = roomListView.getByRole("gridcell", { name: "Open room room-non-fav" });
            await tile.scrollIntoViewIfNeeded();
            await tile.click();

            // Enable Favourite filter
            const primaryFilters = getPrimaryFilters(page);
            await primaryFilters.getByRole("option", { name: "Favourite" }).click();
            await expect(tile).not.toBeVisible();

            // Ensure the room list is not scrolled
            const isScrolledDown = await page
                .getByRole("grid", { name: "Room list" })
                .evaluate((e) => e.scrollTop !== 0);
            expect(isScrolledDown).toStrictEqual(false);
        });
    });

    test.describe("Room list", () => {
        let unReadDmId: string | undefined;
        let unReadRoomId: string | undefined;

        test.beforeEach(async ({ page, app, bot, user }) => {
            await app.client.createRoom({ name: "empty room" });

            unReadDmId = await bot.createRoom({
                name: "unread dm",
                invite: [user.userId],
                is_direct: true,
            });
            await app.client.joinRoom(unReadDmId);
            await bot.sendMessage(unReadDmId, "I am a robot. Beep.");

            unReadRoomId = await app.client.createRoom({ name: "unread room" });
            await app.client.inviteUser(unReadRoomId, bot.credentials.userId);
            await bot.joinRoom(unReadRoomId);
            await bot.sendMessage(unReadRoomId, "I am a robot. Beep.");

            const favouriteId = await app.client.createRoom({ name: "favourite room" });
            await app.client.evaluate(async (client, favouriteId) => {
                await client.setRoomTag(favouriteId, "m.favourite", { order: 0.5 });
            }, favouriteId);
        });

        test("should filter the list (with primary filters)", { tag: "@screenshot" }, async ({ page, app, user }) => {
            const roomList = getRoomList(page);
            const primaryFilters = getPrimaryFilters(page);

            const allFilters = await primaryFilters.locator("option").all();
            for (const filter of allFilters) {
                expect(await filter.getAttribute("aria-selected")).toBe("false");
            }
            await expect(primaryFilters).toMatchScreenshot("unselected-primary-filters.png");

            await primaryFilters.getByRole("option", { name: "Unread" }).click();
            // only one room should be visible
            await expect(roomList.getByRole("gridcell", { name: "unread dm" })).toBeVisible();
            await expect(roomList.getByRole("gridcell", { name: "unread room" })).toBeVisible();
            expect(await roomList.locator("role=gridcell").count()).toBe(2);
            await expect(primaryFilters).toMatchScreenshot("unread-primary-filters.png");

            await primaryFilters.getByRole("option", { name: "Favourite" }).click();
            await expect(roomList.getByRole("gridcell", { name: "favourite room" })).toBeVisible();
            expect(await roomList.locator("role=gridcell").count()).toBe(1);

            await primaryFilters.getByRole("option", { name: "People" }).click();
            await expect(roomList.getByRole("gridcell", { name: "unread dm" })).toBeVisible();
            expect(await roomList.locator("role=gridcell").count()).toBe(1);

            await primaryFilters.getByRole("option", { name: "Rooms" }).click();
            await expect(roomList.getByRole("gridcell", { name: "unread room" })).toBeVisible();
            await expect(roomList.getByRole("gridcell", { name: "favourite room" })).toBeVisible();
            await expect(roomList.getByRole("gridcell", { name: "empty room" })).toBeVisible();
            expect(await roomList.locator("role=gridcell").count()).toBe(3);
        });

        test("unread filter should only match unread rooms that have a count", async ({ page, app, bot }) => {
            const roomListView = getRoomList(page);

            // Let's configure unread dm room so that we only get notification for mentions and keywords
            await app.viewRoomById(unReadDmId);
            await app.settings.openRoomSettings("Notifications");
            await page.getByText("@mentions & keywords").click();
            await app.settings.closeDialog();

            // Let's open a room other than unread room or unread dm
            await roomListView.getByRole("gridcell", { name: "Open room favourite room" }).click();

            // Let's make the bot send a new message in both rooms
            await bot.sendMessage(unReadDmId, "Hello!");
            await bot.sendMessage(unReadRoomId, "Hello!");

            // Let's activate the unread filter now
            await page.getByRole("option", { name: "Unread" }).click();

            // Unread filter should only show unread room and not unread dm!
            await expect(roomListView.getByRole("gridcell", { name: "Open room unread room" })).toBeVisible();
            await expect(roomListView.getByRole("gridcell", { name: "Open room unread dm" })).not.toBeVisible();
        });
    });

    test.describe("Empty room list", () => {
        /**
         * Get the empty state
         * @param page
         */
        function getEmptyRoomList(page: Page) {
            return page.getByTestId("empty-room-list");
        }

        test(
            "should render the default placeholder when there is no filter",
            { tag: "@screenshot" },
            async ({ page, app, user }) => {
                const emptyRoomList = getEmptyRoomList(page);
                await expect(emptyRoomList).toMatchScreenshot("default-empty-room-list.png");
                await expect(page.getByTestId("room-list-panel")).toMatchScreenshot("room-panel-empty-room-list.png");
            },
        );

        test("should render the placeholder for unread filter", { tag: "@screenshot" }, async ({ page, app, user }) => {
            const primaryFilters = getPrimaryFilters(page);
            await primaryFilters.getByRole("option", { name: "Unread" }).click();

            const emptyRoomList = getEmptyRoomList(page);
            await expect(emptyRoomList).toMatchScreenshot("unread-empty-room-list.png");

            await emptyRoomList.getByRole("button", { name: "show all chats" }).click();
            await expect(primaryFilters.getByRole("option", { name: "Unread" })).not.toBeChecked();
        });

        ["People", "Rooms", "Favourite"].forEach((filter) => {
            test(
                `should render the placeholder for ${filter} filter`,
                { tag: "@screenshot" },
                async ({ page, app, user }) => {
                    const primaryFilters = getPrimaryFilters(page);
                    await primaryFilters.getByRole("option", { name: filter }).click();

                    const emptyRoomList = getEmptyRoomList(page);
                    await expect(emptyRoomList).toMatchScreenshot(`${filter}-empty-room-list.png`);
                },
            );
        });
    });
});
