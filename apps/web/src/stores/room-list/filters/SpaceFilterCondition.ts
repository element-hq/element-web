/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "events";
import { type Room } from "matrix-js-sdk/src/matrix";

import { FILTER_CHANGED, type IFilterCondition } from "./IFilterCondition";
import { type IDestroyable } from "../../../utils/IDestroyable";
import { isMetaSpace, MetaSpace, type SpaceKey } from "../../spaces";
import { setHasDiff } from "../../../utils/sets";
import SettingsStore from "../../../settings/SettingsStore";
import { type SdkContextClass } from "../../../contexts/SDKContextClass.ts";

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

    public constructor(private readonly sdkContext: SdkContextClass) {
        super();
    }

    public isVisible(room: Room): boolean {
        return this.sdkContext.spaceStore.isRoomInSpace(this.space, room.roomId);
    }

    private onStoreUpdate = async (forceUpdate = false): Promise<void> => {
        const beforeRoomIds = this.roomIds;
        // clone the set as it may be mutated by the space store internally
        this.roomIds = new Set(this.sdkContext.spaceStore.getSpaceFilteredRoomIds(this.space));

        const beforeUserIds = this.userIds;
        // clone the set as it may be mutated by the space store internally
        this.userIds = new Set(this.sdkContext.spaceStore.getSpaceFilteredUserIds(this.space));

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
            setTimeout(() => {
                this.emit(FILTER_CHANGED);
            });
        }
    };

    public updateSpace(space: SpaceKey): void {
        this.sdkContext.spaceStore.off(this.space, this.onStoreUpdate);
        this.sdkContext.spaceStore.on((this.space = space), this.onStoreUpdate);
        this.onStoreUpdate(true); // initial update from the change to the space
    }

    public destroy(): void {
        this.sdkContext.spaceStore.off(this.space, this.onStoreUpdate);
    }
}
