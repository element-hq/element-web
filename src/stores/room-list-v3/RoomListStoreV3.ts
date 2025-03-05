/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { EventType } from "matrix-js-sdk/src/matrix";

import type { EmptyObject, Room, RoomState } from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import type { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import SettingsStore from "../../settings/SettingsStore";
import { VisibilityProvider } from "../room-list/filters/VisibilityProvider";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { LISTS_UPDATE_EVENT } from "../room-list/RoomListStore";
import { RoomSkipList } from "./skip-list/RoomSkipList";
import { RecencySorter } from "./skip-list/sorters/RecencySorter";
import { AlphabeticSorter } from "./skip-list/sorters/AlphabeticSorter";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import { EffectiveMembership, getEffectiveMembership, getEffectiveMembershipTag } from "../../utils/membership";
import SpaceStore from "../spaces/SpaceStore";
import { UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../spaces";

/**
 * This store allows for fast retrieval of the room list in a sorted and filtered manner.
 * This is the third such implementation hence the "V3".
 * This store is being actively developed so expect the methods to change in future.
 */
export class RoomListStoreV3Class extends AsyncStoreWithClient<EmptyObject> {
    private roomSkipList?: RoomSkipList;
    private readonly msc3946ProcessDynamicPredecessor: boolean;

    public constructor(dispatcher: MatrixDispatcher) {
        super(dispatcher);
        this.msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, () => {
            this.onActiveSpaceChanged();
        });
        SpaceStore.instance.on(UPDATE_HOME_BEHAVIOUR, () => this.onActiveSpaceChanged());
    }

    /**
     * Get a list of unsorted, unfiltered rooms.
     */
    public getRooms(): Room[] {
        let rooms = this.matrixClient?.getVisibleRooms(this.msc3946ProcessDynamicPredecessor) ?? [];
        rooms = rooms.filter((r) => VisibilityProvider.instance.isRoomVisible(r));
        return rooms;
    }

    /**
     * Get a list of sorted rooms.
     */
    public getSortedRooms(): Room[] {
        if (this.roomSkipList?.initialized) return Array.from(this.roomSkipList);
        else return [];
    }

    /**
     * Get a list of sorted rooms that belong to the currently active space.
     */
    public getSortedRoomsInActiveSpace(): Room[] {
        if (this.roomSkipList?.initialized) return Array.from(this.roomSkipList.getRoomsInActiveSpace());
        else return [];
    }

    /**
     * Re-sort the list of rooms by alphabetic order.
     */
    public useAlphabeticSorting(): void {
        if (this.roomSkipList) {
            const sorter = new AlphabeticSorter();
            this.roomSkipList.useNewSorter(sorter, this.getRooms());
        }
    }

    /**
     * Re-sort the list of rooms by recency.
     */
    public useRecencySorting(): void {
        if (this.roomSkipList && this.matrixClient) {
            const sorter = new RecencySorter(this.matrixClient?.getSafeUserId() ?? "");
            this.roomSkipList.useNewSorter(sorter, this.getRooms());
        }
    }

    protected async onReady(): Promise<any> {
        if (this.roomSkipList?.initialized || !this.matrixClient) return;
        const sorter = new RecencySorter(this.matrixClient.getSafeUserId());
        this.roomSkipList = new RoomSkipList(sorter);
        const rooms = this.getRooms();
        await SpaceStore.instance.storeReadyPromise;
        this.roomSkipList.seed(rooms);
        this.emit(LISTS_UPDATE_EVENT);
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (!this.matrixClient || !this.roomSkipList?.initialized) return;

        /**
         * For the kind of updates that we care about (represented by the cases below),
         * we try to find the associated room and simply re-insert it into the
         * skiplist. If the position of said room in the sorted list changed, re-inserting
         * would put it in the correct place.
         */
        switch (payload.action) {
            case "MatrixActions.Room.receipt": {
                if (readReceiptChangeIsFor(payload.event, this.matrixClient)) {
                    const room = payload.room;
                    if (!room) {
                        logger.warn(`Own read receipt was in unknown room ${room.roomId}`);
                        return;
                    }
                    this.addRoomAndEmit(room);
                }
                break;
            }

            case "MatrixActions.Room.tags": {
                const room = payload.room;
                this.addRoomAndEmit(room);
                break;
            }

            case "MatrixActions.Event.decrypted": {
                const roomId = payload.event.getRoomId();
                if (!roomId) return;
                const room = this.matrixClient.getRoom(roomId);
                if (!room) {
                    logger.warn(`Event ${payload.event.getId()} was decrypted in an unknown room ${roomId}`);
                    return;
                }
                this.addRoomAndEmit(room);
                break;
            }

            case "MatrixActions.accountData": {
                if (payload.event_type !== EventType.Direct) return;
                const dmMap = payload.event.getContent();
                let needsEmit = false;
                for (const userId of Object.keys(dmMap)) {
                    const roomIds = dmMap[userId];
                    for (const roomId of roomIds) {
                        const room = this.matrixClient.getRoom(roomId);
                        if (!room) {
                            logger.warn(`${roomId} was found in DMs but the room is not in the store`);
                            continue;
                        }
                        this.roomSkipList.addRoom(room);
                        needsEmit = true;
                    }
                }
                if (needsEmit) this.emit(LISTS_UPDATE_EVENT);
                break;
            }

            case "MatrixActions.Room.timeline": {
                // Ignore non-live events (backfill) and notification timeline set events (without a room)
                if (!payload.isLiveEvent || !payload.isLiveUnfilteredRoomTimelineEvent || !payload.room) return;
                this.addRoomAndEmit(payload.room);
                break;
            }

            case "MatrixActions.Room.myMembership": {
                const oldMembership = getEffectiveMembership(payload.oldMembership);
                const newMembership = getEffectiveMembershipTag(payload.room, payload.membership);
                if (oldMembership !== EffectiveMembership.Join && newMembership === EffectiveMembership.Join) {
                    // If we're joining an upgraded room, we'll want to make sure we don't proliferate
                    // the dead room in the list.
                    const roomState: RoomState = payload.room.currentState;
                    const predecessor = roomState.findPredecessor(this.msc3946ProcessDynamicPredecessor);
                    if (predecessor) {
                        const prevRoom = this.matrixClient?.getRoom(predecessor.roomId);
                        if (prevRoom) this.roomSkipList.removeRoom(prevRoom);
                        else logger.warn(`Unable to find predecessor room with id ${predecessor.roomId}`);
                    }
                }
                this.addRoomAndEmit(payload.room);
                break;
            }
        }
    }

    /**
     * Add a room to the skiplist and emit an update.
     * @param room The room to add to the skiplist
     */
    private addRoomAndEmit(room: Room): void {
        if (!this.roomSkipList) throw new Error("roomSkipList hasn't been created yet!");
        this.roomSkipList.addRoom(room);
        this.emit(LISTS_UPDATE_EVENT);
    }

    private onActiveSpaceChanged(): void {
        if (!this.roomSkipList) return;
        this.roomSkipList.calculateActiveSpaceForNodes();
        this.emit(LISTS_UPDATE_EVENT);
    }
}

export default class RoomListStoreV3 {
    private static internalInstance: RoomListStoreV3Class;

    public static get instance(): RoomListStoreV3Class {
        if (!RoomListStoreV3.internalInstance) {
            const instance = new RoomListStoreV3Class(defaultDispatcher);
            instance.start();
            RoomListStoreV3.internalInstance = instance;
        }

        return this.internalInstance;
    }
}
