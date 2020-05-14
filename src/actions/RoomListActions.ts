/*
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { asyncAction } from './actionCreators';
import RoomListStore, { TAG_DM } from '../stores/RoomListStore';
import Modal from '../Modal';
import * as Rooms from '../Rooms';
import { _t } from '../languageHandler';
import * as sdk from '../index';
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { AsyncActionPayload } from "../dispatcher/payloads";

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
        matrixClient: MatrixClient, room: Room,
        oldTag: string, newTag: string,
        oldIndex: number | null, newIndex: number | null,
    ): AsyncActionPayload {
        let metaData = null;

        // Is the tag ordered manually?
        if (newTag && !newTag.match(/^(m\.lowpriority|im\.vector\.fake\.(invite|recent|direct|archived))$/)) {
            const lists = RoomListStore.getRoomLists();
            const newList = [...lists[newTag]];

            newList.sort((a, b) => a.tags[newTag].order - b.tags[newTag].order);

            // If the room was moved "down" (increasing index) in the same list we
            // need to use the orders of the tiles with indices shifted by +1
            const offset = (
                newTag === oldTag && oldIndex < newIndex
            ) ? 1 : 0;

            const indexBefore = offset + newIndex - 1;
            const indexAfter = offset + newIndex;

            const prevOrder = indexBefore <= 0 ?
                0 : newList[indexBefore].tags[newTag].order;
            const nextOrder = indexAfter >= newList.length ?
                1 : newList[indexAfter].tags[newTag].order;

            metaData = {
                order: (prevOrder + nextOrder) / 2.0,
            };
        }

        return asyncAction('RoomListActions.tagRoom', () => {
            const promises = [];
            const roomId = room.roomId;

            // Evil hack to get DMs behaving
            if ((oldTag === undefined && newTag === TAG_DM) ||
                (oldTag === TAG_DM && newTag === undefined)
            ) {
                return Rooms.guessAndSetDMRoom(
                    room, newTag === TAG_DM,
                ).catch((err) => {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to set direct chat tag " + err);
                    Modal.createTrackedDialog('Failed to set direct chat tag', '', ErrorDialog, {
                        title: _t('Failed to set direct chat tag'),
                        description: ((err && err.message) ? err.message : _t('Operation failed')),
                    });
                });
            }

            const hasChangedSubLists = oldTag !== newTag;

            // More evilness: We will still be dealing with moving to favourites/low prio,
            // but we avoid ever doing a request with TAG_DM.
            //
            // if we moved lists, remove the old tag
            if (oldTag && oldTag !== TAG_DM &&
                hasChangedSubLists
            ) {
                const promiseToDelete = matrixClient.deleteRoomTag(
                    roomId, oldTag,
                ).catch(function (err) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to remove tag " + oldTag + " from room: " + err);
                    Modal.createTrackedDialog('Failed to remove tag from room', '', ErrorDialog, {
                        title: _t('Failed to remove tag %(tagName)s from room', {tagName: oldTag}),
                        description: ((err && err.message) ? err.message : _t('Operation failed')),
                    });
                });

                promises.push(promiseToDelete);
            }

            // if we moved lists or the ordering changed, add the new tag
            if (newTag && newTag !== TAG_DM &&
                (hasChangedSubLists || metaData)
            ) {
                // metaData is the body of the PUT to set the tag, so it must
                // at least be an empty object.
                metaData = metaData || {};

                const promiseToAdd = matrixClient.setRoomTag(roomId, newTag, metaData).catch(function (err) {
                    const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                    console.error("Failed to add tag " + newTag + " to room: " + err);
                    Modal.createTrackedDialog('Failed to add tag to room', '', ErrorDialog, {
                        title: _t('Failed to add tag %(tagName)s to room', {tagName: newTag}),
                        description: ((err && err.message) ? err.message : _t('Operation failed')),
                    });

                    throw err;
                });

                promises.push(promiseToAdd);
            }

            return Promise.all(promises);
        }, () => {
            // For an optimistic update
            return {
                room, oldTag, newTag, metaData,
            };
        });
    }
}
