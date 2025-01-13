/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { AccountDataEvents, Visibility } from "matrix-js-sdk/src/matrix";
import { test as base, expect } from "../../element-web-test";
import { Filter } from "../../pages/Spotlight";
import { Bot } from "../../pages/bot";
import type { Locator, Page } from "@playwright/test";
import type { ElementAppPage } from "../../pages/ElementAppPage";
import { isDendrite } from "../../plugins/homeserver/dendrite";

function roomHeaderName(page: Page): Locator {
    return page.locator(".mx_RoomHeader_heading");
}

async function startDM(app: ElementAppPage, page: Page, name: string): Promise<void> {
    const spotlight = await app.openSpotlight();
    await spotlight.filter(Filter.People);
    await spotlight.search(name);
    await page.waitForTimeout(1000); // wait for the dialog code to settle
    await expect(spotlight.dialog.locator(".mx_Spinner")).not.toBeAttached();
    const result = spotlight.results;
    await expect(result).toHaveCount(1);
    await expect(result.first()).toContainText(name);
    await result.first().click();

    // send first message to start DM
    const locator = page.getByRole("textbox", { name: "Send a message…" });
    await expect(locator).toBeFocused();
    await locator.fill("Hey!");
    await locator.press("Enter");
    // The DM room is created at this point, this can take a little bit of time
    await expect(page.locator(".mx_EventTile_body").getByText("Hey!")).toBeAttached({ timeout: 3000 });
    await expect(page.getByRole("group", { name: "People" }).getByText(name)).toBeAttached();
}

type RoomRef = { name: string; roomId: string };
const test = base.extend<{
    bot1: Bot;
    bot2: Bot;
    room1: RoomRef;
    room2: RoomRef;
    room3: RoomRef;
}>({
    bot1: async ({ page, homeserver }, use, testInfo) => {
        const bot = new Bot(page, homeserver, { displayName: `BotBob_${testInfo.testId}`, autoAcceptInvites: true });
        await use(bot);
    },
    bot2: async ({ page, homeserver }, use, testInfo) => {
        const bot = new Bot(page, homeserver, { displayName: `ByteBot_${testInfo.testId}`, autoAcceptInvites: true });
        await use(bot);
    },
    room1: async ({ app }, use) => {
        const name = "247";
        const roomId = await app.client.createRoom({ name, visibility: "public" as Visibility });
        await use({ name, roomId });
    },
    room2: async ({ bot2 }, use) => {
        const name = "Lounge";
        const roomId = await bot2.createRoom({ name, visibility: "public" as Visibility });
        await use({ name, roomId });
    },
    room3: async ({ bot2 }, use) => {
        const name = "Public";
        const roomId = await bot2.createRoom({
            name,
            visibility: "public" as Visibility,
            initial_state: [
                {
                    type: "m.room.history_visibility",
                    state_key: "",
                    content: {
                        history_visibility: "world_readable",
                    },
                },
            ],
        });
        await use({ name, roomId });
    },
    context: async ({ context, homeserver }, use) => {
        // Restart the homeserver to wipe its in-memory db so we can reuse the same user ID without cross-signing prompts
        await homeserver.restart();
        await use(context);
    },
});

