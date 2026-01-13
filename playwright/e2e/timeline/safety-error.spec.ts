/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { MatrixSafetyErrorCode } from "matrix-js-sdk/src/matrix";

test.describe("Safety error rendering", () => {
    test.use({
        displayName: "Alan",
        room: async ({ app, page, homeserver, user }, use) => {
            const roomId = await app.client.createRoom({
                name: "Test room",
            });

            await use({ roomId });
        },
    });

    test(
        "should show a safety rejection of a message with no harms",
        { tag: ["@screenshot"] },
        async ({ page, app, room, user }) => {
            await page.route("**/_matrix/client/v3/**/send/**", async (route) => {
                await route.fulfill({
                    json: { errcode: MatrixSafetyErrorCode.name, error: "Server provided error" },
                    status: 400,
                });
            });
            await app.viewRoomById(room.roomId);
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            const statusBar = page.getByRole("status", { name: new RegExp(/.*Message rejected.*/) });
            await expect(statusBar).toMatchScreenshot("message-no-harms.png");
        },
    );

    test(
        "should show a safety rejection of a message with only unknown harms",
        { tag: ["@screenshot"] },
        async ({ page, app, room, user }) => {
            await page.route("**/_matrix/client/v3/**/send/**", async (route) => {
                await route.fulfill({
                    json: {
                        errcode: MatrixSafetyErrorCode.name,
                        error: "Server provided error",
                        harms: ["org.example.unknown-harm"],
                    },
                    status: 400,
                });
            });
            await app.viewRoomById(room.roomId);
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            const statusBar = page.getByRole("status", { name: new RegExp(/.*Message rejected.*/) });
            await expect(statusBar).toMatchScreenshot("message-no-harms.png");
        },
    );

    test(
        "should show a simple rejection of a message with spam harm",
        { tag: ["@screenshot"] },
        async ({ page, app, room, user }) => {
            await page.route("**/_matrix/client/v3/**/send/**", async (route) => {
                await route.fulfill({
                    json: {
                        errcode: MatrixSafetyErrorCode.name,
                        error: "Ignored error",
                        harms: ["org.matrix.msc4387.spam"],
                    },
                    status: 400,
                });
            });
            await app.viewRoomById(room.roomId);
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            const statusBar = page.getByRole("status", { name: new RegExp(/.*Message rejected.*/) });
            await expect(statusBar).toMatchScreenshot("message-spam.png");
        },
    );
    test(
        "should show a simple rejection of a message with spam harm with expiry",
        { tag: ["@screenshot"] },
        async ({ page, app, room, user }) => {
            await page.route("**/_matrix/client/v3/**/send/**", async (route) => {
                await route.fulfill({
                    json: {
                        errcode: MatrixSafetyErrorCode.name,
                        error: "Ignored error",
                        harms: ["org.matrix.msc4387.spam"],
                        expiry: Date.now() + 1000,
                    },
                    status: 400,
                });
            });
            await app.viewRoomById(room.roomId);
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            const statusBar = page.getByRole("status", { name: new RegExp(/.*Message rejected.*/) });
            await expect(statusBar).toMatchScreenshot("message-spam-expiry.png");
            // Permit a retry
            await page.unroute("**/_matrix/client/v3/**/send/**");
            await statusBar.getByRole("button", { name: "Retry all" }).click({ timeout: 1500 });
            await expect(statusBar).not.toBeVisible();
        },
    );
});
