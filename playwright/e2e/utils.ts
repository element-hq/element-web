/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { uniqueId } from "lodash";
import { expect, type Page } from "@playwright/test";

import type { ClientEvent, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { type Client } from "../pages/client";

/**
 * Resolves when room state matches predicate.
 * @param page Page instance
 * @param client Client instance that can be user or bot
 * @param roomId room id to find room and check
 * @param predicate defines condition that is used to check the room state
 *
 * FIXME this does not do what it is supposed to do, and I think it is unfixable.
 *   `page.exposeFunction` adds a function which returns a Promise. `window[predicateId](room)` therefore
 *   always returns a truthy value (a Promise).  But even if you fix that: as far as I can tell, the Room is
 *   just passed to the callback function as a JSON blob: you cannot actually call any methods on it, so the
 *   callback is useless.
 *
 * @deprecated This function is broken.
 */
export async function waitForRoom(
    page: Page,
    client: Client,
    roomId: string,
    predicate: (room: Room) => boolean,
): Promise<void> {
    const predicateId = uniqueId("waitForRoom");
    await page.exposeFunction(predicateId, predicate);
    await client.evaluateHandle(
        (matrixClient, { roomId, predicateId }) => {
            return new Promise<Room>((resolve) => {
                const room = matrixClient.getRoom(roomId);

                if (window[predicateId](room)) {
                    resolve(room);
                    return;
                }

                function onEvent(ev: MatrixEvent) {
                    if (ev.getRoomId() !== roomId) return;

                    if (window[predicateId](room)) {
                        matrixClient.removeListener("event" as ClientEvent, onEvent);
                        resolve(room);
                    }
                }

                matrixClient.on("event" as ClientEvent, onEvent);
            });
        },
        { roomId, predicateId },
    );
}

export async function selectHomeserver(page: Page, homeserverUrl: string) {
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserverUrl);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // wait for the dialog to go away
    await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);

    await expect(page.locator(".mx_Spinner")).toHaveCount(0);
    await expect(page.locator(".mx_ServerPicker_server")).toHaveText(homeserverUrl);
}

export const CommandOrControl = process.platform === "darwin" ? "Meta" : "Control";
