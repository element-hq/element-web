/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";

test.describe("Brand API", () => {
    test.use({
        displayName: "Manny",
        botCreateOpts: {
            autoAcceptInvites: true,
        },
        config: {
            modules: ["/modules/brand-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/brand-module.js", async (route) => {
                await route.fulfill({ path: "playwright/sample-files/brand-module.js" });
            });
            await use(page);
        },
        room: async ({ page, app, user, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "TestRoom", invite:[ bot.credentials.userId ] });
            await use({ roomId });
        },
    });
    test.describe("basic functionality", () => {
        test(
            "should replace the standard window title",
            async ({ page, room, app , user, bot}) => {
                await page.goto(`/#/home`);
                // Default title
                expect(await page.title()).toEqual("MyBrand | OK | notifs=undefined | notifsenabled=undefined | roomId=undefined | roomName=undefined");
                await app.viewRoomById(room.roomId);
                expect(await page.title()).toEqual(`MyBrand | OK | notifs=undefined | notifsenabled=undefined | roomId=${room.roomId} | roomName=TestRoom`);
            },
        );
});
