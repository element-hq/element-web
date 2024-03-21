/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { test, expect } from "../../element-web-test";
import { Filter } from "../../pages/Spotlight";
import { Bot } from "../../pages/bot";
import type { Locator, Page } from "@playwright/test";
import type { ElementAppPage } from "../../pages/ElementAppPage";

function roomHeaderName(page: Page): Locator {
    return page.locator(".mx_LegacyRoomHeader_nametext");
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

test.describe("Spotlight", () => {
    const bot1Name = "BotBob";
    let bot1: Bot;

    const bot2Name = "ByteBot";
    let bot2: Bot;

    const room1Name = "247";
    let room1Id: string;

    const room2Name = "Lounge";
    let room2Id: string;

    const room3Name = "Public";
    let room3Id: string;

    test.use({
        displayName: "Jim",
    });

    test.beforeEach(async ({ page, homeserver, app, user }) => {
        bot1 = new Bot(page, homeserver, { displayName: bot1Name, autoAcceptInvites: true });
        bot2 = new Bot(page, homeserver, { displayName: bot2Name, autoAcceptInvites: true });
        const Visibility = await page.evaluate(() => (window as any).matrixcs.Visibility);

        room1Id = await app.client.createRoom({ name: room1Name, visibility: Visibility.Public });

        await bot1.joinRoom(room1Id);
        const bot1UserId = await bot1.evaluate((client) => client.getUserId());
        room2Id = await bot2.createRoom({ name: room2Name, visibility: Visibility.Public });
        await bot2.inviteUser(room2Id, bot1UserId);

        room3Id = await bot2.createRoom({
            name: room3Name,
            visibility: Visibility.Public,
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
        await bot2.inviteUser(room3Id, bot1UserId);

        await page.goto("/#/room/" + room1Id);
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

    test("should find joined rooms", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.search(room1Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room1Name);
        await resultLocator.first().click();
        expect(page.url()).toContain(room1Id);
        await expect(roomHeaderName(page)).toContainText(room1Name);
    });

    test("should find known public rooms", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room1Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room1Name);
        await expect(resultLocator.first()).toContainText("View");
        await resultLocator.first().click();
        expect(page.url()).toContain(room1Id);
        await expect(roomHeaderName(page)).toContainText(room1Name);
    });

    test("should find unknown public rooms", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room2Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room2Name);
        await expect(resultLocator.first()).toContainText("Join");
        await resultLocator.first().click();
        expect(page.url()).toContain(room2Id);
        await expect(page.locator(".mx_RoomView_MessageList")).toHaveCount(1);
        await expect(roomHeaderName(page)).toContainText(room2Name);
    });

    test("should find unknown public world readable rooms", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room3Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(room3Name);
        await expect(resultLocator.first()).toContainText("View");
        await resultLocator.first().click();
        expect(page.url()).toContain(room3Id);
        await page.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomHeaderName(page)).toHaveText(room3Name);
    });

    // TODO: We currently can’t test finding rooms on other homeservers/other protocols
    // We obviously don’t have federation or bridges in local e2e tests
    test.skip("should find unknown public rooms on other homeservers", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.PublicRooms);
        await spotlight.search(room3Name);
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
        await expect(resultLocator.first()).toContainText(room3Name);
        await expect(resultLocator.first()).toContainText(room3Id);
    });

    test("should find known people", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot1Name);
        await resultLocator.first().click();
        await expect(roomHeaderName(page)).toHaveText(bot1Name);
    });

    /**
     * Search sends the correct query to Synapse.
     * Synapse doesn't return the user in the result list.
     * Waiting for the profile to be available via APIs before the tests didn't help.
     *
     * https://github.com/matrix-org/synapse/issues/16472
     */
    test.skip("should find unknown people", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2Name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2Name);
        await resultLocator.first().click();
        await expect(roomHeaderName(page)).toHaveText(bot2Name);
    });

    test("should find group DMs by usernames or user ids", async ({ page, app }) => {
        // First we want to share a room with both bots to ensure we’ve got their usernames cached
        const bot2UserId = await bot2.evaluate((client) => client.getUserId());
        await app.client.inviteUser(room1Id, bot2UserId);

        // Starting a DM with ByteBot (will be turned into a group dm later)
        let spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2Name);
        let resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2Name);
        await resultLocator.first().click();

        // Send first message to actually start DM
        await expect(roomHeaderName(page)).toHaveText(bot2Name);
        const locator = page.getByRole("textbox", { name: "Send a message…" });
        await locator.fill("Hey!");
        await locator.press("Enter");

        // Assert DM exists by checking for the first message and the room being in the room list
        await expect(page.locator(".mx_EventTile_body").filter({ hasText: "Hey!" })).toBeAttached({ timeout: 3000 });
        await expect(page.getByRole("group", { name: "People" })).toContainText(bot2Name);

        // Invite BotBob into existing DM with ByteBot
        const dmRooms = await app.client.evaluate((client, userId) => {
            const map = client.getAccountData("m.direct")?.getContent<Record<string, string[]>>();
            return map[userId] ?? [];
        }, bot2UserId);
        expect(dmRooms).toHaveLength(1);
        const groupDmName = await app.client.evaluate((client, id) => client.getRoom(id).name, dmRooms[0]);
        const bot1UserId = await bot1.evaluate((client) => client.getUserId());
        await app.client.inviteUser(dmRooms[0], bot1UserId);
        await expect(roomHeaderName(page).first()).toContainText(groupDmName);
        await expect(page.getByRole("group", { name: "People" }).first()).toContainText(groupDmName);

        // Search for BotBob by id, should return group DM and user
        spotlight = await app.openSpotlight();
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1UserId);
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
        await spotlight.search(bot2UserId);
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
    test("should show each person result only once", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        const bot1UserId = await bot1.evaluate((client) => client.getUserId());

        // 2 rounds of search to simulate the bug conditions. Specifically, the first search
        // should have 1 result (not 2) and the second search should also have 1 result (instead
        // of the super buggy 3 described by https://github.com/vector-im/element-web/issues/22851)
        //
        // We search for user ID to trigger the profile lookup within the dialog.
        for (let i = 0; i < 2; i++) {
            console.log("Iteration: " + i);
            await spotlight.search(bot1UserId);
            await page.waitForTimeout(1000); // wait for the dialog to settle
            const resultLocator = spotlight.results;
            await expect(resultLocator).toHaveCount(1);
            await expect(resultLocator.first()).toContainText(bot1UserId);
        }
    });

    test("should allow opening group chat dialog", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot2Name);
        await page.waitForTimeout(3000); // wait for the dialog to settle

        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(1);
        await expect(resultLocator.first()).toContainText(bot2Name);

        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_startGroupChat")).toContainText(
            "Start a group chat",
        );
        await spotlight.dialog.locator(".mx_SpotlightDialog_startGroupChat").click();
        await expect(page.getByRole("dialog")).toContainText("Direct Messages");
    });

    test("should close spotlight after starting a DM", async ({ page, app }) => {
        await startDM(app, page, bot1Name);
        await expect(page.locator(".mx_SpotlightDialog")).toHaveCount(0);
    });

    test("should show the same user only once", async ({ page, app }) => {
        await startDM(app, page, bot1Name);
        await page.goto("/#/home");
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.filter(Filter.People);
        await spotlight.search(bot1Name);
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
