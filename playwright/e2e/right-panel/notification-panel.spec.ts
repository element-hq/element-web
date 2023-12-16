/*
Copyright 2023 Suguru Hirahara

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

const ROOM_NAME = "Test room";
const NAME = "Alice";

test.describe("NotificationPanel", () => {
    test.use({
        displayName: NAME,
        labsFlags: ["feature_notifications"],
    });

    test.beforeEach(async ({ app, user }) => {
        await app.client.createRoom({ name: ROOM_NAME });
    });

    test("should render empty state", async ({ page, app }) => {
        await app.viewRoomByName(ROOM_NAME);

        await page.getByRole("button", { name: "Notifications" }).click();

        // Wait until the information about the empty state is rendered
        await expect(page.locator(".mx_NotificationPanel_empty")).toBeVisible();

        // Take a snapshot of RightPanel
        await expect(page.locator(".mx_RightPanel")).toMatchScreenshot("empty.png");
    });
});
