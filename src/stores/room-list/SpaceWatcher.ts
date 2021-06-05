/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";

import { RoomListStoreClass } from "./RoomListStore";
import { SpaceFilterCondition } from "./filters/SpaceFilterCondition";
import SpaceStore, { UPDATE_SELECTED_SPACE } from "../SpaceStore";

/**
 * Watches for changes in spaces to manage the filter on the provided RoomListStore
 */
export class SpaceWatcher {
    private filter: SpaceFilterCondition;
    private activeSpace: Room = SpaceStore.instance.activeSpace;

    constructor(private store: RoomListStoreClass) {
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated);
    }

    private onSelectedSpaceUpdated = (activeSpace?: Room) => {
        this.activeSpace = activeSpace;

        if (this.filter) {
            if (activeSpace) {
                this.updateFilter();
            } else {
                this.store.removeFilter(this.filter);
                this.filter = null;
            }
        } else if (activeSpace) {
            this.filter = new SpaceFilterCondition();
            this.updateFilter();
            this.store.addFilter(this.filter);
        }
    };

    private updateFilter = () => {
        SpaceStore.instance.traverseSpace(this.activeSpace.roomId, roomId => {
            this.store.matrixClient?.getRoom(roomId)?.loadMembersIfNeeded();
        });
        this.filter.updateSpace(this.activeSpace);
    };
}
