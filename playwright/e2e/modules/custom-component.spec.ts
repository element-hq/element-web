/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
test.describe("Custom Component Module", () => {
    test.use({
        displayName: "Manny",
        config: {
            modules: ["/modules/custom-component-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/custom-component-module.js", async (route) => {
                await route.fulfill({ path: "playwright/sample-files/custom-component-module.js" });
            });
            await use(page);
        },
        room: async ({ page, app, user, bot }, use) => {
            const roomId = await app.client.createRoom({ name: 'TestRoom' });
            await use({ roomId });
        },
    });
    test("should replace the render method of a textual event",  { tag: "@screenshot" }, async ({ page, room, app  }) => {
        await app.viewRoomById(room.roomId);
        await app.client.sendMessage(room.roomId, 'Simple message');
        await expect(await page.getByText("Simple message")).toMatchScreenshot("custom-component-tile.png");
    });
    test("should render the original content of a textual event conditionally",  { tag: "@screenshot" }, async ({ page, room, app  }) => {
        await app.viewRoomById(room.roomId);
        await app.client.sendMessage(room.roomId, 'Do not replace me');
        await expect(await page.getByText("Do not replace me")).toMatchScreenshot("custom-component-tile-original.png");
    });
});
