/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

test.describe("Presence tests", () => {
    test.use({
        displayName: "Janet",
        botCreateOpts: { displayName: "Bob" },
    });

    test.describe("bob unreachable", () => {
        // This is failing on CI (https://github.com/element-hq/element-web/issues/27270)
        // but not locally, so debugging this is going to be tricky. Let's disable it for now.
        test.skip("renders unreachable presence state correctly", async ({ page, app, user, bot: bob }) => {
            await app.client.createRoom({ name: "My Room", invite: [bob.credentials.userId] });
            await app.viewRoomByName("My Room");

            await bob.evaluate(async (client) => {
                client.stopClient();
            });

            await page.route(
                `**/sync*`,
                async (route) => {
                    const response = await route.fetch();
                    await route.fulfill({
                        json: {
                            ...(await response.json()),
                            presence: {
                                events: [
                                    {
                                        type: "m.presence",
                                        sender: bob.credentials.userId,
                                        content: {
                                            presence: "io.element.unreachable",
                                            currently_active: false,
                                        },
                                    },
                                ],
                            },
                        },
                    });
                },
                { times: 1 },
            );
            await app.client.createRoom({}); // trigger sync

            await page.getByRole("button", { name: "Room info" }).click();
            await page.locator(".mx_RightPanel").getByText("People").click();
            await expect(page.locator(".mx_EntityTile_unreachable")).toContainText("Bob");
            await expect(page.locator(".mx_EntityTile_unreachable")).toContainText("User's server unreachable");
        });
    });
});
