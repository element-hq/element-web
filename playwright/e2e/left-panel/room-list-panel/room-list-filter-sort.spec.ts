/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Visibility } from "matrix-js-sdk/src/matrix";
import { type Locator, type Page } from "@playwright/test";

import { expect, test } from "../../../element-web-test";
import { SettingLevel } from "../../../../src/settings/SettingLevel";

test.describe("Room list filters and sort", () => {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "BotBob",
            autoAcceptInvites: true,
        },
        labsFlags: ["feature_new_room_list"],
    });

    function getPrimaryFilters(page: Page): Locator {
        return page.getByTestId("primary-filters");
    }

    function getRoomOptionsMenu(page: Page): Locator {
        return page.getByRole("button", { name: "Room Options" });
    }

    function getFilterExpandButton(page: Page): Locator {
        return getPrimaryFilters(page).getByRole("button", { name: "Expand filter list" });
    }

    function getFilterCollapseButton(page: Page): Locator {
        return getPrimaryFilters(page).getByRole("button", { name: "Collapse filter list" });
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

    test("Tombstoned rooms are not shown even when they receive updates", async ({ page, app, bot }) => {
        // This bug shows up with this setting turned on
        await app.settings.setValue("Spaces.allRoomsInHome", null, SettingLevel.DEVICE, true);

        /*
        We will first create a room named 'Old Room' and will invite the bot user to this room.
        We will also send a simple message in this room.
        */
        const oldRoomId = await app.client.createRoom({ name: "Old Room" });
        await app.client.inviteUser(oldRoomId, bot.credentials.userId);
        await bot.joinRoom(oldRoomId);
        const response = await app.client.sendMessage(oldRoomId, "Hello!");

        /*
        At this point, we haven't done anything interesting.
        So we expect 'Old Room' to show up in the room list.
        */
        const roomListView = getRoomList(page);
        const oldRoomTile = roomListView.getByRole("option", { name: "Open room Old Room" });
        await expect(oldRoomTile).toBeVisible();

        /*
        Now let's tombstone 'Old Room'.
        First we create a new room ('New Room') with the predecessor set to the old room..
        */
        const newRoomId = await bot.createRoom({
            name: "New Room",
            creation_content: {
                predecessor: {
                    event_id: response.event_id,
                    room_id: oldRoomId,
                },
            },
            visibility: "public" as Visibility,
        });

        /*
        Now we can send the tombstone event itself to the 'Old Room'.
        */
        await app.client.sendStateEvent(oldRoomId, "m.room.tombstone", {
            body: "This room has been replaced",
            replacement_room: newRoomId,
        });

        // Let's join the replaced room.
        await app.client.joinRoom(newRoomId);

        // We expect 'Old Room' to be hidden from the room list.
        await expect(oldRoomTile).not.toBeVisible();

        /*
        Let's say some user in the 'Old Room' changes their display name.
        This will send events to the all the rooms including 'Old Room'.
        Nevertheless, the replaced room should not be shown in the room list.
        */
        await bot.setDisplayName("MyNewName");
        await expect(oldRoomTile).not.toBeVisible();
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
            const tile = roomListView.getByRole("option", { name: "Open room room-non-fav" });
            // item may not be in the DOM using scrollListToBottom rather than scrollIntoViewIfNeeded
            await app.scrollListToBottom(roomListView);
            await tile.click();

            // Enable Favourite filter
            await getFilterExpandButton(page).click();
            const primaryFilters = getPrimaryFilters(page);
            await primaryFilters.getByRole("option", { name: "Favourite" }).click();
            await expect(tile).not.toBeVisible();

            // Ensure the room list is not scrolled
            const isScrolledDown = await page
                .getByRole("listbox", { name: "Room list", exact: true })
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

            const lowPrioId = await app.client.createRoom({ name: "Low prio room" });
            await app.client.evaluate(async (client, id) => {
                await client.setRoomTag(id, "m.lowpriority", { order: 0.5 });
            }, lowPrioId);

            await bot.createRoom({
                name: "invited room",
                invite: [user.userId],
                is_direct: true,
            });

            const mentionRoomId = await app.client.createRoom({ name: "room with mention" });
            await app.client.inviteUser(mentionRoomId, bot.credentials.userId);
            await bot.joinRoom(mentionRoomId);

            const clientBot = await bot.prepareClient();
            await clientBot.evaluate(
                async (client, { mentionRoomId, userId }) => {
                    await client.sendMessage(mentionRoomId, {
                        // @ts-ignore ignore usage of MsgType.text
                        "msgtype": "m.text",
                        "body": "User",
                        "format": "org.matrix.custom.html",
                        "formatted_body": `<a href="https://matrix.to/#/${userId}">User</a>`,
                        "m.mentions": {
                            user_ids: [userId],
                        },
                    });
                },
                { mentionRoomId, userId: user.userId },
            );
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
            await expect(roomList.getByRole("option", { name: "unread dm" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "unread room" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(4);
            await expect(primaryFilters).toMatchScreenshot("unread-primary-filters.png");

            await primaryFilters.getByRole("option", { name: "People" }).click();
            await expect(roomList.getByRole("option", { name: "unread dm" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "invited room" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(2);

            await primaryFilters.getByRole("option", { name: "Rooms" }).click();
            await expect(roomList.getByRole("option", { name: "unread room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "favourite room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "empty room" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "room with mention" })).toBeVisible();
            await expect(roomList.getByRole("option", { name: "Low prio room" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(5);

            await getFilterExpandButton(page).click();

            await primaryFilters.getByRole("option", { name: "Favourite" }).click();
            await expect(roomList.getByRole("option", { name: "favourite room" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(1);

            await primaryFilters.getByRole("option", { name: "Mentions" }).click();
            await expect(roomList.getByRole("option", { name: "room with mention" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(1);

            await primaryFilters.getByRole("option", { name: "Invites" }).click();
            await expect(roomList.getByRole("option", { name: "invited room" })).toBeVisible();
            await expect.poll(() => roomList.locator("role=option").count()).toBe(1);

            await getFilterCollapseButton(page).click();
            await expect(primaryFilters.locator("role=option").first()).toHaveText("Invites");
        });

        test(
            "unread filter should only match unread rooms that have a count",
            { tag: "@screenshot" },
            async ({ page, app, bot }) => {
                const roomListView = getRoomList(page);
                const primaryFilters = getPrimaryFilters(page);

                // Let's configure unread dm room so that we only get notification for mentions and keywords
                await app.viewRoomById(unReadDmId);
                await app.settings.openRoomSettings("Notifications");
                await page.getByText("@mentions & keywords").click();
                await app.settings.closeDialog();

                // Let's open a room other than unread room or unread dm
                await roomListView.getByRole("option", { name: "Open room favourite room" }).click();

                // Let's make the bot send a new message in both rooms
                await bot.sendMessage(unReadDmId, "Hello!");
                await bot.sendMessage(unReadRoomId, "Hello!");

                // Let's activate the unread filter now
                await primaryFilters.getByRole("option", { name: "Unread" }).click();

                // Unread filter should only show unread room and not unread dm!
                const unreadDm = roomListView.getByRole("option", { name: "Open room unread room" });
                await expect(unreadDm).toBeVisible();
                await expect(unreadDm).toMatchScreenshot("unread-dm.png");
                await expect(roomListView.getByRole("option", { name: "Open room unread dm" })).not.toBeVisible();
            },
        );

        test("should sort the room list alphabetically", async ({ page }) => {
            const roomListView = getRoomList(page);

            await getRoomOptionsMenu(page).click();
            await page.getByRole("menuitemradio", { name: "A-Z" }).click();

            await expect(roomListView.getByRole("option").first()).toHaveText(/empty room/);
        });

        test("should move room to the top on message when sorting by activity", async ({ page, bot }) => {
            const roomListView = getRoomList(page);

            await bot.sendMessage(unReadDmId, "Hello!");

            await expect(roomListView.getByRole("option").first()).toHaveText(/unread dm/);
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
                await expect(page.getByRole("navigation", { name: "Room list" })).toMatchScreenshot(
                    "room-panel-empty-room-list.png",
                );
            },
        );

        [
            { filter: "Unreads", action: "Show all chats" },
            { filter: "Mentions", action: "See all activity" },
            { filter: "Invites", action: "See all activity" },
        ].forEach(({ filter, action }) => {
            test(
                `should render the placeholder for ${filter} filter`,
                { tag: "@screenshot" },
                async ({ page, app, user }) => {
                    const primaryFilters = getPrimaryFilters(page);
                    await getFilterExpandButton(page).click();

                    await primaryFilters.getByRole("option", { name: filter }).click();

                    const emptyRoomList = getEmptyRoomList(page);
                    await expect(emptyRoomList).toMatchScreenshot(`${filter}-empty-room-list.png`);

                    await emptyRoomList.getByRole("button", { name: action }).click();
                    await expect(primaryFilters.getByRole("option", { name: filter })).not.toBeChecked();
                },
            );
        });

        ["People", "Rooms", "Favourite"].forEach((filter) => {
            test(
                `should render the placeholder for ${filter} filter`,
                { tag: "@screenshot" },
                async ({ page, app, user }) => {
                    const primaryFilters = getPrimaryFilters(page);
                    await getFilterExpandButton(page).click();

                    await primaryFilters.getByRole("option", { name: filter }).click();

                    const emptyRoomList = getEmptyRoomList(page);
                    await expect(emptyRoomList).toMatchScreenshot(`${filter}-empty-room-list.png`);
                },
            );
        });
    });
});
