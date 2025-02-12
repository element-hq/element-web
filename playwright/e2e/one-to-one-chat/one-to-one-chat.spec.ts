/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Ahmad Kadri
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test as base, expect } from "../../element-web-test";
import { type Credentials } from "../../plugins/homeserver";
import { isDendrite } from "../../plugins/homeserver/dendrite";

const test = base.extend<{
    user2?: Credentials;
}>({});

test.describe("1:1 chat room", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3492");

    test.use({
        displayName: "Jeff",
        user2: async ({ homeserver }, use, testInfo) => {
            const credentials = await homeserver.registerUser(`user2_${testInfo.testId}`, "p4s5W0rD", "Timmy");
            await use(credentials);
        },
    });

    test.beforeEach(async ({ page, user2, user }) => {
        await page.goto(`/#/user/${user2.userId}?action=chat`);
    });

    test("should open new 1:1 chat room after leaving the old one", async ({ page, app, user2 }) => {
        // leave 1:1 chat room
        await app.toggleRoomInfoPanel();
        await page.getByRole("menuitem", { name: "Leave room" }).click();
        await page.getByRole("button", { name: "Leave" }).click();

        // wait till the room was left
        await expect(
            page.getByRole("group", { name: "Rooms" }).locator(".mx_RoomTile").getByText(user2.displayName),
        ).not.toBeVisible();
        await page.waitForTimeout(500); // avoid race condition with routing

        // open new 1:1 chat room
        await page.goto(`/#/user/${user2.userId}?action=chat`);
        await expect(page.locator(".mx_RoomHeader_heading").getByText(user2.displayName)).toBeVisible();
    });
});
