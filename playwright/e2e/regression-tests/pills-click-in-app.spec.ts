/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

test.describe("Pills", () => {
    test.use({
        displayName: "Sally",
    });

    test("should navigate clicks internally to the app", async ({ page, app, user }) => {
        const messageRoom = "Send Messages Here";
        const targetLocalpart = "aliasssssssssssss";
        await app.client.createRoom({
            name: "Target",
            room_alias_name: targetLocalpart,
        });
        const messageRoomId = await app.client.createRoom({
            name: messageRoom,
        });

        await app.viewRoomByName(messageRoom);
        await expect(page).toHaveURL(new RegExp(`/#/room/${messageRoomId}`));

        // send a message using the built-in room mention functionality (autocomplete)
        await page
            .getByRole("textbox", { name: "Send a message…" })
            .pressSequentially(`Hello world! Join here: #${targetLocalpart.substring(0, 3)}`);
        await page.locator(".mx_Autocomplete_Completion_title").click();
        await page.getByRole("button", { name: "Send message" }).click();

        // find the pill in the timeline and click it
        await page.locator(".mx_EventTile_body .mx_Pill").click();

        const localUrl = new RegExp(`/#/room/#${targetLocalpart}:`);
        // verify we landed at a sane place
        await expect(page).toHaveURL(localUrl);

        // go back to the message room and try to click on the pill text, as a user would
        await app.viewRoomByName(messageRoom);
        const pillText = page.locator(".mx_EventTile_body .mx_Pill .mx_Pill_text");
        await expect(pillText).toHaveCSS("pointer-events", "none");
        await pillText.click({ force: true }); // force is to ensure we bypass pointer-events

        await expect(page).toHaveURL(localUrl);
    });
});
