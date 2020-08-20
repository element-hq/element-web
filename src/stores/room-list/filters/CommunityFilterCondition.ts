/*
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

import { Room } from "matrix-js-sdk/src/models/room";
import { FILTER_CHANGED, FilterPriority, IFilterCondition } from "./IFilterCondition";
import { Group } from "matrix-js-sdk/src/models/group";
import { EventEmitter } from "events";
import GroupStore from "../../GroupStore";
import { arrayHasDiff } from "../../../utils/arrays";
import { IDestroyable } from "../../../utils/IDestroyable";
import DMRoomMap from "../../../utils/DMRoomMap";

/**
 * A filter condition for the room list which reveals rooms which
 * are a member of a given community.
 */
export class CommunityFilterCondition extends EventEmitter implements IFilterCondition, IDestroyable {
    private roomIds: string[] = [];
    private userIds: string[] = [];

    constructor(private community: Group) {
        super();
        GroupStore.on("update", this.onStoreUpdate);

        // noinspection JSIgnoredPromiseFromCall
        this.onStoreUpdate(); // trigger a false update to seed the store
    }

    public get relativePriority(): FilterPriority {
        // Lowest priority so we can coarsely find rooms.
        return FilterPriority.Lowest;
    }

    public isVisible(room: Room): boolean {
        return this.roomIds.includes(room.roomId) ||
            this.userIds.includes(DMRoomMap.shared().getUserIdForRoomId(room.roomId));
    }

    private onStoreUpdate = async (): Promise<any> => {
        // We don't actually know if the room list changed for the community, so just check it again.
        const beforeRoomIds = this.roomIds;
        this.roomIds = (await GroupStore.getGroupRooms(this.community.groupId)).map(r => r.roomId);

        const beforeUserIds = this.userIds;
        this.userIds = (await GroupStore.getGroupMembers(this.community.groupId)).map(u => u.userId);

        if (arrayHasDiff(beforeRoomIds, this.roomIds) || arrayHasDiff(beforeUserIds, this.userIds)) {
            this.emit(FILTER_CHANGED);
        }
    };

    public destroy(): void {
        GroupStore.off("update", this.onStoreUpdate);
    }
}
