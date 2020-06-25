/*
Copyright 2018, 2019 New Vector Ltd
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

import { MatrixClient } from "matrix-js-sdk/src/client";
import SettingsStore from "../../settings/SettingsStore";
import { OrderedDefaultTagIDs, RoomUpdateCause, TagID } from "./models";
import TagOrderStore from "../TagOrderStore";
import { AsyncStore } from "../AsyncStore";
import { Room } from "matrix-js-sdk/src/models/room";
import { IListOrderingMap, ITagMap, ITagSortingMap, ListAlgorithm, SortAlgorithm } from "./algorithms/models";
import { ActionPayload } from "../../dispatcher/payloads";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import { IFilterCondition } from "./filters/IFilterCondition";
import { TagWatcher } from "./TagWatcher";
import RoomViewStore from "../RoomViewStore";
import { Algorithm, LIST_UPDATED_EVENT } from "./algorithms/Algorithm";

interface IState {
    tagsEnabled?: boolean;
}

/**
 * The event/channel which is called when the room lists have been changed. Raised
 * with one argument: the instance of the store.
 */
export const LISTS_UPDATE_EVENT = "lists_update";

export class RoomListStore2 extends AsyncStore<ActionPayload> {
    private _matrixClient: MatrixClient;
    private initialListsGenerated = false;
    private enabled = false;
    private algorithm = new Algorithm();
    private filterConditions: IFilterCondition[] = [];
    private tagWatcher = new TagWatcher(this);

    private readonly watchedSettings = [
        'RoomList.orderAlphabetically',
        'RoomList.orderByImportance',
        'feature_custom_tags',
    ];

