/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { asyncAction } from "./actionCreators";
import Modal from "../Modal";
import * as Rooms from "../Rooms";
import { _t } from "../languageHandler";
import { type AsyncActionPayload } from "../dispatcher/payloads";
import RoomListStore from "../stores/room-list/RoomListStore";
import { SortAlgorithm } from "../stores/room-list/algorithms/models";
import { DefaultTagID, type TagID } from "../stores/room-list/models";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";

export default class RoomListActions {
    /**
     * Creates an action thunk that will do an asynchronous request to
     * tag room.
     *
     * @param {MatrixClient} matrixClient the matrix client to set the
     *                                    account data on.
     * @param {Room} room the room to tag.
     * @param {string} oldTag the tag to remove (unless oldTag ==== newTag)
     * @param {string} newTag the tag with which to tag the room.
     * @param {?number} oldIndex the previous position of the room in the
     *                           list of rooms.
     * @param {?number} newIndex the new position of the room in the list
     *                           of rooms.
     * @returns {AsyncActionPayload} an async action payload
     * @see asyncAction
     */
    public static tagRoom(
        matrixClient: MatrixClient,
        room: Room,
        oldTag: TagID | null,
        newTag: TagID | null,
        newIndex: number,
    ): AsyncActionPayload {
        let metaData: Parameters<MatrixClient["setRoomTag"]>[2] | undefined;

        // Is the tag ordered manually?
        const store = RoomListStore.instance;
        if (newTag && store.getTagSorting(newTag) === SortAlgorithm.Manual) {
            const newList = [...store.orderedLists[newTag]];

            newList.sort((a, b) => a.tags[newTag].order - b.tags[newTag].order);

            const indexBefore = newIndex - 1;
            const indexAfter = newIndex;

            const prevOrder = indexBefore <= 0 ? 0 : newList[indexBefore].tags[newTag].order;
            const nextOrder = indexAfter >= newList.length ? 1 : newList[indexAfter].tags[newTag].order;

            metaData = {
                order: (prevOrder + nextOrder) / 2.0,
            };
        }

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
                    const promiseToDelete = matrixClient.deleteRoomTag(roomId, oldTag).catch(function (err) {
                        logger.error("Failed to remove tag " + oldTag + " from room: " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("room_list|failed_remove_tag", { tagName: oldTag }),
                            description: err?.message ?? _t("invite|failed_generic"),
                        });
                    });

                    promises.push(promiseToDelete);
                }

                // if we moved lists or the ordering changed, add the new tag
                if (newTag && newTag !== DefaultTagID.DM && (hasChangedSubLists || metaData)) {
                    const promiseToAdd = matrixClient.setRoomTag(roomId, newTag, metaData).catch(function (err) {
                        logger.error("Failed to add tag " + newTag + " to room: " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("room_list|failed_add_tag", { tagName: newTag }),
                            description: err?.message ?? _t("invite|failed_generic"),
                        });

                        throw err;
                    });

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
                    metaData,
                };
            },
        );
    }
}