test.describe("Spotlight", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3488");
    test.use({
        displayName: "Jim",
    });

    test.beforeEach(async ({ page, user, bot1, bot2, room1, room2, room3 }) => {
        await bot1.joinRoom(room1.roomId);
        await bot2.inviteUser(room2.roomId, bot1.credentials.userId);
        await bot2.inviteUser(room3.roomId, bot1.credentials.userId);

        await page.goto(`/#/room/${room1.roomId}`);
        await expect(page.locator(".mx_RoomSublist_skeletonUI")).not.toBeAttached();
    });

    test("should be able to add and remove filters via keyboard", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(1000); // wait for the dialog to settle, otherwise our keypresses might race with an update

        // initially, public spaces should be highlighted (because there are no other suggestions)
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_explorePublicSpaces")).toHaveAttribute(
            "aria-selected",
            "true",
        );

        // hitting enter should enable the public rooms filter
        await spotlight.searchBox.press("Enter");
        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_filter")).toHaveText("Public spaces");
        await spotlight.searchBox.press("Backspace");
        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_filter")).not.toBeAttached();
        await page.waitForTimeout(200); // Again, wait to settle so keypresses arrive correctly

        await spotlight.searchBox.press("ArrowDown");
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_explorePublicRooms")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await spotlight.searchBox.press("Enter");
        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_filter")).toHaveText("Public rooms");
        await spotlight.searchBox.press("Backspace");
        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_filter")).not.toBeAttached();
    });

    test("should find joined rooms", async ({ page, app, room1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.search(room1.name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room1.name);
        await resultLocator.first().click();
        await expect(page).toHaveURL(new RegExp(`#/room/${room1.roomId}`));
        await expect(roomHeaderName(page)).toContainText(room1.name);
    });

    test("should find known public rooms", async ({ page, app, room1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room1.name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room1.name);
        await expect(resultLocator.first()).toContainText("View");
        await resultLocator.first().click();
        await expect(page).toHaveURL(new RegExp(`#/room/${room1.roomId}`));
        await expect(roomHeaderName(page)).toContainText(room1.name);
    });

    test("should find unknown public rooms", async ({ page, app, room2 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room2.name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room2.name);
        await expect(resultLocator.first()).toContainText("Join");
        await resultLocator.first().click();
        await expect(page).toHaveURL(new RegExp(`#/room/${room2.roomId}`));
        await expect(page.locator(".mx_RoomView_MessageList")).toHaveCount(1);
        await expect(roomHeaderName(page)).toContainText(room2.name);
    });

    test("should find unknown public world readable rooms", async ({ page, app, room3 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room3.name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room3.name);
        await expect(resultLocator.first()).toContainText("View");
        await resultLocator.first().click();
        await expect(page).toHaveURL(new RegExp(`#/room/${room3.roomId}`));
        await page.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomHeaderName(page)).toHaveText(room3.name);
    });

    // TODO: We currently can’t test finding rooms on other homeservers/other protocols
    // We obviously don’t have federation or bridges in local e2e tests
    test.skip("should find unknown public rooms on other homeservers", async ({ page, app, room3 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room3.name);
        await page.locator("[aria-haspopup=true][role=button]").click();

        await page
            .locator(".mx_GenericDropdownMenu_Option--header")
            .filter({ hasText: "matrix.org" })
            .locator("..")
            .locator("[role=menuitemradio]")
            .click();
        await page.waitForTimeout(3_600_000);

        await page.waitForTimeout(500); // wait for the dialog to settle

        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room3.name);
        await expect(resultLocator.first()).toContainText(room3.roomId);
    });

    test("should find known people", async ({ page, app, bot1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1.credentials.displayName);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot1.credentials.displayName);
        await resultLocator.first().click();
        await expect(roomHeaderName(page)).toHaveText(bot1.credentials.displayName);
    });

    /**
     * Search sends the correct query to Synapse.
     * Synapse doesn't return the user in the result list.
     * Waiting for the profile to be available via APIs before the tests didn't help.
     *
     * https://github.com/matrix-org/synapse/issues/16472
     */
    test("should find unknown people", async ({ page, app, bot2 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2.credentials.displayName);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2.credentials.displayName);
        await resultLocator.first().click();
        await expect(roomHeaderName(page)).toHaveText(bot2.credentials.displayName);
    });

    test("should find group DMs by usernames or user ids", async ({ page, app, bot1, bot2, room1 }) => {
        // First we want to share a room with both bots to ensure we’ve got their usernames cached
        await app.client.inviteUser(room1.roomId, bot2.credentials.userId);

        // Starting a DM with ByteBot (will be turned into a group dm later)
        let spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2.credentials.displayName);
        let resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2.credentials.displayName);
        await resultLocator.first().click();

        // Send first message to actually start DM
        await expect(roomHeaderName(page)).toHaveText(bot2.credentials.displayName);
        const locator = page.getByRole("textbox", { name: "Send a message…" });
        await locator.fill("Hey!");
        await locator.press("Enter");

        // Assert DM exists by checking for the first message and the room being in the room list
        await expect(page.locator(".mx_EventTile_body").filter({ hasText: "Hey!" })).toBeAttached({ timeout: 3000 });
        await expect(page.getByRole("group", { name: "People" })).toContainText(bot2.credentials.displayName);

        // Invite BotBob into existing DM with ByteBot
        const dmRooms = await app.client.evaluate((client, userId) => {
            const map = client
                .getAccountData("m.direct" as keyof AccountDataEvents)
                ?.getContent<Record<string, string[]>>();
            return map[userId] ?? [];
        }, bot2.credentials.userId);
        expect(dmRooms).toHaveLength(1);
        const groupDmName = await app.client.evaluate((client, id) => client.getRoom(id).name, dmRooms[0]);
        await app.client.inviteUser(dmRooms[0], bot1.credentials.userId);
        await expect(roomHeaderName(page).first()).toContainText(groupDmName);
        await expect(page.getByRole("group", { name: "People" }).first()).toContainText(groupDmName);

        // Search for BotBob by id, should return group DM and user
        spotlight = await app.openSpotlight();
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1.credentials.userId);
        await page.waitForTimeout(1000); // wait for the dialog to settle
        resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(2);
        await expect(
            spotlight.dialog
                .locator(".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option")
                .filter({ hasText: groupDmName }),
        ).toBeAttached();

        // Search for ByteBot by id, should return group DM and user
        spotlight = await app.openSpotlight();
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2.credentials.userId);
        await page.waitForTimeout(1000); // wait for the dialog to settle
        resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(2);
        await expect(
            spotlight.dialog
                .locator(".mx_SpotlightDialog_section.mx_SpotlightDialog_results .mx_SpotlightDialog_option")
                .filter({ hasText: groupDmName })
                .last(),
        ).toBeAttached();
    });

    // Test against https://github.com/vector-im/element-web/issues/22851
    test("should show each person result only once", async ({ page, app, bot1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);

        // 2 rounds of search to simulate the bug conditions. Specifically, the first search
        // should have 1 result (not 2) and the second search should also have 1 result (instead
        // of the super buggy 3 described by https://github.com/vector-im/element-web/issues/22851)
        //
        // We search for user ID to trigger the profile lookup within the dialog.
        for (let i = 0; i < 2; i++) {
            console.log("Iteration: " + i);
            await spotlight.search(bot1.credentials.userId);
            await page.waitForTimeout(1000); // wait for the dialog to settle
            const resultLocator = spotlight.results;
            await expect(resultLocator).toHaveCount(1);
            await expect(resultLocator.first()).toContainText(bot1.credentials.userId);
        }
    });

    test("should allow opening group chat dialog", async ({ page, app, bot2 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2.credentials.displayName);
        await page.waitForTimeout(3000); // wait for the dialog to settle

        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2.credentials.displayName);

        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_startGroupChat")).toContainText(
            "Start a group chat",
        );
        await spotlight.dialog.locator(".mx_SpotlightDialog_startGroupChat").click();
        await expect(page.getByRole("dialog")).toContainText("Direct Messages");
    });

    test("should close spotlight after starting a DM", async ({ page, app, bot1 }) => {
        await startDM(app, page, bot1.credentials.displayName);
        await expect(page.locator(".mx_SpotlightDialog")).toHaveCount(0);
    });

    test("should show the same user only once", async ({ page, app, bot1 }) => {
        await startDM(app, page, bot1.credentials.displayName);
        await page.goto("/#/home");
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1.credentials.displayName);
        await page.waitForTimeout(3000); // wait for the dialog to settle
        await expect(spotlight.dialog.locator(".mx_Spinner")).not.toBeAttached();
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
    });

    test("should be able to navigate results via keyboard", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search("b");

        let resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(2);
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "true");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "false");

        await spotlight.searchBox.press("ArrowDown");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "false");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "true");

        await spotlight.searchBox.press("ArrowDown");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "false");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "false");

        await spotlight.searchBox.press("ArrowUp");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "false");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "true");

        await spotlight.searchBox.press("ArrowUp");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "true");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "false");
    });
});
