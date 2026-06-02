/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToastIfExists } from "@element-hq/element-web-playwright-common";

import { test, expect } from "../../element-web-test";

const ONE_MINUTE = 60 * 1000;

test.describe("Retention", () => {
    test.use({
        displayName: "Tom",
        botCreateOpts: {
            displayName: "Bob",
        },
        labsFlags: ["feature_retention"],
    });

    test.beforeEach(async ({ app, homeserver, page, user }) => {
        await rejectToastIfExists(page, "Verify this device");
        await rejectToastIfExists(page, "Notifications");
    });

    test(
        "should apply retention to a bunch of messages",
        { tag: "@screenshot" },
        async ({ app, homeserver, page, user, bot }) => {
            await page.clock.install();
            const roomId = await app.client.createRoom({
                name: "Test",
                invite: [bot.credentials.userId],
                initial_state: [
                    {
                        state_key: "",
                        type: "org.matrix.msc1763.retention",
                        content: {
                            max_lifetime: ONE_MINUTE,
                        },
                    },
                ],
            });
            // When the bot joins the room
            await bot.joinRoom(roomId);
            await app.viewRoomByName("Test");
            const tiles = (
                await Promise.all(
                    Array.from({ length: 5 }).map((_o, index) => bot.sendMessage(roomId, `Message ${index}`)),
                )
            ).map(({ event_id: evtId }) =>
                page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${evtId}']`),
            );
            for (const tile of tiles) {
                await expect(tile).toBeVisible();
            }
            await page.clock.fastForward(ONE_MINUTE + 1);
            for (const tile of tiles) {
                await expect(tile).toBeHidden();
            }
        },
    );

    test.fixme("apply global ", () => {});

    test.fixme("retention rules should apply retrospectively", () => {});
});
