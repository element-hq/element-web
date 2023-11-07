/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

/**
 * Resolves when room state matches predicate.
 * @param win window object
 * @param matrixClient MatrixClient instance that can be user or bot
 * @param roomId room id to find room and check
 * @param predicate defines condition that is used to check the room state
 */
export function waitForRoom(
    win: Cypress.AUTWindow,
    matrixClient: MatrixClient,
    roomId: string,
    predicate: (room: Room) => boolean,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const room = matrixClient.getRoom(roomId);

        if (predicate(room)) {
            resolve();
            return;
        }

        function onEvent(ev: MatrixEvent) {
            if (ev.getRoomId() !== roomId) return;

            if (predicate(room)) {
                matrixClient.removeListener(win.matrixcs.ClientEvent.Event, onEvent);
                resolve();
            }
        }

        matrixClient.on(win.matrixcs.ClientEvent.Event, onEvent);
    });
}
