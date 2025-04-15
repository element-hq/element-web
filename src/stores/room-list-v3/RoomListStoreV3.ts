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
import type { FilterKey } from "./skip-list/filters";
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
import { FavouriteFilter } from "./skip-list/filters/FavouriteFilter";
import { UnreadFilter } from "./skip-list/filters/UnreadFilter";
import { PeopleFilter } from "./skip-list/filters/PeopleFilter";
import { RoomsFilter } from "./skip-list/filters/RoomsFilter";
import { InvitesFilter } from "./skip-list/filters/InvitesFilter";
import { MentionsFilter } from "./skip-list/filters/MentionsFilter";
import { LowPriorityFilter } from "./skip-list/filters/LowPriorityFilter";
import { type Sorter, SortingAlgorithm } from "./skip-list/sorters";
import { SettingLevel } from "../../settings/SettingLevel";
import { MARKED_UNREAD_TYPE_STABLE, MARKED_UNREAD_TYPE_UNSTABLE } from "../../utils/notifications";
import { getChangedOverrideRoomMutePushRules } from "../room-list/utils/roomMute";

/**
 * These are the filters passed to the room skip list.
 */
const FILTERS = [
    new FavouriteFilter(),
    new UnreadFilter(),
    new PeopleFilter(),
    new RoomsFilter(),
    new InvitesFilter(),
    new MentionsFilter(),
    new LowPriorityFilter(),
];

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
     * If filterKeys is passed, only the rooms that match the given filters are
     * returned.

     * @param filterKeys Optional array of filters that the rooms must match against.
     */
    public getSortedRoomsInActiveSpace(filterKeys?: FilterKey[]): Room[] {
        if (this.roomSkipList?.initialized) return Array.from(this.roomSkipList.getRoomsInActiveSpace(filterKeys));
        else return [];
    }

    /**
     * Resort the list of rooms using a different algorithm.
     * @param algorithm The sorting algorithm to use.
     */
    public resort(algorithm: SortingAlgorithm): void {
        if (!this.roomSkipList) throw new Error("Cannot resort room list before skip list is created.");
        if (!this.matrixClient) throw new Error("Cannot resort room list without matrix client.");
        if (this.roomSkipList.activeSortAlgorithm === algorithm) return;
        const sorter =
            algorithm === SortingAlgorithm.Alphabetic
                ? new AlphabeticSorter()
                : new RecencySorter(this.matrixClient.getSafeUserId());
        this.roomSkipList.useNewSorter(sorter, this.getRooms());
        this.emit(LISTS_UPDATE_EVENT);
        SettingsStore.setValue("RoomList.preferredSorting", null, SettingLevel.DEVICE, algorithm);
    }

    /**
     * Currently active sorting algorithm if the store is ready or undefined otherwise.
     */
    public get activeSortAlgorithm(): SortingAlgorithm | undefined {
        return this.roomSkipList?.activeSortAlgorithm;
    }

    protected async onReady(): Promise<any> {
        if (this.roomSkipList?.initialized || !this.matrixClient) return;
        const sorter = this.getPreferredSorter(this.matrixClient.getSafeUserId());
        this.roomSkipList = new RoomSkipList(sorter, FILTERS);
        await SpaceStore.instance.storeReadyPromise;
        const rooms = this.getRooms();
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

            case "MatrixActions.Room.accountData": {
                const eventType = payload.event_type;
                if (eventType === MARKED_UNREAD_TYPE_STABLE || eventType === MARKED_UNREAD_TYPE_UNSTABLE) {
                    const room = payload.room;
                    this.addRoomAndEmit(room);
                }
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
                this.handleAccountDataPayload(payload);
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
                if (oldMembership === EffectiveMembership.Join && newMembership === EffectiveMembership.Leave) {
                    this.roomSkipList.removeRoom(payload.room);
                    this.emit(LISTS_UPDATE_EVENT);
                    return;
                }
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
     * This method deals with the two types of account data payloads that we care about.
     */
    private handleAccountDataPayload(payload: ActionPayload): void {
        const eventType = payload.event_type;
        let needsEmit = false;
        switch (eventType) {
            // When we're told about new DMs, insert the associated dm rooms.
            case EventType.Direct: {
                const dmMap = payload.event.getContent();
                for (const userId of Object.keys(dmMap)) {
                    const roomIds = dmMap[userId];
                    for (const roomId of roomIds) {
                        const room = this.matrixClient!.getRoom(roomId);
                        if (!room) {
                            logger.warn(`${roomId} was found in DMs but the room is not in the store`);
                            continue;
                        }
                        this.roomSkipList!.addRoom(room);
                        needsEmit = true;
                    }
                }
                break;
            }
            case EventType.PushRules: {
                // When a room becomes muted/unmuted, re-insert that room.
                const possibleMuteChangeRoomIds = getChangedOverrideRoomMutePushRules(payload);
                if (!possibleMuteChangeRoomIds) return;
                const rooms = possibleMuteChangeRoomIds
                    .map((id) => this.matrixClient?.getRoom(id))
                    .filter((room) => !!room);
                for (const room of rooms) {
                    this.roomSkipList!.addRoom(room);
                    needsEmit = true;
                }
                break;
            }
        }
        if (needsEmit) this.emit(LISTS_UPDATE_EVENT);
    }

    /**
     * Create the correct sorter depending on the persisted user preference.
     * @param myUserId The user-id of our user.
     * @returns Sorter object that can be passed to the skip list.
     */
    private getPreferredSorter(myUserId: string): Sorter {
        const preferred = SettingsStore.getValue("RoomList.preferredSorting");
        switch (preferred) {
            case SortingAlgorithm.Alphabetic:
                return new AlphabeticSorter();
            case SortingAlgorithm.Recency:
                return new RecencySorter(myUserId);
            default:
                throw new Error(`Got unknown sort preference from RoomList.preferredSorting setting`);
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

window.mxRoomListStoreV3 = RoomListStoreV3.instance;
