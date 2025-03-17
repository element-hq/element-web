/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EmptyObject, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type MSC3575Filter, SlidingSyncEvent } from "matrix-js-sdk/src/sliding-sync";
import { type Optional } from "matrix-events-sdk";

import { type RoomUpdateCause, type TagID, OrderedDefaultTagIDs, DefaultTagID } from "./models";
import { type ITagMap, ListAlgorithm, SortAlgorithm } from "./algorithms/models";
import { type ActionPayload } from "../../dispatcher/payloads";
import { type MatrixDispatcher } from "../../dispatcher/dispatcher";
import { type IFilterCondition } from "./filters/IFilterCondition";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import { type RoomListStore as Interface, RoomListStoreEvent } from "./Interface";
import { MetaSpace, type SpaceKey, UPDATE_SELECTED_SPACE } from "../spaces";
import { LISTS_LOADING_EVENT } from "./RoomListStore";
import { UPDATE_EVENT } from "../AsyncStore";
import { type SdkContextClass } from "../../contexts/SDKContext";

export const SlidingSyncSortToFilter: Record<SortAlgorithm, string[]> = {
    [SortAlgorithm.Alphabetic]: ["by_name", "by_recency"],
    [SortAlgorithm.Recent]: ["by_notification_level", "by_recency"],
    [SortAlgorithm.Manual]: ["by_recency"],
};

const filterConditions: Record<TagID, MSC3575Filter> = {
    [DefaultTagID.Invite]: {
        is_invite: true,
    },
    [DefaultTagID.Favourite]: {
        tags: ["m.favourite"],
    },
    [DefaultTagID.DM]: {
        is_dm: true,
        is_invite: false,
        // If a DM has a Favourite & Low Prio tag then it'll be shown in those lists instead
        not_tags: ["m.favourite", "m.lowpriority"],
    },
    [DefaultTagID.Untagged]: {
        is_dm: false,
        is_invite: false,
        not_room_types: ["m.space"],
        not_tags: ["m.favourite", "m.lowpriority"],
        // spaces filter added dynamically
    },
    [DefaultTagID.LowPriority]: {
        tags: ["m.lowpriority"],
        // If a room has both Favourite & Low Prio tags then it'll be shown under Favourites
        not_tags: ["m.favourite"],
    },
    // TODO https://github.com/vector-im/element-web/issues/23207
    // DefaultTagID.ServerNotice,
    // DefaultTagID.Suggested,
    // DefaultTagID.Archived,
};

export const LISTS_UPDATE_EVENT = RoomListStoreEvent.ListsUpdate;

export class SlidingRoomListStoreClass extends AsyncStoreWithClient<EmptyObject> implements Interface {
    private tagIdToSortAlgo: Record<TagID, SortAlgorithm> = {};
    private tagMap: ITagMap = {};
    private counts: Record<TagID, number> = {};
    private stickyRoomId: Optional<string>;

    public constructor(
        dis: MatrixDispatcher,
        private readonly context: SdkContextClass,
    ) {
        super(dis);
        this.setMaxListeners(20); // RoomList + LeftPanel + 8xRoomSubList + spares
    }

    public async setTagSorting(tagId: TagID, sort: SortAlgorithm): Promise<void> {
        logger.info("SlidingRoomListStore.setTagSorting ", tagId, sort);
        this.tagIdToSortAlgo[tagId] = sort;
        switch (sort) {
            case SortAlgorithm.Alphabetic:
                await this.context.slidingSyncManager.ensureListRegistered(tagId, {
                    sort: SlidingSyncSortToFilter[SortAlgorithm.Alphabetic],
                });
                break;
            case SortAlgorithm.Recent:
                await this.context.slidingSyncManager.ensureListRegistered(tagId, {
                    sort: SlidingSyncSortToFilter[SortAlgorithm.Recent],
                });
                break;
            case SortAlgorithm.Manual:
                logger.error("cannot enable manual sort in sliding sync mode");
                break;
            default:
                logger.error("unknown sort mode: ", sort);
        }
    }

    public getTagSorting(tagId: TagID): SortAlgorithm {
        let algo = this.tagIdToSortAlgo[tagId];
        if (!algo) {
            logger.warn("SlidingRoomListStore.getTagSorting: no sort algorithm for tag ", tagId);
            algo = SortAlgorithm.Recent; // why not, we have to do something..
        }
        return algo;
    }

    public getCount(tagId: TagID): number {
        return this.counts[tagId] || 0;
    }

    public setListOrder(tagId: TagID, order: ListAlgorithm): void {
        // TODO: https://github.com/vector-im/element-web/issues/23207
    }

    public getListOrder(tagId: TagID): ListAlgorithm {
        // TODO: handle unread msgs first? https://github.com/vector-im/element-web/issues/23207
        return ListAlgorithm.Natural;
    }

    /**
     * Adds a filter condition to the room list store. Filters may be applied async,
     * and thus might not cause an update to the store immediately.
     * @param {IFilterCondition} filter The filter condition to add.
     */
    public async addFilter(filter: IFilterCondition): Promise<void> {
        // Do nothing, the filters are only used by SpaceWatcher to see if a room should appear
        // in the room list. We do not support arbitrary code for filters in sliding sync.
    }

