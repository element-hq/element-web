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

import { EventEmitter } from "events";
import { Room } from "matrix-js-sdk/src/models/room";

import { FILTER_CHANGED, IFilterCondition } from "./IFilterCondition";
import { IDestroyable } from "../../../utils/IDestroyable";
import SpaceStore from "../../spaces/SpaceStore";
import { isMetaSpace, MetaSpace, SpaceKey } from "../../spaces";
import { setHasDiff } from "../../../utils/sets";
import SettingsStore from "../../../settings/SettingsStore";

/**
 * A filter condition for the room list which reveals rooms which
 * are a member of a given space or if no space is selected shows:
 *  + Orphaned rooms (ones not in any space you are a part of)
 *  + All DMs
 */
export class SpaceFilterCondition extends EventEmitter implements IFilterCondition, IDestroyable {
    private roomIds = new Set<string>();
    private userIds = new Set<string>();
    private showPeopleInSpace = true;
    private space: SpaceKey = MetaSpace.Home;

    public isVisible(room: Room): boolean {
        return SpaceStore.instance.isRoomInSpace(this.space, room.roomId);
    }

    private onStoreUpdate = async (forceUpdate = false): Promise<void> => {
        const beforeRoomIds = this.roomIds;
        // clone the set as it may be mutated by the space store internally
        this.roomIds = new Set(SpaceStore.instance.getSpaceFilteredRoomIds(this.space));

        const beforeUserIds = this.userIds;
        // clone the set as it may be mutated by the space store internally
        this.userIds = new Set(SpaceStore.instance.getSpaceFilteredUserIds(this.space));

        const beforeShowPeopleInSpace = this.showPeopleInSpace;
        this.showPeopleInSpace =
            isMetaSpace(this.space[0]) || SettingsStore.getValue("Spaces.showPeopleInSpace", this.space);

        if (
            forceUpdate ||
            beforeShowPeopleInSpace !== this.showPeopleInSpace ||
            setHasDiff(beforeRoomIds, this.roomIds) ||
            setHasDiff(beforeUserIds, this.userIds)
        ) {
            this.emit(FILTER_CHANGED);
            // XXX: Room List Store has a bug where updates to the pre-filter during a local echo of a
            // tags transition seem to be ignored, so refire in the next tick to work around it
            setImmediate(() => {
                this.emit(FILTER_CHANGED);
            });
        }
    };

    public updateSpace(space: SpaceKey): void {
        SpaceStore.instance.off(this.space, this.onStoreUpdate);
        SpaceStore.instance.on((this.space = space), this.onStoreUpdate);
        this.onStoreUpdate(true); // initial update from the change to the space
    }

    public destroy(): void {
        SpaceStore.instance.off(this.space, this.onStoreUpdate);
    }
}
