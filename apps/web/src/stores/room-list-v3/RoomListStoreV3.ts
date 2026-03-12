/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { EventType } from "matrix-js-sdk/src/matrix";

import type { EmptyObject, Room } from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import type { ActionPayload } from "../../dispatcher/payloads";
import type { Filter, FilterKey } from "./skip-list/filters";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import SettingsStore from "../../settings/SettingsStore";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { RecencySorter } from "./skip-list/sorters/RecencySorter";
import { AlphabeticSorter } from "./skip-list/sorters/AlphabeticSorter";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import { EffectiveMembership, getEffectiveMembership, getEffectiveMembershipTag } from "../../utils/membership";
import SpaceStore from "../spaces/SpaceStore";
import { type SpaceKey, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../spaces";
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
import { Action } from "../../dispatcher/actions";
import { UnreadSorter } from "./skip-list/sorters/UnreadSorter";
import { getChangedOverrideRoomMutePushRules } from "./utils";
import { isRoomVisible } from "./isRoomVisible";
import { RoomSkipList } from "./skip-list/RoomSkipList";
import { DefaultTagID } from "./skip-list/tag";
import { ExcludeTagsFilter } from "./skip-list/filters/ExcludeTagsFilter";
import { TagFilter } from "./skip-list/filters/TagFilter";
import { filterBoolean } from "../../utils/arrays";

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

export enum RoomListStoreV3Event {
    // The event/channel which is called when the room lists have been changed.
    ListsUpdate = "lists_update",
    // The event which is called when the room list is loaded.
    ListsLoaded = "lists_loaded",
}

// The result object for returning rooms from the store
export type RoomsResult = {
    // The ID of the active space queried
    spaceId: SpaceKey;
    // The filter queried
    filterKeys?: FilterKey[];
    // The resulting list of rooms
    sections: Section[];
};

/**
 * Represents a named section of rooms in the room list, identified by a tag.
 */
export interface Section {
    /** The tag that identifies this section. */
    tag: string;
    /** The ordered list of rooms belonging to this section. */
    rooms: Room[];
}

/**
 * A synthetic tag used to represent the "Chats" section, which contains
 * every room that does not belong to any other explicit tag section.
 */
export const CHATS_TAG = "chats";

export const LISTS_UPDATE_EVENT = RoomListStoreV3Event.ListsUpdate;
export const LISTS_LOADED_EVENT = RoomListStoreV3Event.ListsLoaded;
/**
 * This store allows for fast retrieval of the room list in a sorted and filtered manner.
 * This is the third such implementation hence the "V3".
 * This store is being actively developed so expect the methods to change in future.
 */
export class RoomListStoreV3Class extends AsyncStoreWithClient<EmptyObject> {
    /**
     * Contains all the rooms in the active space
     */
    private rooomSkipList?: RoomSkipList;

    /**
     * Maps section tags to their corresponding skip lists.
     */
    private roomSkipListByTag: Map<string, RoomSkipList> = new Map();

    /**
     * Maps section tags to their corresponding tag filters, used to determine which rooms belong in which sections.
     */
    private filterByTag: Map<string, Filter> = new Map();

    /**
     * Defines the display order of sections.
     */
    private sortedTags: string[] = [DefaultTagID.Favourite, CHATS_TAG, DefaultTagID.LowPriority];

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
        rooms = rooms.filter((r) => isRoomVisible(r));
        return rooms;
    }

    /**
     * Check whether the initial list of rooms has loaded.
     */
    public get isLoadingRooms(): boolean {
        return !this.areSkipListsInitialized();
    }

    /**
     * Get a list of sorted rooms.
     */
    public getSortedRooms(): Room[] {
        if (this.rooomSkipList?.initialized) return Array.from(this.rooomSkipList);
        else return [];
    }

    /**
     * Get a list of sorted rooms that belong to the currently active space.
     * If filterKeys is passed, only the rooms that match the given filters are
     * returned.

     * @param filterKeys Optional array of filters that the rooms must match against.
     */
    public getSortedRoomsInActiveSpace(filterKeys?: FilterKey[]): RoomsResult {
        const spaceId = SpaceStore.instance.activeSpace;

        const areSectionsEnabled = SettingsStore.getValue("feature_room_list_sections");
        const sections = areSectionsEnabled
            ? this.getSections(filterKeys)
            : [{ tag: CHATS_TAG, rooms: Array.from(this.rooomSkipList?.getRoomsInActiveSpace(filterKeys) ?? []) }];

        return {
            spaceId: spaceId,
            filterKeys,
            sections,
        };
    }

    /**
     * Resort the list of rooms using a different algorithm.
     * @param algorithm The sorting algorithm to use.
     */
    public resort(algorithm: SortingAlgorithm): void {
        if (!this.areSkipListsInitialized()) throw new Error("Cannot resort room list before skip list is created.");
        if (!this.matrixClient) throw new Error("Cannot resort room list without matrix client.");
        if (this.rooomSkipList!.activeSortAlgorithm === algorithm) return;
        const sorter = this.getSorterFromSortingAlgorithm(algorithm, this.matrixClient.getSafeUserId());
        this.runOnAllList((list) => list.useNewSorter(sorter, this.getRooms()));
        this.emit(LISTS_UPDATE_EVENT);
        SettingsStore.setValue("RoomList.preferredSorting", null, SettingLevel.DEVICE, algorithm);
    }

    /**
     * Currently active sorting algorithm if the store is ready or undefined otherwise.
     */
    public get activeSortAlgorithm(): SortingAlgorithm | undefined {
        return this.rooomSkipList?.activeSortAlgorithm;
    }

    protected async onReady(): Promise<any> {
        if (this.areSkipListsInitialized() || !this.matrixClient) return;
        const sorter = this.getPreferredSorter(this.matrixClient.getSafeUserId());

        this.createSkipLists(sorter, FILTERS);

        await SpaceStore.instance.storeReadyPromise;
        const rooms = this.getRooms();
        this.runOnAllList((list) => list.seed(rooms));
        this.emit(LISTS_LOADED_EVENT);
        this.emit(LISTS_UPDATE_EVENT);
    }

    protected async onNotReady(): Promise<void> {
        this.roomSkipListByTag.clear();
        this.rooomSkipList = undefined;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (!this.matrixClient || !this.areSkipListsInitialized()) return;

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

                // If the user is kicked, re-insert the room and do nothing more.
                const ownUserId = this.matrixClient.getSafeUserId();
                const isKicked = (payload.room as Room).getMember(ownUserId)?.isKicked();
                if (isKicked) {
                    this.addRoomAndEmit(payload.room);
                    return;
                }
                // If the user has left this room, remove it from the skiplist.
                if (
                    (oldMembership === EffectiveMembership.Invite || oldMembership === EffectiveMembership.Join) &&
                    newMembership === EffectiveMembership.Leave
                ) {
                    this.runOnAllList((list) => list.removeRoom(payload.room));
                    this.emit(LISTS_UPDATE_EVENT);
                    return;
                }

                // If we're joining an upgraded room, we'll want to make sure we don't proliferate
                // the dead room in the list.
                if (oldMembership !== EffectiveMembership.Join && newMembership === EffectiveMembership.Join) {
                    const room: Room = payload.room;
                    const roomUpgradeHistory = room.client.getRoomUpgradeHistory(
                        room.roomId,
                        true,
                        this.msc3946ProcessDynamicPredecessor,
                    );
                    const predecessors = roomUpgradeHistory.slice(0, roomUpgradeHistory.indexOf(room));
                    for (const predecessor of predecessors) {
                        this.runOnAllList((list) => list.removeRoom(predecessor));
                    }
                }

                this.addRoomAndEmit(payload.room, oldMembership === EffectiveMembership.Leave);
                break;
            }

            case Action.AfterForgetRoom: {
                const room = payload.room;
                this.runOnAllList((list) => list.removeRoom(room));
                this.emit(LISTS_UPDATE_EVENT);
                break;
            }
        }
    }

    /**
     * This method deals with the two types of account data payloads that we care about.
     */
    private handleAccountDataPayload(payload: ActionPayload): void {
        if (!this.areSkipListsInitialized()) throw new Error("sectionStore hasn't been created yet!");

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
                        this.runOnAllList((list) => list.reInsertRoom(room));
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
                    this.runOnAllList((list) => list.reInsertRoom(room));
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
        return this.getSorterFromSortingAlgorithm(preferred, myUserId);
    }

    /**
     * Get a sorter instance from the sorting algorithm enum value.
     * @param algorithm The sorting algorithm
     * @param myUserId The user-id of the current user
     * @returns the sorter instance
     */
    private getSorterFromSortingAlgorithm(algorithm: SortingAlgorithm, myUserId: string): Sorter {
        switch (algorithm) {
            case SortingAlgorithm.Alphabetic:
                return new AlphabeticSorter();
            case SortingAlgorithm.Recency:
                return new RecencySorter(myUserId);
            case SortingAlgorithm.Unread:
                return new UnreadSorter(myUserId);
            default:
                logger.info(
                    `RoomListStoreV3: There is no sorting implementation for algorithm ${algorithm}, defaulting to recency sorter`,
                );
                return new RecencySorter(myUserId);
        }
    }

    /**
     * Add a room to the skiplist and emit an update.
     * @param room The room to add to the skiplist
     * @param isNewRoom Set this to true if this a new room that the isn't already in the skiplist
     */
    private addRoomAndEmit(room: Room, isNewRoom = false): void {
        if (!this.areSkipListsInitialized()) throw new Error("roomSkipList hasn't been created yet!");
        if (isNewRoom) {
            if (!isRoomVisible(room)) {
                logger.info(
                    `RoomListStoreV3: Refusing to add new room ${room.roomId} because isRoomVisible returned false.`,
                );
                return;
            }
            this.runOnAllList((list) => list.addNewRoom(room));
        } else {
            this.runOnAllList((list) => list.reInsertRoom(room));
        }
        this.emit(LISTS_UPDATE_EVENT);
    }

    private onActiveSpaceChanged(): void {
        if (!this.areSkipListsInitialized()) return;
        this.runOnAllList((list) => list.calculateActiveSpaceForNodes());
        this.emit(LISTS_UPDATE_EVENT);
    }

    /**
     * Initializes the skip lists for each section and the "all rooms" list with the provided sorter and filters.
     * @param sorter The sorting algorithm to use for all skip lists
     * @param filters The filters to use for all skip lists, in addition to the tag filters for each section
     */
    private createSkipLists(sorter: Sorter, filters: Filter[]): void {
        const tagsToExclude = this.sortedTags.filter((tag) => tag !== CHATS_TAG);
        this.sortedTags.forEach((tag) => {
            const filter = tag === CHATS_TAG ? new ExcludeTagsFilter(tagsToExclude) : new TagFilter(tag);
            this.filterByTag.set(tag, filter);
            this.roomSkipListByTag.set(tag, new RoomSkipList(sorter, [filter, ...filters]));
        });

        this.rooomSkipList = new RoomSkipList(sorter, filters);
    }

    /**
     * Runs the provided callback on all the skip lists
     * @param cb The callback to run on all the skip lists
     */
    private runOnAllList(cb: (list: RoomSkipList) => void): void {
        this.roomSkipListByTag.forEach((skipList) => cb(skipList));
        if (this.rooomSkipList) cb(this.rooomSkipList);
    }

    /**
     * Checks whether all skip lists have been initialized.
     */
    private areSkipListsInitialized(): boolean {
        return (
            this.sortedTags.every((tag) => this.roomSkipListByTag.get(tag)?.initialized) &&
            Boolean(this.rooomSkipList?.initialized)
        );
    }

    /**
     * Get the sections to display in the room list, based on the current active space and the provided filters.
     * @param filterKeys - Optional array of filters that the rooms must match against to be included in the sections.
     * @returns An array of sections
     */
    private getSections(filterKeys?: FilterKey[]): Section[] {
        return this.sortedTags.map((tag) => {
            const filters = filterBoolean([this.filterByTag.get(tag)?.key, ...(filterKeys || [])]);

            return {
                tag,
                rooms: Array.from(this.roomSkipListByTag.get(tag)?.getRoomsInActiveSpace(filters) || []),
            };
        });
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

window.getRoomListStoreV3 = () => RoomListStoreV3.instance;
