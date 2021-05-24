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

import { FILTER_CHANGED, FilterKind, IFilterCondition } from "./IFilterCondition";
import { IDestroyable } from "../../../utils/IDestroyable";
import SpaceStore from "../../SpaceStore";
import { setHasDiff } from "../../../utils/sets";

/**
 * A filter condition for the room list which reveals rooms which
 * are a member of a given space or if no space is selected shows:
 *  + Orphaned rooms (ones not in any space you are a part of)
 *  + All DMs
 */
export class SpaceFilterCondition extends EventEmitter implements IFilterCondition, IDestroyable {
    private roomIds = new Set<Room>();
    private space: Room = null;

    public get kind(): FilterKind {
        return FilterKind.Prefilter;
    }

    public isVisible(room: Room): boolean {
        return this.roomIds.has(room.roomId);
    }

    private onStoreUpdate = async (): Promise<void> => {
        const beforeRoomIds = this.roomIds;
        // clone the set as it may be mutated by the space store internally
        this.roomIds = new Set(SpaceStore.instance.getSpaceFilteredRoomIds(this.space));

        if (setHasDiff(beforeRoomIds, this.roomIds)) {
            this.emit(FILTER_CHANGED);
            // XXX: Room List Store has a bug where updates to the pre-filter during a local echo of a
            // tags transition seem to be ignored, so refire in the next tick to work around it
            setImmediate(() => {
                this.emit(FILTER_CHANGED);
            });
        }
    };

    private getSpaceEventKey = (space: Room) => space.roomId;

    public updateSpace(space: Room) {
        if (this.space) {
            SpaceStore.instance.off(this.getSpaceEventKey(this.space), this.onStoreUpdate);
        }
        SpaceStore.instance.on(this.getSpaceEventKey(this.space = space), this.onStoreUpdate);
        this.onStoreUpdate(); // initial update from the change to the space
    }

    public destroy(): void {
        SpaceStore.instance.off(this.getSpaceEventKey(this.space), this.onStoreUpdate);
    }
}
