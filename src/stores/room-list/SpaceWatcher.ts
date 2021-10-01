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
import SpaceStore, { UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../SpaceStore";

/**
 * Watches for changes in spaces to manage the filter on the provided RoomListStore
 */
export class SpaceWatcher {
    private readonly filter = new SpaceFilterCondition();
    // we track these separately to the SpaceStore as we need to observe transitions
    private activeSpace: Room = SpaceStore.instance.activeSpace;
    private allRoomsInHome: boolean = SpaceStore.instance.allRoomsInHome;

    constructor(private store: RoomListStoreClass) {
        if (!this.allRoomsInHome || this.activeSpace) {
            this.updateFilter();
            store.addFilter(this.filter);
        }
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated);
        SpaceStore.instance.on(UPDATE_HOME_BEHAVIOUR, this.onHomeBehaviourUpdated);
    }

    private onSelectedSpaceUpdated = (activeSpace?: Room, allRoomsInHome = this.allRoomsInHome) => {
        if (activeSpace === this.activeSpace && allRoomsInHome === this.allRoomsInHome) return; // nop

        const oldActiveSpace = this.activeSpace;
        const oldAllRoomsInHome = this.allRoomsInHome;
        this.activeSpace = activeSpace;
        this.allRoomsInHome = allRoomsInHome;

        if (activeSpace || !allRoomsInHome) {
            this.updateFilter();
        }

        if (oldAllRoomsInHome && !oldActiveSpace) {
            this.store.addFilter(this.filter);
        } else if (allRoomsInHome && !activeSpace) {
            this.store.removeFilter(this.filter);
        }
    };

    private onHomeBehaviourUpdated = (allRoomsInHome: boolean) => {
        this.onSelectedSpaceUpdated(this.activeSpace, allRoomsInHome);
    };

    private updateFilter = () => {
        if (this.activeSpace) {
            SpaceStore.instance.traverseSpace(this.activeSpace.roomId, roomId => {
                this.store.matrixClient?.getRoom(roomId)?.loadMembersIfNeeded();
            });
        }
        this.filter.updateSpace(this.activeSpace);
    };
}
