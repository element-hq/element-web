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

import { RoomListStore as Interface } from "./Interface";
import { SpaceFilterCondition } from "./filters/SpaceFilterCondition";
import SpaceStore from "../spaces/SpaceStore";
import { MetaSpace, SpaceKey, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../spaces";

/**
 * Watches for changes in spaces to manage the filter on the provided RoomListStore
 */
export class SpaceWatcher {
    private readonly filter = new SpaceFilterCondition();
    // we track these separately to the SpaceStore as we need to observe transitions
    private activeSpace: SpaceKey = SpaceStore.instance.activeSpace;
    private allRoomsInHome: boolean = SpaceStore.instance.allRoomsInHome;

    public constructor(private store: Interface) {
        if (SpaceWatcher.needsFilter(this.activeSpace, this.allRoomsInHome)) {
            this.updateFilter();
            store.addFilter(this.filter);
        }
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated);
        SpaceStore.instance.on(UPDATE_HOME_BEHAVIOUR, this.onHomeBehaviourUpdated);
    }

    private static needsFilter(spaceKey: SpaceKey, allRoomsInHome: boolean): boolean {
        return !(spaceKey === MetaSpace.Home && allRoomsInHome);
    }

    private onSelectedSpaceUpdated = (activeSpace: SpaceKey, allRoomsInHome = this.allRoomsInHome): void => {
        if (activeSpace === this.activeSpace && allRoomsInHome === this.allRoomsInHome) return; // nop

        const neededFilter = SpaceWatcher.needsFilter(this.activeSpace, this.allRoomsInHome);
        const needsFilter = SpaceWatcher.needsFilter(activeSpace, allRoomsInHome);

        this.activeSpace = activeSpace;
        this.allRoomsInHome = allRoomsInHome;

        if (needsFilter) {
            this.updateFilter();
        }

        if (!neededFilter && needsFilter) {
            this.store.addFilter(this.filter);
        } else if (neededFilter && !needsFilter) {
            this.store.removeFilter(this.filter);
        }
    };

    private onHomeBehaviourUpdated = (allRoomsInHome: boolean): void => {
        this.onSelectedSpaceUpdated(this.activeSpace, allRoomsInHome);
    };

    private updateFilter = (): void => {
        this.filter.updateSpace(this.activeSpace);
    };
}
