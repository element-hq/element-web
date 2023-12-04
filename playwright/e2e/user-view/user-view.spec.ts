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

test.describe("UserView", () => {
    test.use({
        displayName: "Violet",
        botCreateOpts: { displayName: "Usman" },
    });

    test("should render the user view as expected", async ({ page, homeserver, user, bot }) => {
        await page.goto(`/#/user/${bot.credentials.userId}`);

        const rightPanel = page.getByRole("complementary");
        await expect(rightPanel.getByRole("heading", { name: bot.credentials.displayName, exact: true })).toBeVisible();
        await expect(rightPanel.getByText("1 session")).toBeVisible();
        await expect(rightPanel).toMatchScreenshot("user-info.png", {
            mask: [page.locator(".mx_UserInfo_profile_mxid")],
        });
    });
});