    /**
     * Removes a filter condition from the room list store. If the filter was
     * not previously added to the room list store, this will no-op. The effects
     * of removing a filter may be applied async and therefore might not cause
     * an update right away.
     * @param {IFilterCondition} filter The filter condition to remove.
     */
    public removeFilter(filter: IFilterCondition): void {
        // Do nothing, the filters are only used by SpaceWatcher to see if a room should appear
        // in the room list. We do not support arbitrary code for filters in sliding sync.
    }

    /**
     * Gets the tags for a room identified by the store. The returned set
     * should never be empty, and will contain DefaultTagID.Untagged if
     * the store is not aware of any tags.
     * @param room The room to get the tags for.
     * @returns The tags for the room.
     */
    public getTagsForRoom(room: Room): TagID[] {
        // check all lists for each tag we know about and see if the room is there
        const tags: TagID[] = [];
        for (const tagId in this.tagIdToSortAlgo) {
            const listData = this.context.slidingSyncManager.slidingSync?.getListData(tagId);
            if (!listData) {
                continue;
            }
            for (const roomIndex in listData.roomIndexToRoomId) {
                const roomId = listData.roomIndexToRoomId[roomIndex];
                if (roomId === room.roomId) {
                    tags.push(tagId);
                    break;
                }
            }
        }
        return tags;
    }

    /**
     * Manually update a room with a given cause. This should only be used if the
     * room list store would otherwise be incapable of doing the update itself. Note
     * that this may race with the room list's regular operation.
     * @param {Room} room The room to update.
     * @param {RoomUpdateCause} cause The cause to update for.
     */
    public async manualRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<void> {
        // TODO: this is only used when you forget a room, not that important for now.
    }

    public get orderedLists(): ITagMap {
        return this.tagMap;
    }

    private refreshOrderedLists(tagId: string, roomIndexToRoomId: Record<number, string>): void {
        const tagMap = this.tagMap;

        // this room will not move due to it being viewed: it is sticky. This can be null to indicate
        // no sticky room if you aren't viewing a room.
        this.stickyRoomId = this.context.roomViewStore.getRoomId();
        let stickyRoomNewIndex = -1;
        const stickyRoomOldIndex = (tagMap[tagId] || []).findIndex((room): boolean => {
            return room.roomId === this.stickyRoomId;
        });

        // order from low to high
        const orderedRoomIndexes = Object.keys(roomIndexToRoomId)
            .map((numStr) => {
                return Number(numStr);
            })
            .sort((a, b) => {
                return a - b;
            });
        const seenRoomIds = new Set<string>();
        const orderedRoomIds = orderedRoomIndexes.map((i) => {
            const rid = roomIndexToRoomId[i];
            if (seenRoomIds.has(rid)) {
                logger.error("room " + rid + " already has an index position: duplicate room!");
            }
            seenRoomIds.add(rid);
            if (!rid) {
                throw new Error("index " + i + " has no room ID: Map => " + JSON.stringify(roomIndexToRoomId));
            }
            if (rid === this.stickyRoomId) {
                stickyRoomNewIndex = i;
            }
            return rid;
        });
        logger.debug(
            `SlidingRoomListStore.refreshOrderedLists ${tagId} sticky: ${this.stickyRoomId}`,
            `${stickyRoomOldIndex} -> ${stickyRoomNewIndex}`,
            "rooms:",
            orderedRoomIds.length < 30 ? orderedRoomIds : orderedRoomIds.length,
        );

        if (this.stickyRoomId && stickyRoomOldIndex >= 0 && stickyRoomNewIndex >= 0) {
            // this update will move this sticky room from old to new, which we do not want.
            // Instead, keep the sticky room ID index position as it is, swap it with
            // whatever was in its place.
            // Some scenarios with sticky room S and bump room B (other letters unimportant):
            // A, S, C, B                                  S, A, B
            // B, A, S, C  <---- without sticky rooms ---> B, S, A
            // B, S, A, C  <- with sticky rooms applied -> S, B, A
            // In other words, we need to swap positions to keep it locked in place.
            const inWayRoomId = orderedRoomIds[stickyRoomOldIndex];
            orderedRoomIds[stickyRoomOldIndex] = this.stickyRoomId;
            orderedRoomIds[stickyRoomNewIndex] = inWayRoomId;
        }

        // now set the rooms
        const rooms: Room[] = [];
        orderedRoomIds.forEach((roomId) => {
            const room = this.matrixClient?.getRoom(roomId);
            if (!room) {
                return;
            }
            rooms.push(room);
        });
        tagMap[tagId] = rooms;
        this.tagMap = tagMap;
    }

    private onSlidingSyncListUpdate(tagId: string, joinCount: number, roomIndexToRoomId: Record<number, string>): void {
        this.counts[tagId] = joinCount;
        this.refreshOrderedLists(tagId, roomIndexToRoomId);
        // let the UI update
        this.emit(LISTS_UPDATE_EVENT);
    }

