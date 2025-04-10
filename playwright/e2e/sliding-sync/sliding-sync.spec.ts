/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page, type Request } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";
import type { ElementAppPage } from "../../pages/ElementAppPage";
import type { Bot } from "../../pages/bot";

const test = base.extend<{
    testRoom: { roomId: string; name: string };
    joinedBot: Bot;
}>({
    testRoom: async ({ user, app }, use) => {
        const name = "Test Room";
        const roomId = await app.client.createRoom({ name });
        await use({ roomId, name });
    },
    joinedBot: async ({ app, bot, testRoom }, use) => {
        const roomId = testRoom.roomId;
        await bot.prepareClient();
        const bobUserId = await bot.evaluate((client) => client.getUserId());
        await app.client.evaluate(
            async (client, { bobUserId, roomId }) => {
                await client.invite(roomId, bobUserId);
            },
            { bobUserId, roomId },
        );
        await bot.joinRoom(roomId);
        await use(bot);
    },
});

test.describe("Sliding Sync", () => {
    const checkOrder = async (wantOrder: string[], page: Page) => {
        await expect(page.getByRole("group", { name: "Rooms" }).locator(".mx_RoomTile_title")).toHaveText(wantOrder);
    };

    const bumpRoom = async (roomId: string, app: ElementAppPage) => {
        // Send a message into the given room, this should bump the room to the top
        console.log("sendEvent", app.client.sendEvent);
        await app.client.sendEvent(roomId, null, "m.room.message", {
            body: "Hello world",
            msgtype: "m.text",
        });
    };

    test.use({
        config: {
            features: {
                feature_simplified_sliding_sync: true,
            },
        },
    });

    // Load the user fixture for all tests
    test.beforeEach(({ user }) => {});

    test("should render the Rooms list in reverse chronological order by default and allowing sorting A-Z", async ({
        page,
        app,
        testRoom,
    }) => {
        // create rooms and check room names are correct
        for (const fruit of ["Apple", "Pineapple", "Orange"]) {
            await app.client.createRoom({ name: fruit });
            await expect(page.getByRole("treeitem", { name: fruit })).toBeVisible();
        }

        // Check count, 3 fruits + 1 testRoom = 4
        await expect(page.locator(".mx_RoomSublist_tiles").getByRole("treeitem")).toHaveCount(4);
        await checkOrder(["Orange", "Pineapple", "Apple", "Test Room"], page);

        const locator = page.getByRole("group", { name: "Rooms" }).locator(".mx_RoomSublist_headerContainer");
        await locator.hover();
        await locator.getByRole("button", { name: "List options" }).click();

        // force click as the radio button's size is zero
        await page.getByRole("menuitemradio", { name: "A-Z" }).dispatchEvent("click");
        await expect(page.locator(".mx_StyledRadioButton_checked").getByText("A-Z")).toBeVisible();

        await checkOrder(["Apple", "Orange", "Pineapple", "Test Room"], page);
    });

    test("should move rooms around as new events arrive", async ({ page, app, testRoom }) => {
        // create rooms and check room names are correct
        const roomIds: string[] = [];
        for (const fruit of ["Apple", "Pineapple", "Orange"]) {
            const id = await app.client.createRoom({ name: fruit });
            roomIds.push(id);
            await expect(page.getByRole("treeitem", { name: fruit })).toBeVisible();
        }

        // Select the Test Room
        await page.getByRole("treeitem", { name: "Test Room" }).click();
        const [apple, pineapple, orange] = roomIds;
        await checkOrder(["Orange", "Pineapple", "Apple", "Test Room"], page);
        await bumpRoom(apple, app);
        await checkOrder(["Apple", "Orange", "Pineapple", "Test Room"], page);
        await bumpRoom(orange, app);
        await checkOrder(["Orange", "Apple", "Pineapple", "Test Room"], page);
        await bumpRoom(orange, app);
        await checkOrder(["Orange", "Apple", "Pineapple", "Test Room"], page);
        await bumpRoom(pineapple, app);
        await checkOrder(["Pineapple", "Orange", "Apple", "Test Room"], page);
    });

    test("should not move the selected room: it should be sticky", async ({ page, app, testRoom }) => {
        // create rooms and check room names are correct
        const roomIds: string[] = [];
        for (const fruit of ["Apple", "Pineapple", "Orange"]) {
            const id = await app.client.createRoom({ name: fruit });
            roomIds.push(id);
            await expect(page.getByRole("treeitem", { name: fruit })).toBeVisible();
        }

        // Given a list of Orange, Pineapple, Apple - if Pineapple is active and a message is sent in Apple, the list should
        // turn into Apple, Pineapple, Orange - the index position of Pineapple never changes even though the list should technically
        // be Apple, Orange Pineapple - only when you click on a different room do things reshuffle.

        // Select the Pineapple room
        await page.getByRole("treeitem", { name: "Pineapple" }).click();
        await checkOrder(["Orange", "Pineapple", "Apple", "Test Room"], page);

        // Move Apple
        await bumpRoom(roomIds[0], app);
        await checkOrder(["Apple", "Pineapple", "Orange", "Test Room"], page);

        // Select the Test Room
        await page.getByRole("treeitem", { name: "Test Room" }).click();

        // the rooms reshuffle to match reality
        await checkOrder(["Apple", "Orange", "Pineapple", "Test Room"], page);
    });

    test.skip("should show the right unread notifications", async ({ page, user, joinedBot: bob, testRoom }) => {
        // send a message in the test room: unread notification count should increment
        await bob.sendMessage(testRoom.roomId, "Hello World");

        const treeItemLocator1 = page.getByRole("treeitem", { name: "Test Room 1 unread message." });
        await expect(treeItemLocator1.locator(".mx_NotificationBadge_count")).toHaveText("1");
        // await expect(page.locator(".mx_NotificationBadge")).not.toHaveClass("mx_NotificationBadge_highlighted");
        await expect(treeItemLocator1.locator(".mx_NotificationBadge")).not.toHaveClass(
            /mx_NotificationBadge_highlighted/,
        );

        // send an @mention: highlight count (red) should be 2.
        await bob.sendMessage(testRoom.roomId, `Hello ${user.displayName}`);
        const treeItemLocator2 = page.getByRole("treeitem", {
            name: "Test Room 2 unread messages including mentions.",
        });
        await expect(treeItemLocator2.locator(".mx_NotificationBadge_count")).toHaveText("2");
        await expect(treeItemLocator2.locator(".mx_NotificationBadge")).toHaveClass(/mx_NotificationBadge_highlighted/);

        // click on the room, the notif counts should disappear
        await page.getByRole("treeitem", { name: "Test Room 2 unread messages including mentions." }).click();
        await expect(
            page.getByRole("treeitem", { name: "Test Room" }).locator("mx_NotificationBadge_count"),
        ).not.toBeAttached();
    });

    test("should show unread indicators", async ({ page, app, joinedBot: bot, testRoom }) => {
        // create a new room so we know when the message has been received as it'll re-shuffle the room list
        await app.client.createRoom({ name: "Dummy" });

        await checkOrder(["Dummy", "Test Room"], page);

        await bot.sendMessage(testRoom.roomId, "Do you read me?");

        // wait for this message to arrive, tell by the room list resorting
        await checkOrder(["Test Room", "Dummy"], page);

        await expect(page.getByRole("treeitem", { name: "Test Room" }).locator(".mx_NotificationBadge")).toBeAttached();
    });

    test("should update user settings promptly", async ({ page, app }) => {
        await app.settings.openUserSettings("Preferences");
        const locator = page.locator(".mx_SettingsFlag").filter({ hasText: "Show timestamps in 12 hour format" });
        await expect(locator).toBeVisible();
        await expect(locator.locator(".mx_ToggleSwitch_on")).not.toBeAttached();
        await locator.locator(".mx_ToggleSwitch_ball").click();
        await expect(locator.locator(".mx_ToggleSwitch_on")).toBeAttached();
    });

    test("should send subscribe_rooms on room switch if room not already subscribed", async ({ page, app }) => {
        // create rooms and check room names are correct
        const roomIds: string[] = [];
        for (const fruit of ["Apple", "Pineapple", "Orange"]) {
            const id = await app.client.createRoom({ name: fruit });
            roomIds.push(id);
            await expect(page.getByRole("treeitem", { name: fruit })).toBeVisible();
        }
        const [roomAId, roomPId] = roomIds;

        const matchRoomSubRequest = (subRoomId: string) => (request: Request) => {
            if (!request.url().includes("/sync")) return false;
            const body = request.postDataJSON();
            return body.room_subscriptions?.[subRoomId];
        };

        // Select the Test Room and wait for playwright to get the request
        const [request] = await Promise.all([
            page.waitForRequest(matchRoomSubRequest(roomAId)),
            page.getByRole("treeitem", { name: "Apple", exact: true }).click(),
        ]);
        const roomSubscriptions = request.postDataJSON().room_subscriptions;
        expect(roomSubscriptions, "room_subscriptions is object").toBeDefined();

        // Switch to another room and wait for playwright to get the request
        await Promise.all([
            page.waitForRequest(matchRoomSubRequest(roomPId)),
            page.getByRole("treeitem", { name: "Pineapple", exact: true }).click(),
        ]);
    });

    test("should show and be able to accept/reject/rescind invites", async ({
        page,
        app,
        joinedBot: bot,
        testRoom,
    }) => {
        const clientUserId = await app.client.evaluate((client) => client.getUserId());

        // invite bot into 3 rooms:
        // - roomJoin: will join this room
        // - roomReject: will reject the invite
        // - roomRescind: will make Bob rescind the invite
        const roomNames = ["Room to Join", "Room to Reject", "Room to Rescind"];
        const roomRescind = await bot.evaluate(
            async (client, { roomNames, clientUserId }) => {
                const rooms = await Promise.all(roomNames.map((name) => client.createRoom({ name })));
                await Promise.all(rooms.map((room) => client.invite(room.room_id, clientUserId)));
                return rooms[2].room_id;
            },
            { roomNames, clientUserId },
        );

        await expect(
            page.getByRole("group", { name: "Invites" }).locator(".mx_RoomSublist_tiles").getByRole("treeitem"),
        ).toHaveCount(3);

        // Select the room to join
        await page.getByRole("treeitem", { name: "Room to Join" }).click();

        // Accept the invite
        await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

        await checkOrder(["Room to Join", "Test Room"], page);

        // Select the room to reject
        await page.getByRole("treeitem", { name: "Room to Reject" }).click();

        // Decline the invite
        await page.locator(".mx_RoomView").getByRole("button", { name: "Decline", exact: true }).click();

        await expect(
            page.getByRole("group", { name: "Invites" }).locator(".mx_RoomSublist_tiles").getByRole("treeitem"),
        ).toHaveCount(2);

        // check the lists are correct
        await checkOrder(["Room to Join", "Test Room"], page);

        const titleLocator = page.getByRole("group", { name: "Invites" }).locator(".mx_RoomTile_title");
        await expect(titleLocator).toHaveCount(1);
        await expect(titleLocator).toHaveText("Room to Rescind");

        // now rescind the invite
        await bot.evaluate(
            async (client, { roomRescind, clientUserId }) => {
                await client.kick(roomRescind, clientUserId);
            },
            { roomRescind, clientUserId },
        );

        // Wait for the rescind to take effect and check the joined list once more
        await expect(
            page.getByRole("group", { name: "Rooms" }).locator(".mx_RoomSublist_tiles").getByRole("treeitem"),
        ).toHaveCount(2);

        await checkOrder(["Room to Join", "Test Room"], page);
    });

    test("should show a favourite DM only in the favourite sublist", async ({ page, app }) => {
        const roomId = await app.client.createRoom({
            name: "Favourite DM",
            is_direct: true,
        });
        await app.client.evaluate(async (client, roomId) => {
            await client.setRoomTag(roomId, "m.favourite", { order: 0.5 });
        }, roomId);
        await expect(page.getByRole("group", { name: "Favourites" }).getByText("Favourite DM")).toBeVisible();
        await expect(page.getByRole("group", { name: "People" }).getByText("Favourite DM")).not.toBeAttached();
    });

    // Regression test for a bug in SS mode, but would be useful to have in non-SS mode too.
    // This ensures we are setting RoomViewStore state correctly.
    test("should clear the reply to field when swapping rooms", async ({ page, app, testRoom }) => {
        await app.client.createRoom({ name: "Other Room" });
        await expect(page.getByRole("treeitem", { name: "Other Room" })).toBeVisible();
        await app.client.sendMessage(testRoom.roomId, "Hello world");

        // select the room
        await page.getByRole("treeitem", { name: "Test Room" }).click();

        await expect(page.locator(".mx_ReplyPreview")).not.toBeAttached();

        // click reply-to on the Hello World message
        const locator = page.locator(".mx_EventTile_last");
        await locator.getByText("Hello world").hover();
        await locator.getByRole("button", { name: "Reply", exact: true }).click({});

        // check it's visible
        await expect(page.locator(".mx_ReplyPreview")).toBeVisible();

        // now click Other Room
        await page.getByRole("treeitem", { name: "Other Room" }).click();

        // ensure the reply-to disappears
        await expect(page.locator(".mx_ReplyPreview")).not.toBeAttached();

        // click back
        await page.getByRole("treeitem", { name: "Test Room" }).click();

        // ensure the reply-to reappears
        await expect(page.locator(".mx_ReplyPreview")).toBeVisible();
    });

    // Regression test for https://github.com/vector-im/element-web/issues/21462
    test("should not cancel replies when permalinks are clicked", async ({ page, app, testRoom }) => {
        // we require a first message as you cannot click the permalink text with the avatar in the way
        await app.client.sendMessage(testRoom.roomId, "First message");
        await app.client.sendMessage(testRoom.roomId, "Permalink me");
        await app.client.sendMessage(testRoom.roomId, "Reply to me");

        // select the room
        await page.getByRole("treeitem", { name: "Test Room" }).click();
        await expect(page.locator(".mx_ReplyPreview")).not.toBeAttached();

        // click reply-to on the Reply to me message
        const locator = page.locator(".mx_EventTile").last();
        await locator.getByText("Reply to me").hover();
        await locator.getByRole("button", { name: "Reply", exact: true }).click();

        // check it's visible
        await expect(page.locator(".mx_ReplyPreview")).toBeVisible();

        // now click on the permalink for Permalink me
        await page.locator(".mx_EventTile").filter({ hasText: "Permalink me" }).locator("a").dispatchEvent("click");

        // make sure it is now selected with the little green |
        await expect(page.locator(".mx_EventTile_selected").filter({ hasText: "Permalink me" })).toBeVisible();

        // ensure the reply-to does not disappear
        await expect(page.locator(".mx_ReplyPreview")).toBeVisible();
    });
});