    constructor() {
        super(defaultDispatcher);

        this.checkEnabled();
        for (const settingName of this.watchedSettings) SettingsStore.monitorSetting(settingName, null);
        RoomViewStore.addListener(this.onRVSUpdate);
        this.algorithm.on(LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
    }

    public get orderedLists(): ITagMap {
        if (!this.algorithm) return {}; // No tags yet.
        return this.algorithm.getOrderedRooms();
    }

    public get matrixClient(): MatrixClient {
        return this._matrixClient;
    }

    // TODO: Remove enabled flag when the old RoomListStore goes away
    private checkEnabled() {
        this.enabled = SettingsStore.isFeatureEnabled("feature_new_room_list");
        if (this.enabled) {
            console.log("⚡ new room list store engaged");
        }
    }

    private async readAndCacheSettingsFromStore() {
        const tagsEnabled = SettingsStore.isFeatureEnabled("feature_custom_tags");
        await this.updateState({
            tagsEnabled,
        });
        await this.updateAlgorithmInstances();
    }

    private onRVSUpdate = () => {
        if (!this.enabled) return; // TODO: Remove enabled flag when RoomListStore2 takes over
        if (!this.matrixClient) return; // We assume there won't be RVS updates without a client

        const activeRoomId = RoomViewStore.getRoomId();
        if (!activeRoomId && this.algorithm.stickyRoom) {
            this.algorithm.stickyRoom = null;
        } else if (activeRoomId) {
            const activeRoom = this.matrixClient.getRoom(activeRoomId);
            if (!activeRoom) throw new Error(`${activeRoomId} is current in RVS but missing from client`);
            if (activeRoom !== this.algorithm.stickyRoom) {
                console.log(`Changing sticky room to ${activeRoomId}`);
                this.algorithm.stickyRoom = activeRoom;
            }
        }
    };

    protected async onDispatch(payload: ActionPayload) {
        if (payload.action === 'MatrixActions.sync') {
            // Filter out anything that isn't the first PREPARED sync.
            if (!(payload.prevState === 'PREPARED' && payload.state !== 'PREPARED')) {
                return;
            }

            // TODO: Remove this once the RoomListStore becomes default
            this.checkEnabled();
            if (!this.enabled) return;

            this._matrixClient = payload.matrixClient;

            // Update any settings here, as some may have happened before we were logically ready.
            console.log("Regenerating room lists: Startup");
            await this.readAndCacheSettingsFromStore();
            await this.regenerateAllLists();
            this.onRVSUpdate(); // fake an RVS update to adjust sticky room, if needed
        }

        // TODO: Remove this once the RoomListStore becomes default
        if (!this.enabled) return;

        if (payload.action === 'on_client_not_viable' || payload.action === 'on_logged_out') {
            // Reset state without causing updates as the client will have been destroyed
            // and downstream code will throw NPE errors.
            this.reset(null, true);
            this._matrixClient = null;
            this.initialListsGenerated = false; // we'll want to regenerate them
        }

        // Everything below here requires a MatrixClient or some sort of logical readiness.
        const logicallyReady = this.matrixClient && this.initialListsGenerated;
        if (!logicallyReady) return;

        if (payload.action === 'setting_updated') {
            if (this.watchedSettings.includes(payload.settingName)) {
                console.log("Regenerating room lists: Settings changed");
                await this.readAndCacheSettingsFromStore();

                await this.regenerateAllLists(); // regenerate the lists now
            }
        }

        if (!this.algorithm) {
            // This shouldn't happen because `initialListsGenerated` implies we have an algorithm.
            throw new Error("Room list store has no algorithm to process dispatcher update with");
        }

        if (payload.action === 'MatrixActions.Room.receipt') {
            // First see if the receipt event is for our own user. If it was, trigger
            // a room update (we probably read the room on a different device).
            if (readReceiptChangeIsFor(payload.event, this.matrixClient)) {
                const room = payload.room;
                if (!room) {
                    console.warn(`Own read receipt was in unknown room ${room.roomId}`);
                    return;
                }
                console.log(`[RoomListDebug] Got own read receipt in ${room.roomId}`);
                await this.handleRoomUpdate(room, RoomUpdateCause.ReadReceipt);
                return;
            }
        } else if (payload.action === 'MatrixActions.Room.tags') {
            const roomPayload = (<any>payload); // TODO: Type out the dispatcher types
            console.log(`[RoomListDebug] Got tag change in ${roomPayload.room.roomId}`);
            await this.handleRoomUpdate(roomPayload.room, RoomUpdateCause.PossibleTagChange);
        } else if (payload.action === 'MatrixActions.Room.timeline') {
            const eventPayload = (<any>payload); // TODO: Type out the dispatcher types

            // Ignore non-live events (backfill)
            if (!eventPayload.isLiveEvent || !payload.isLiveUnfilteredRoomTimelineEvent) return;

            const roomId = eventPayload.event.getRoomId();
            const room = this.matrixClient.getRoom(roomId);
            const tryUpdate = async (updatedRoom: Room) => {
                console.log(`[RoomListDebug] Live timeline event ${eventPayload.event.getId()} in ${updatedRoom.roomId}`);
                if (eventPayload.event.getType() === 'm.room.tombstone' && eventPayload.event.getStateKey() === '') {
                    console.log(`[RoomListDebug] Got tombstone event - regenerating room list`);
                    // TODO: We could probably be smarter about this
                    await this.regenerateAllLists();
                    return; // don't pass the update down - we will have already handled it in the regen
                }
                await this.handleRoomUpdate(updatedRoom, RoomUpdateCause.Timeline);
            };
            if (!room) {
                console.warn(`Live timeline event ${eventPayload.event.getId()} received without associated room`);
                console.warn(`Queuing failed room update for retry as a result.`);
                setTimeout(async () => {
                    const updatedRoom = this.matrixClient.getRoom(roomId);
                    await tryUpdate(updatedRoom);
                }, 100); // 100ms should be enough for the room to show up
                return;
            } else {
                await tryUpdate(room);
            }
        } else if (payload.action === 'MatrixActions.Event.decrypted') {
            const eventPayload = (<any>payload); // TODO: Type out the dispatcher types
            const roomId = eventPayload.event.getRoomId();
            const room = this.matrixClient.getRoom(roomId);
            if (!room) {
                console.warn(`Event ${eventPayload.event.getId()} was decrypted in an unknown room ${roomId}`);
                return;
            }
            console.log(`[RoomListDebug] Decrypted timeline event ${eventPayload.event.getId()} in ${roomId}`);
            // TODO: Check that e2e rooms are calculated correctly on initial load.
            // It seems like when viewing the room the timeline is decrypted, rather than at startup. This could
            // cause inaccuracies with the list ordering. We may have to decrypt the last N messages of every room :(
            await this.handleRoomUpdate(room, RoomUpdateCause.Timeline);
        } else if (payload.action === 'MatrixActions.accountData' && payload.event_type === 'm.direct') {
            const eventPayload = (<any>payload); // TODO: Type out the dispatcher types
            console.log(`[RoomListDebug] Received updated DM map`);
            const dmMap = eventPayload.event.getContent();
            for (const userId of Object.keys(dmMap)) {
                const roomIds = dmMap[userId];
                for (const roomId of roomIds) {
                    const room = this.matrixClient.getRoom(roomId);
                    if (!room) {
                        console.warn(`${roomId} was found in DMs but the room is not in the store`);
                        continue;
                    }

                    // We expect this RoomUpdateCause to no-op if there's no change, and we don't expect
                    // the user to have hundreds of rooms to update in one event. As such, we just hammer
                    // away at updates until the problem is solved. If we were expecting more than a couple
                    // of rooms to be updated at once, we would consider batching the rooms up.
                    await this.handleRoomUpdate(room, RoomUpdateCause.PossibleTagChange);
                }
            }
        } else if (payload.action === 'MatrixActions.Room.myMembership') {
            const membershipPayload = (<any>payload); // TODO: Type out the dispatcher types
            if (membershipPayload.oldMembership !== "join" && membershipPayload.membership === "join") {
                console.log(`[RoomListDebug] Handling new room ${membershipPayload.room.roomId}`);
                await this.algorithm.handleRoomUpdate(membershipPayload.room, RoomUpdateCause.NewRoom);
                return;
            }

            // If it's not a join, it's transitioning into a different list (possibly historical)
            if (membershipPayload.oldMembership !== membershipPayload.membership) {
                console.log(`[RoomListDebug] Handling membership change in ${membershipPayload.room.roomId}`);
                await this.algorithm.handleRoomUpdate(membershipPayload.room, RoomUpdateCause.PossibleTagChange);
                return;
            }
        }
    }

    private async handleRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<any> {
        const shouldUpdate = await this.algorithm.handleRoomUpdate(room, cause);
        if (shouldUpdate) {
            console.log(`[DEBUG] Room "${room.name}" (${room.roomId}) triggered by ${cause} requires list update`);
            this.emit(LISTS_UPDATE_EVENT, this);
        }
    }

    public async setTagSorting(tagId: TagID, sort: SortAlgorithm) {
        await this.algorithm.setTagSorting(tagId, sort);
        localStorage.setItem(`mx_tagSort_${tagId}`, sort);
    }

    public getTagSorting(tagId: TagID): SortAlgorithm {
        return this.algorithm.getTagSorting(tagId);
    }

    // noinspection JSMethodCanBeStatic
    private getStoredTagSorting(tagId: TagID): SortAlgorithm {
        return <SortAlgorithm>localStorage.getItem(`mx_tagSort_${tagId}`);
    }

    public async setListOrder(tagId: TagID, order: ListAlgorithm) {
        await this.algorithm.setListOrdering(tagId, order);
        localStorage.setItem(`mx_listOrder_${tagId}`, order);
    }

    public getListOrder(tagId: TagID): ListAlgorithm {
        return this.algorithm.getListOrdering(tagId);
    }

    // noinspection JSMethodCanBeStatic
    private getStoredListOrder(tagId: TagID): ListAlgorithm {
        return <ListAlgorithm>localStorage.getItem(`mx_listOrder_${tagId}`);
    }

    private async updateAlgorithmInstances() {
        const orderByImportance = SettingsStore.getValue("RoomList.orderByImportance");
        const orderAlphabetically = SettingsStore.getValue("RoomList.orderAlphabetically");

        const defaultSort = orderAlphabetically ? SortAlgorithm.Alphabetic : SortAlgorithm.Recent;
        const defaultOrder = orderByImportance ? ListAlgorithm.Importance : ListAlgorithm.Natural;

        for (const tag of Object.keys(this.orderedLists)) {
            const definedSort = this.getTagSorting(tag);
            const definedOrder = this.getListOrder(tag);

            const storedSort = this.getStoredTagSorting(tag);
            const storedOrder = this.getStoredListOrder(tag);

            const tagSort = storedSort ? storedSort : (definedSort ? definedSort : defaultSort);
            const listOrder = storedOrder ? storedOrder : (definedOrder ? definedOrder : defaultOrder);

            if (tagSort !== definedSort) {
                await this.setTagSorting(tag, tagSort);
            }
            if (listOrder !== definedOrder) {
                await this.setListOrder(tag, listOrder);
            }
        }
    }

    protected async updateState(newState: IState) {
        if (!this.enabled) return;

        await super.updateState(newState);
    }

    private onAlgorithmListUpdated = () => {
        console.log("Underlying algorithm has triggered a list update - refiring");
        this.emit(LISTS_UPDATE_EVENT, this);
    };

    private async regenerateAllLists() {
        console.warn("Regenerating all room lists");

        const sorts: ITagSortingMap = {};
        const orders: IListOrderingMap = {};
        for (const tagId of OrderedDefaultTagIDs) {
            sorts[tagId] = this.getStoredTagSorting(tagId) || SortAlgorithm.Alphabetic;
            orders[tagId] = this.getStoredListOrder(tagId) || ListAlgorithm.Natural;
        }

        if (this.state.tagsEnabled) {
            // TODO: Find a more reliable way to get tags (this doesn't work)
            const roomTags = TagOrderStore.getOrderedTags() || [];
            console.log("rtags", roomTags);
        }

        await this.algorithm.populateTags(sorts, orders);
        await this.algorithm.setKnownRooms(this.matrixClient.getVisibleRooms());

        this.initialListsGenerated = true;

        this.emit(LISTS_UPDATE_EVENT, this);
    }

    public addFilter(filter: IFilterCondition): void {
        console.log("Adding filter condition:", filter);
        this.filterConditions.push(filter);
        if (this.algorithm) {
            this.algorithm.addFilterCondition(filter);
        }
    }

    public removeFilter(filter: IFilterCondition): void {
        console.log("Removing filter condition:", filter);
        const idx = this.filterConditions.indexOf(filter);
        if (idx >= 0) {
            this.filterConditions.splice(idx, 1);

            if (this.algorithm) {
                this.algorithm.removeFilterCondition(filter);
            }
        }
    }
}

export default class RoomListStore {
    private static internalInstance: RoomListStore2;

    public static get instance(): RoomListStore2 {
        if (!RoomListStore.internalInstance) {
            RoomListStore.internalInstance = new RoomListStore2();
        }

        return RoomListStore.internalInstance;
    }
}

window.mx_RoomListStore2 = RoomListStore.instance;
