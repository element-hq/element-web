/*
Copyright 2023 Ahmad Kadri
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import { test as base, expect } from "../../element-web-test";
import { Credentials } from "../../plugins/homeserver";

const test = base.extend<{
    user2?: Credentials;
}>({});

test.describe("1:1 chat room", () => {
    test.use({
        displayName: "Jeff",
        user2: async ({ homeserver }, use) => {
            const credentials = await homeserver.registerUser("user1234", "p4s5W0rD", "Timmy");
            await use(credentials);
        },
    });

    test.beforeEach(async ({ page, user2, user }) => {
        await page.goto(`/#/user/${user2.userId}?action=chat`);
    });

    test("should open new 1:1 chat room after leaving the old one", async ({ page, user2 }) => {
        // leave 1:1 chat room
        await page.locator(".mx_LegacyRoomHeader_nametext").getByText(user2.displayName).click();
        await page.getByRole("menuitem", { name: "Leave" }).click();
        await page.getByRole("button", { name: "Leave" }).click();

        // wait till the room was left
        await expect(
            page.getByRole("group", { name: "Rooms" }).locator(".mx_RoomTile").getByText(user2.displayName),
        ).not.toBeVisible();

        // open new 1:1 chat room
        await page.goto(`/#/user/${user2.userId}?action=chat`);
        await expect(page.locator(".mx_LegacyRoomHeader_nametext").getByText(user2.displayName)).toBeVisible();
    });
});
