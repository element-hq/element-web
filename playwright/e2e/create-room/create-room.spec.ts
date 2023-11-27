/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

test.describe("Create Room", () => {
    test.use({ displayName: "Jim" });

    test("should allow us to create a public room with name, topic & address set", async ({ page, user, app }) => {
        const name = "Test room 1";
        const topic = "This room is dedicated to this test and this test only!";

        const dialog = await app.openCreateRoomDialog();
        // Fill name & topic
        await dialog.getByRole("textbox", { name: "Name" }).fill(name);
        await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);
        // Change room to public
        await dialog.getByRole("button", { name: "Room visibility" }).click();
        await dialog.getByRole("option", { name: "Public room" }).click();
        // Fill room address
        await dialog.getByRole("textbox", { name: "Room address" }).fill("test-room-1");
        // Submit
        await dialog.getByRole("button", { name: "Create room" }).click();

        await expect(page).toHaveURL(/\/#\/room\/#test-room-1:localhost/);
        const header = page.locator(".mx_LegacyRoomHeader");
        await expect(header).toContainText(name);
        await expect(header).toContainText(topic);
    });
});
