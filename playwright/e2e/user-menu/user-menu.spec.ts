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

test.describe("User Menu", () => {
    test.use({ displayName: "Jeff" });

    test("should contain our name & userId", async ({ page, user }) => {
        await page.getByRole("button", { name: "User menu", exact: true }).click();
        const menu = page.getByRole("menu");

        await expect(menu.locator(".mx_UserMenu_contextMenu_displayName", { hasText: user.displayName })).toBeVisible();
        await expect(menu.locator(".mx_UserMenu_contextMenu_userId", { hasText: user.userId })).toBeVisible();
    });
});
