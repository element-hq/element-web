/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { safeGetRetryAfterMs } from "matrix-js-sdk/src/http-api";

import { asyncAction } from "./actionCreators";
import Modal from "../Modal";
import * as Rooms from "../Rooms";
import { _t } from "../languageHandler";
import { type AsyncActionPayload } from "../dispatcher/payloads";
import { DefaultTagID, type TagID } from "../stores/room-list-v3/skip-list/tag";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";

const MAX_TAG_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

/**
 * Executes a tag write operation (setRoomTag / deleteRoomTag), retrying
 * automatically when the homeserver responds with a 429 rate-limit error.
 * Uses the Retry-After delay from the response when available.
 */
async function withRateLimitRetry(fn: () => Promise<void>): Promise<void> {
    let attempt = 0;
    while (true) {
        try {
            await fn();
            return;
        } catch (err) {
            if (err instanceof MatrixError && err.isRateLimitError() && attempt < MAX_TAG_RETRIES) {
                attempt++;
                const delay = safeGetRetryAfterMs(err, DEFAULT_RETRY_DELAY_MS);
                logger.info(`Tag write rate-limited. Retrying in ${delay}ms (attempt ${attempt}/${MAX_TAG_RETRIES})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw err;
            }
        }
    }
}

export default class RoomListActions {
    /**
     * Creates an action thunk that will do an asynchronous request to
     * tag room.
     *
     * @param matrixClient the matrix client to set the
     *                                    account data on.
     * @param room the room to tag.
     * @param oldTag the tag to remove (unless oldTag ==== newTag)
     * @param newTag the tag with which to tag the room.
     * @param oldIndex the previous position of the room in the
     *                           list of rooms.
     * @returns an async action payload
     * @see asyncAction
     */
    public static tagRoom(
        matrixClient: MatrixClient,
        room: Room,
        oldTag: TagID | null | undefined,
        newTag: TagID | null | undefined,
    ): AsyncActionPayload {
        return asyncAction(
            "RoomListActions.tagRoom",
            () => {
                const promises: Promise<any>[] = [];
                const roomId = room.roomId;

                // Evil hack to get DMs behaving
                if (
                    (oldTag === undefined && newTag === DefaultTagID.DM) ||
                    (oldTag === DefaultTagID.DM && newTag === undefined)
                ) {
                    return Rooms.guessAndSetDMRoom(room, newTag === DefaultTagID.DM).catch((err) => {
                        logger.error("Failed to set DM tag " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("room_list|failed_set_dm_tag"),
                            description: err?.message ?? _t("invite|failed_generic"),
                        });
                    });
                }

                const hasChangedSubLists = oldTag !== newTag;

                // More evilness: We will still be dealing with moving to favourites/low prio,
                // but we avoid ever doing a request with TAG_DM.
                //
                // if we moved lists, remove the old tag
                if (oldTag && oldTag !== DefaultTagID.DM && hasChangedSubLists) {
                    const promiseToDelete = withRateLimitRetry(() => matrixClient.deleteRoomTag(roomId, oldTag)).catch(
                        function (err) {
                            logger.error("Failed to remove tag " + oldTag + " from room: " + err);
                            Modal.createDialog(ErrorDialog, {
                                title: _t("room_list|failed_remove_tag", { tagName: oldTag }),
                                description: err?.message ?? _t("invite|failed_generic"),
                            });
                        },
                    );

                    promises.push(promiseToDelete);
                }

                // if we moved lists or the ordering changed, add the new tag
                if (newTag && newTag !== DefaultTagID.DM && hasChangedSubLists) {
                    const promiseToAdd = withRateLimitRetry(() => matrixClient.setRoomTag(roomId, newTag)).catch(
                        function (err) {
                            logger.error("Failed to add tag " + newTag + " to room: " + err);
                            Modal.createDialog(ErrorDialog, {
                                title: _t("room_list|failed_add_tag", { tagName: newTag }),
                                description: err?.message ?? _t("invite|failed_generic"),
                            });

                            throw err;
                        },
                    );

                    promises.push(promiseToAdd);
                }

                return Promise.all(promises);
            },
            () => {
                // For an optimistic update
                return {
                    room,
                    oldTag,
                    newTag,
                };
            },
        );
    }
}
