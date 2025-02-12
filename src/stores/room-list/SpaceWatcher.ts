/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomListStore as Interface } from "./Interface";
import { SpaceFilterCondition } from "./filters/SpaceFilterCondition";
import SpaceStore from "../spaces/SpaceStore";
import { MetaSpace, type SpaceKey, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../spaces";

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
