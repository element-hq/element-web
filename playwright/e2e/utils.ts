/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.
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

import { uniqueId } from "lodash";

import type { Page } from "@playwright/test";
import type { ClientEvent, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { Client } from "../pages/client";

/**
 * Resolves when room state matches predicate.
 * @param page Page instance
 * @param client Client instance that can be user or bot
 * @param roomId room id to find room and check
 * @param predicate defines condition that is used to check the room state
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

export const CommandOrControl = process.platform === "darwin" ? "Meta" : "Control";
