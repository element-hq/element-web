/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import defaultDispatcher from "../dispatcher/dispatcher";
import { type LocalRoom, LocalRoomState } from "../models/LocalRoom";
import { isLocalRoom } from "./localRoom/isLocalRoom";
import { isRoomReady } from "./localRoom/isRoomReady";

const isActualRoomIdDefined = (actualRoomId: string | undefined): actualRoomId is string => {
    if (actualRoomId === undefined) {
        // should not happen
        throw new Error("Local room in CREATED state without actual room Id occurred");
    }

    return true;
};

/**
 * Does a room action:
 * For non-local rooms it calls fn directly.
 * For local rooms it adds the callback function to the room's afterCreateCallbacks and
 * dispatches a "local_room_event".
 *
 * @async
 * @template T
 * @param {string} roomId Room ID of the target room
 * @param {(actualRoomId: string) => Promise<T>} fn Callback to be called directly or collected at the local room
 * @param {MatrixClient} [client]
 * @returns {Promise<T>} Promise that gets resolved after the callback has finished
 */
export async function doMaybeLocalRoomAction<T>(
    roomId: string,
    fn: (actualRoomId: string) => Promise<T>,
    client: MatrixClient,
): Promise<T> {
    if (isLocalRoom(roomId)) {
        const room = client.getRoom(roomId) as LocalRoom;

        if (room.isCreated && isActualRoomIdDefined(room.actualRoomId)) {
            return fn(room.actualRoomId);
        }

        return new Promise<T>((resolve, reject) => {
            room.afterCreateCallbacks.push((newRoomId: string) => {
                fn(newRoomId).then(resolve).catch(reject);
            });
            defaultDispatcher.dispatch({
                action: "local_room_event",
                roomId: room.roomId,
            });
        });
    }

    return fn(roomId);
}

/**
 * Waits until a room is ready and then applies the after-create local room callbacks.
 * Also implements a stopgap timeout after that a room is assumed to be ready.
 *
 * @see isRoomReady
 * @async
 * @param {MatrixClient} client
 * @param {LocalRoom} localRoom
 * @param actualRoomId Id of the actual room
 * @returns {Promise<string>} Resolved to the actual room id
 */
export async function waitForRoomReadyAndApplyAfterCreateCallbacks(
    client: MatrixClient,
    localRoom: LocalRoom,
    actualRoomId: string,
): Promise<string> {
    if (isRoomReady(client, localRoom)) {
        return applyAfterCreateCallbacks(localRoom, actualRoomId).then(() => {
            localRoom.state = LocalRoomState.CREATED;
            client.emit(ClientEvent.Room, localRoom);
            return Promise.resolve(actualRoomId);
        });
    }

    return new Promise((resolve, reject) => {
        const finish = (): void => {
            if (checkRoomStateIntervalHandle) clearInterval(checkRoomStateIntervalHandle);
            if (stopgapTimeoutHandle) clearTimeout(stopgapTimeoutHandle);

            applyAfterCreateCallbacks(localRoom, actualRoomId)
                .then(() => {
                    localRoom.state = LocalRoomState.CREATED;
                    client.emit(ClientEvent.Room, localRoom);
                    resolve(actualRoomId);
                })
                .catch((err) => {
                    reject(err);
                });
        };

        const stopgapFinish = (): void => {
            logger.warn(`Assuming local room ${localRoom.roomId} is ready after hitting timeout`);
            finish();
        };

        const checkRoomStateIntervalHandle = window.setInterval(() => {
            if (isRoomReady(client, localRoom)) finish();
        }, 500);
        const stopgapTimeoutHandle = window.setTimeout(stopgapFinish, 5000);
    });
}

/**
 * Applies the after-create callback of a local room.
 *
 * @async
 * @param {LocalRoom} localRoom
 * @param {string} roomId
 * @returns {Promise<void>} Resolved after all callbacks have been called
 */
async function applyAfterCreateCallbacks(localRoom: LocalRoom, roomId: string): Promise<void> {
    for (const afterCreateCallback of localRoom.afterCreateCallbacks) {
        await afterCreateCallback(roomId);
    }

    localRoom.afterCreateCallbacks = [];
}
