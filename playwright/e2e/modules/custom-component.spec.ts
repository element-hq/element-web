/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";

const screenshotOptions = (page: Page) => ({
    mask: [page.locator(".mx_MessageTimestamp")],
    // Hide the jump to bottom button in the timeline to avoid flakiness
    // Exclude timestamp and read marker from snapshot
    css: `
        .mx_JumpToBottomButton {
            display: none !important;
        }
        .mx_TopUnreadMessagesBar, .mx_MessagePanel_myReadMarker {
            display: none !important;
        }
    `,
});
test.describe("Custom Component API", () => {
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
            const roomId = await app.client.createRoom({ name: "TestRoom" });
            await use({ roomId });
        },
    });
    test.describe("basic functionality", () => {
        test(
            "should replace the render method of a textual event",
            { tag: "@screenshot" },
            async ({ page, room, app }) => {
                await app.viewRoomById(room.roomId);
                await app.client.sendMessage(room.roomId, "Simple message");
                await expect(await page.locator(".mx_EventTile_last")).toMatchScreenshot(
                    "custom-component-tile.png",
                    screenshotOptions(page),
                );
            },
        );
        test(
            "should fall through if one module does not render a component",
            { tag: "@screenshot" },
            async ({ page, room, app }) => {
                await app.viewRoomById(room.roomId);
                await app.client.sendMessage(room.roomId, "Fall through here");
                await expect(await page.locator(".mx_EventTile_last")).toMatchScreenshot(
                    "custom-component-tile-fall-through.png",
                    screenshotOptions(page),
                );
            },
        );
        test(
            "should render the original content of a textual event conditionally",
            { tag: "@screenshot" },
            async ({ page, room, app }) => {
                await app.viewRoomById(room.roomId);
                await app.client.sendMessage(room.roomId, "Do not replace me");
                await expect(await page.locator(".mx_EventTile_last")).toMatchScreenshot(
                    "custom-component-tile-original.png",
                    screenshotOptions(page),
                );
            },
        );
        test("should disallow editing when the allowEditingEvent hint is set to false", async ({ page, room, app }) => {
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Do not show edits");
            await page.getByText("Do not show edits").hover();
            await expect(
                await page.getByRole("toolbar", { name: "Message Actions" }).getByRole("button", { name: "Edit" }),
            ).not.toBeVisible();
        });
        test(
            "should render the next registered component if the filter function throws",
            { tag: "@screenshot" },
            async ({ page, room, app }) => {
                await app.viewRoomById(room.roomId);
                await app.client.sendMessage(room.roomId, "Crash the filter!");
                await expect(await page.locator(".mx_EventTile_last")).toMatchScreenshot(
                    "custom-component-crash-handle-filter.png",
                    screenshotOptions(page),
                );
            },
        );
        test(
            "should render original component if the render function throws",
            { tag: "@screenshot" },
            async ({ page, room, app }) => {
                await app.viewRoomById(room.roomId);
                await app.client.sendMessage(room.roomId, "Crash the renderer!");
                await expect(await page.locator(".mx_EventTile_last")).toMatchScreenshot(
                    "custom-component-crash-handle-renderer.png",
                    screenshotOptions(page),
                );
            },
        );
    });
});
