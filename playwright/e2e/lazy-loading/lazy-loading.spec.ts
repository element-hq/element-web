/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Bot } from "../../pages/bot";
import type { Locator, Page } from "@playwright/test";
import type { ElementAppPage } from "../../pages/ElementAppPage";
import { test, expect } from "../../element-web-test";
import { type Credentials } from "../../plugins/homeserver";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Lazy Loading", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3488");

    const charlies: Bot[] = [];

    test.use({
        displayName: "Alice",
        botCreateOpts: { displayName: "Bob" },
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
    });

    test.beforeEach(async ({ page, homeserver, user, bot, app }) => {
        for (let i = 1; i <= 10; i++) {
            const displayName = `Charly #${i}`;
            const bot = new Bot(page, homeserver, { displayName, startClient: false, autoAcceptInvites: false });
            charlies.push(bot);
        }
        await app.client.network.setupRoute();
    });

    const name = "Lazy Loading Test";
    const charlyMsg1 = "hi bob!";
    const charlyMsg2 = "how's it going??";
    let roomId: string;

    async function setupRoomWithBobAliceAndCharlies(
        page: Page,
        app: ElementAppPage,
        user: Credentials,
        bob: Bot,
        charlies: Bot[],
    ) {
        const alias = `#lltest:${user.homeServer}`;
        const visibility = await page.evaluate(() => (window as any).matrixcs.Visibility.Public);
        roomId = await bob.createRoom({
            name,
            room_alias_name: "lltest",
            visibility,
        });

        await Promise.all(charlies.map((bot) => bot.joinRoom(alias)));
        for (const charly of charlies) {
            await charly.sendMessage(roomId, charlyMsg1);
        }
        for (const charly of charlies) {
            await charly.sendMessage(roomId, charlyMsg2);
        }

        for (let i = 20; i >= 1; --i) {
            await bob.sendMessage(roomId, `I will only say this ${i} time(s)!`);
        }
        await app.client.joinRoom(alias);
        await app.viewRoomByName(name);
    }

    async function checkPaginatedDisplayNames(app: ElementAppPage, charlies: Bot[]) {
        await app.timeline.scrollToTop();
        for (const charly of charlies) {
            await expect(await app.timeline.findEventTile(charly.credentials.displayName, charlyMsg1)).toBeAttached();
            await expect(await app.timeline.findEventTile(charly.credentials.displayName, charlyMsg2)).toBeAttached();
        }
    }

    async function openMemberlist(app: ElementAppPage): Promise<void> {
        await app.toggleRoomInfoPanel();
        const { page } = app;
        await page.locator(".mx_RightPanel").getByRole("menuitem", { name: "People" }).click();
    }

    function getMemberInMemberlist(page: Page, name: string): Locator {
        return page.locator(".mx_MemberListView .mx_MemberTileView_name").filter({ hasText: name });
    }

    async function checkMemberList(page: Page, charlies: Bot[]) {
        await expect(getMemberInMemberlist(page, "Alice")).toBeAttached();
        await expect(getMemberInMemberlist(page, "Bob")).toBeAttached();
        for (const charly of charlies) {
            await expect(getMemberInMemberlist(page, charly.credentials.displayName)).toBeAttached();
        }
    }

    async function checkMemberListLacksCharlies(page: Page, charlies: Bot[]) {
        for (const charly of charlies) {
            await expect(getMemberInMemberlist(page, charly.credentials.displayName)).not.toBeAttached();
        }
    }

    async function joinCharliesWhileAliceIsOffline(
        page: Page,
        app: ElementAppPage,
        user: Credentials,
        charlies: Bot[],
    ) {
        const alias = `#lltest:${user.homeServer}`;
        await app.client.network.goOffline();
        for (const charly of charlies) {
            await charly.joinRoom(alias);
        }
        for (let i = 20; i >= 1; --i) {
            await charlies[0].sendMessage(roomId, "where is charly?");
        }
        await app.client.network.goOnline();
        await app.client.waitForNextSync();
    }

    test("should handle lazy loading properly even when offline", async ({ page, app, bot, user }) => {
        test.slow();
        const charly1to5 = charlies.slice(0, 5);
        const charly6to10 = charlies.slice(5);

        // Set up room with alice, bob & charlies 1-5
        await setupRoomWithBobAliceAndCharlies(page, app, user, bot, charly1to5);
        // Alice should see 2 messages from every charly with the correct display name
        await checkPaginatedDisplayNames(app, charly1to5);

        await openMemberlist(app);
        await checkMemberList(page, charly1to5);
        await joinCharliesWhileAliceIsOffline(page, app, user, charly6to10);
        await checkMemberList(page, charly6to10);

        for (const charly of charlies) {
            await charly.evaluate((client, roomId) => client.leave(roomId), roomId);
        }

        await checkMemberListLacksCharlies(page, charlies);
    });
});
