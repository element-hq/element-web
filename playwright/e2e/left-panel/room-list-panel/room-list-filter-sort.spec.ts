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

    test.beforeEach(async ({ page, app, bot, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
    });

    test.describe("Room list", () => {
        /**
         * Get the room list
         * @param page
         */
        function getRoomList(page: Page) {
            return page.getByTestId("room-list");
        }

        test.beforeEach(async ({ page, app, bot, user }) => {
            await app.client.createRoom({ name: "empty room" });

            const unReadDmId = await bot.createRoom({
                name: "unread dm",
                invite: [user.userId],
                is_direct: true,
            });
            await bot.sendMessage(unReadDmId, "I am a robot. Beep.");

            const unReadRoomId = await app.client.createRoom({ name: "unread room" });
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
