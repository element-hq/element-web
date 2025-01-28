/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

const ROOM_NAME = "Test room";
const NAME = "Alice";

test.use({
    synapseConfig: {
        presence: {
            enabled: false,
            include_offline_users_on_sync: false,
        },
    },
    displayName: NAME,
    disablePresence: true,
});

test.describe("Memberlist", () => {
    test.beforeEach(async ({ app, user, page, homeserver }, testInfo) => {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        const id = await app.client.createRoom({ name: ROOM_NAME });
        const newBots: Bot[] = [];
        const names = ["Bob", "Bob", "Susan"];
        for (let i = 0; i < 3; i++) {
            const displayName = names[i];
            const autoAcceptInvites = displayName !== "Susan";
            const bot = new Bot(page, homeserver, { displayName, startClient: true, autoAcceptInvites });
            await bot.prepareClient();
            await app.client.inviteUser(id, bot.credentials?.userId);
            newBots.push(bot);
        }
    });

    test("Renders correctly", { tag: "@screenshot" }, async ({ page, app }) => {
        await app.viewRoomByName(ROOM_NAME);
        const memberlist = await app.toggleMemberlistPanel();
        await expect(memberlist.locator(".mx_MemberTileView")).toHaveCount(4);
        await expect(memberlist.getByText("Invited")).toHaveCount(1);
        await expect(page.locator(".mx_MemberListView")).toMatchScreenshot("with-four-members.png");
    });
});
