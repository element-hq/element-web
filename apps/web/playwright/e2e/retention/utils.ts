/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, type TestFixtures } from "../../element-web-test";
import type { Page } from "@playwright/test";

export const ONE_MINUTE = 60 * 1000;

export async function checkRetentionInRoom(
    { bot, app, page }: Pick<TestFixtures, "app" | "bot"> & { page: Page },
    roomId: string,
) {
    await bot.joinRoom(roomId);
    await app.viewRoomById(roomId);
    const tiles = (
        await Promise.all(Array.from({ length: 5 }).map((_o, index) => bot.sendMessage(roomId, `Message ${index}`)))
    ).map(({ event_id: evtId }) => page.locator(`.mx_RoomView_MessageList .mx_EventTile[data-event-id='${evtId}']`));
    for (const tile of tiles) {
        await expect(tile).toBeVisible();
    }
    await page.clock.fastForward(ONE_MINUTE + 1);
    for (const tile of tiles) {
        await expect(tile).toBeHidden();
    }
}