    private onRoomViewStoreUpdated(): void {
        // we only care about this to know when the user has clicked on a room to set the stickiness value
        if (this.context.roomViewStore.getRoomId() === this.stickyRoomId) {
            return;
        }

        let hasUpdatedAnyList = false;

        // every list with the OLD sticky room ID needs to be resorted because it now needs to take
        // its proper place as it is no longer sticky. The newly sticky room can remain the same though,
        // as we only actually care about its sticky status when we get list updates.
        const oldStickyRoom = this.stickyRoomId;
        // it's not safe to check the data in slidingSync as it is tracking the server's view of the
        // room list. There's an edge case whereby the sticky room has gone outside the window and so
        // would not be present in the roomIndexToRoomId map anymore, and hence clicking away from it
        // will make it disappear eventually. We need to check orderedLists as that is the actual
        // sorted renderable list of rooms which sticky rooms apply to.
        for (const tagId in this.orderedLists) {
            const list = this.orderedLists[tagId];
            const room = list.find((room) => {
                return room.roomId === oldStickyRoom;
            });
            if (room) {
                // resort it based on the slidingSync view of the list. This may cause this old sticky
                // room to cease to exist.
                const listData = this.context.slidingSyncManager.slidingSync?.getListData(tagId);
                if (!listData) {
                    continue;
                }
                this.refreshOrderedLists(tagId, listData.roomIndexToRoomId);
                hasUpdatedAnyList = true;
            }
        }
        // in the event we didn't call refreshOrderedLists, it helps to still remember the sticky room ID.
        this.stickyRoomId = this.context.roomViewStore.getRoomId();

        if (hasUpdatedAnyList) {
            this.emit(LISTS_UPDATE_EVENT);
        }
    }

    protected async onReady(): Promise<any> {
        logger.info("SlidingRoomListStore.onReady");
        // permanent listeners: never get destroyed. Could be an issue if we want to test this in isolation.
        this.context.slidingSyncManager.slidingSync!.on(SlidingSyncEvent.List, this.onSlidingSyncListUpdate.bind(this));
        this.context.roomViewStore.addListener(UPDATE_EVENT, this.onRoomViewStoreUpdated.bind(this));
        this.context.spaceStore.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated.bind(this));
        if (this.context.spaceStore.activeSpace) {
            this.onSelectedSpaceUpdated(this.context.spaceStore.activeSpace, false);
        }

        // sliding sync has an initial response for spaces. Now request all the lists.
        // We do the spaces list _first_ to avoid potential flickering on DefaultTagID.Untagged list
        // which would be caused by initially having no `spaces` filter set, and then suddenly setting one.
        OrderedDefaultTagIDs.forEach((tagId) => {
            const filter = filterConditions[tagId];
            if (!filter) {
                logger.info("SlidingRoomListStore.onReady unsupported list ", tagId);
                return; // we do not support this list yet.
            }
            const sort = SortAlgorithm.Recent; // default to recency sort, TODO: read from config
            this.tagIdToSortAlgo[tagId] = sort;
            this.emit(LISTS_LOADING_EVENT, tagId, true);
            this.context.slidingSyncManager
                .ensureListRegistered(tagId, {
                    filters: filter,
                    sort: SlidingSyncSortToFilter[sort],
                })
                .then(() => {
                    this.emit(LISTS_LOADING_EVENT, tagId, false);
                });
        });
    }

    private onSelectedSpaceUpdated = (activeSpace: SpaceKey, allRoomsInHome: boolean): void => {
        logger.info("SlidingRoomListStore.onSelectedSpaceUpdated", activeSpace);
        // update the untagged filter
        const tagId = DefaultTagID.Untagged;
        const filters = filterConditions[tagId];
        const oldSpace = filters.spaces?.[0];
        filters.spaces = activeSpace && activeSpace != MetaSpace.Home ? [activeSpace] : undefined;
        if (oldSpace !== activeSpace) {
            // include subspaces in this list
            this.context.spaceStore.traverseSpace(
                activeSpace,
                (roomId: string) => {
                    if (roomId === activeSpace) {
                        return;
                    }
                    if (!filters.spaces) {
                        filters.spaces = [];
                    }
                    filters.spaces.push(roomId); // add subspace
                },
                false,
            );

            this.emit(LISTS_LOADING_EVENT, tagId, true);
            this.context.slidingSyncManager
                .ensureListRegistered(tagId, {
                    filters: filters,
                })
                .then(() => {
                    this.emit(LISTS_LOADING_EVENT, tagId, false);
                });
        }
    };

    // Intended for test usage
    public async resetStore(): Promise<void> {
        // Test function
    }

    /**
     * Regenerates the room whole room list, discarding any previous results.
     *
     * Note: This is only exposed externally for the tests. Do not call this from within
     * the app.
     * @param trigger Set to false to prevent a list update from being sent. Should only
     * be used if the calling code will manually trigger the update.
     */
    public regenerateAllLists({ trigger = true }): void {
        // Test function
    }

    protected async onNotReady(): Promise<any> {
        await this.resetStore();
    }

    protected async onAction(payload: ActionPayload): Promise<void> {}
}
