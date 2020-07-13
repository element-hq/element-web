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
import { DefaultTagID, OrderedDefaultTagIDs, RoomUpdateCause, TagID } from "./models";
import TagOrderStore from "../TagOrderStore";
import { AsyncStore } from "../AsyncStore";
import { Room } from "matrix-js-sdk/src/models/room";
import { IListOrderingMap, ITagMap, ITagSortingMap, ListAlgorithm, SortAlgorithm } from "./algorithms/models";
import { ActionPayload } from "../../dispatcher/payloads";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { readReceiptChangeIsFor } from "../../utils/read-receipts";
import { FILTER_CHANGED, IFilterCondition } from "./filters/IFilterCondition";
import { TagWatcher } from "./TagWatcher";
import RoomViewStore from "../RoomViewStore";
import { Algorithm, LIST_UPDATED_EVENT } from "./algorithms/Algorithm";
import { EffectiveMembership, getEffectiveMembership } from "./membership";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import RoomListLayoutStore from "./RoomListLayoutStore";
import { MarkedExecution } from "../../utils/MarkedExecution";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";

interface IState {
    tagsEnabled?: boolean;
}

/**
 * The event/channel which is called when the room lists have been changed. Raised
 * with one argument: the instance of the store.
 */
export const LISTS_UPDATE_EVENT = "lists_update";

export class RoomListStore2 extends AsyncStoreWithClient<ActionPayload> {
    /**
     * Set to true if you're running tests on the store. Should not be touched in
     * any other environment.
     */
    public static TEST_MODE = false;

    private initialListsGenerated = false;
    private enabled = false;
    private algorithm = new Algorithm();
    private filterConditions: IFilterCondition[] = [];
    private tagWatcher = new TagWatcher(this);
    private updateFn = new MarkedExecution(() => this.emit(LISTS_UPDATE_EVENT));

    private readonly watchedSettings = [
        'feature_custom_tags',
    ];

    constructor() {
        super(defaultDispatcher);

        this.checkEnabled();
        for (const settingName of this.watchedSettings) SettingsStore.monitorSetting(settingName, null);
        RoomViewStore.addListener(() => this.handleRVSUpdate({}));
        this.algorithm.on(LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
        this.algorithm.on(FILTER_CHANGED, this.onAlgorithmFilterUpdated);
    }

    public get orderedLists(): ITagMap {
        if (!this.algorithm) return {}; // No tags yet.
        return this.algorithm.getOrderedRooms();
    }

    public get matrixClient(): MatrixClient {
        return super.matrixClient;
    }

    // Intended for test usage
    public async resetStore() {
        await this.reset();
        this.tagWatcher = new TagWatcher(this);
        this.filterConditions = [];
        this.initialListsGenerated = false;

        this.algorithm.off(LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
        this.algorithm.off(FILTER_CHANGED, this.onAlgorithmListUpdated);
        this.algorithm = new Algorithm();
        this.algorithm.on(LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
        this.algorithm.on(FILTER_CHANGED, this.onAlgorithmListUpdated);

        // Reset state without causing updates as the client will have been destroyed
        // and downstream code will throw NPE errors.
        await this.reset(null, true);
    }

    // Public for test usage. Do not call this.
    public async makeReady(forcedClient?: MatrixClient) {
        if (forcedClient) {
            super.matrixClient = forcedClient;
        }

        // TODO: Remove with https://github.com/vector-im/riot-web/issues/14367
        this.checkEnabled();
        if (!this.enabled) return;

        // Update any settings here, as some may have happened before we were logically ready.
        // Update any settings here, as some may have happened before we were logically ready.
        console.log("Regenerating room lists: Startup");
        await this.readAndCacheSettingsFromStore();
        await this.regenerateAllLists({trigger: false});
        await this.handleRVSUpdate({trigger: false}); // fake an RVS update to adjust sticky room, if needed

        this.updateFn.mark(); // we almost certainly want to trigger an update.
        this.updateFn.trigger();
    }

    // TODO: Remove enabled flag with the old RoomListStore: https://github.com/vector-im/riot-web/issues/14367
    private checkEnabled() {
        this.enabled = SettingsStore.getValue("feature_new_room_list");
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

    /**
     * Handles suspected RoomViewStore changes.
     * @param trigger Set to false to prevent a list update from being sent. Should only
     * be used if the calling code will manually trigger the update.
     */
    private async handleRVSUpdate({trigger = true}) {
        if (!this.enabled) return; // TODO: Remove with https://github.com/vector-im/riot-web/issues/14367
        if (!this.matrixClient) return; // We assume there won't be RVS updates without a client

        const activeRoomId = RoomViewStore.getRoomId();
        if (!activeRoomId && this.algorithm.stickyRoom) {
            await this.algorithm.setStickyRoom(null);
        } else if (activeRoomId) {
            const activeRoom = this.matrixClient.getRoom(activeRoomId);
            if (!activeRoom) {
                console.warn(`${activeRoomId} is current in RVS but missing from client - clearing sticky room`);
                await this.algorithm.setStickyRoom(null);
            } else if (activeRoom !== this.algorithm.stickyRoom) {
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`Changing sticky room to ${activeRoomId}`);
                }
                await this.algorithm.setStickyRoom(activeRoom);
            }
        }

        if (trigger) this.updateFn.trigger();
    }

    protected async onReady(): Promise<any> {
        await this.makeReady();
    }

    protected async onNotReady(): Promise<any> {
        await this.resetStore();
    }

    protected async onAction(payload: ActionPayload) {
        // When we're running tests we can't reliably use setImmediate out of timing concerns.
        // As such, we use a more synchronous model.
        if (RoomListStore2.TEST_MODE) {
            await this.onDispatchAsync(payload);
            return;
        }

        // We do this to intentionally break out of the current event loop task, allowing
        // us to instead wait for a more convenient time to run our updates.
        setImmediate(() => this.onDispatchAsync(payload));
    }

    protected async onDispatchAsync(payload: ActionPayload) {
        // TODO: Remove this once the RoomListStore becomes default
        if (!this.enabled) return;

        // Everything here requires a MatrixClient or some sort of logical readiness.
        const logicallyReady = this.matrixClient && this.initialListsGenerated;
        if (!logicallyReady) return;

        if (payload.action === 'setting_updated') {
            if (this.watchedSettings.includes(payload.settingName)) {
                console.log("Regenerating room lists: Settings changed");
                await this.readAndCacheSettingsFromStore();

                await this.regenerateAllLists({trigger: false}); // regenerate the lists now
                this.updateFn.trigger();
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
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Got own read receipt in ${room.roomId}`);
                }
                await this.handleRoomUpdate(room, RoomUpdateCause.ReadReceipt);
                this.updateFn.trigger();
                return;
            }
        } else if (payload.action === 'MatrixActions.Room.tags') {
            const roomPayload = (<any>payload); // TODO: Type out the dispatcher types
            if (!window.mx_QuietRoomListLogging) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                console.log(`[RoomListDebug] Got tag change in ${roomPayload.room.roomId}`);
            }
            await this.handleRoomUpdate(roomPayload.room, RoomUpdateCause.PossibleTagChange);
            this.updateFn.trigger();
        } else if (payload.action === 'MatrixActions.Room.timeline') {
            const eventPayload = (<any>payload); // TODO: Type out the dispatcher types

            // Ignore non-live events (backfill)
            if (!eventPayload.isLiveEvent || !payload.isLiveUnfilteredRoomTimelineEvent) return;

            const roomId = eventPayload.event.getRoomId();
            const room = this.matrixClient.getRoom(roomId);
            const tryUpdate = async (updatedRoom: Room) => {
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Live timeline event ${eventPayload.event.getId()}` +
                        ` in ${updatedRoom.roomId}`);
                }
                if (eventPayload.event.getType() === 'm.room.tombstone' && eventPayload.event.getStateKey() === '') {
                    if (!window.mx_QuietRoomListLogging) {
                        // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                        console.log(`[RoomListDebug] Got tombstone event - trying to remove now-dead room`);
                    }
                    const newRoom = this.matrixClient.getRoom(eventPayload.event.getContent()['replacement_room']);
                    if (newRoom) {
                        // If we have the new room, then the new room check will have seen the predecessor
                        // and did the required updates, so do nothing here.
                        return;
                    }
                }
                await this.handleRoomUpdate(updatedRoom, RoomUpdateCause.Timeline);
                this.updateFn.trigger();
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
            if (!window.mx_QuietRoomListLogging) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                console.log(`[RoomListDebug] Decrypted timeline event ${eventPayload.event.getId()} in ${roomId}`);
            }
            await this.handleRoomUpdate(room, RoomUpdateCause.Timeline);
            this.updateFn.trigger();
        } else if (payload.action === 'MatrixActions.accountData' && payload.event_type === 'm.direct') {
            const eventPayload = (<any>payload); // TODO: Type out the dispatcher types
            if (!window.mx_QuietRoomListLogging) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                console.log(`[RoomListDebug] Received updated DM map`);
            }
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
            this.updateFn.trigger();
        } else if (payload.action === 'MatrixActions.Room.myMembership') {
            const membershipPayload = (<any>payload); // TODO: Type out the dispatcher types
            const oldMembership = getEffectiveMembership(membershipPayload.oldMembership);
            const newMembership = getEffectiveMembership(membershipPayload.membership);
            if (oldMembership !== EffectiveMembership.Join && newMembership === EffectiveMembership.Join) {
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Handling new room ${membershipPayload.room.roomId}`);
                }

                // If we're joining an upgraded room, we'll want to make sure we don't proliferate
                // the dead room in the list.
                const createEvent = membershipPayload.room.currentState.getStateEvents("m.room.create", "");
                if (createEvent && createEvent.getContent()['predecessor']) {
                    if (!window.mx_QuietRoomListLogging) {
                        // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                        console.log(`[RoomListDebug] Room has a predecessor`);
                    }
                    const prevRoom = this.matrixClient.getRoom(createEvent.getContent()['predecessor']['room_id']);
                    if (prevRoom) {
                        const isSticky = this.algorithm.stickyRoom === prevRoom;
                        if (isSticky) {
                            if (!window.mx_QuietRoomListLogging) {
                                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                                console.log(`[RoomListDebug] Clearing sticky room due to room upgrade`);
                            }
                            await this.algorithm.setStickyRoom(null);
                        }

                        // Note: we hit the algorithm instead of our handleRoomUpdate() function to
                        // avoid redundant updates.
                        if (!window.mx_QuietRoomListLogging) {
                            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                            console.log(`[RoomListDebug] Removing previous room from room list`);
                        }
                        await this.algorithm.handleRoomUpdate(prevRoom, RoomUpdateCause.RoomRemoved);
                    }
                }

                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Adding new room to room list`);
                }
                await this.handleRoomUpdate(membershipPayload.room, RoomUpdateCause.NewRoom);
                this.updateFn.trigger();
                return;
            }

            if (oldMembership !== EffectiveMembership.Invite && newMembership === EffectiveMembership.Invite) {
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Handling invite to ${membershipPayload.room.roomId}`);
                }
                await this.handleRoomUpdate(membershipPayload.room, RoomUpdateCause.NewRoom);
                this.updateFn.trigger();
                return;
            }

            // If it's not a join, it's transitioning into a different list (possibly historical)
            if (oldMembership !== newMembership) {
                if (!window.mx_QuietRoomListLogging) {
                    // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                    console.log(`[RoomListDebug] Handling membership change in ${membershipPayload.room.roomId}`);
                }
                await this.handleRoomUpdate(membershipPayload.room, RoomUpdateCause.PossibleTagChange);
                this.updateFn.trigger();
                return;
            }
        }
    }

    private async handleRoomUpdate(room: Room, cause: RoomUpdateCause): Promise<any> {
        const shouldUpdate = await this.algorithm.handleRoomUpdate(room, cause);
        if (shouldUpdate) {
            if (!window.mx_QuietRoomListLogging) {
                // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
                console.log(`[DEBUG] Room "${room.name}" (${room.roomId}) triggered by ${cause} requires list update`);
            }
            this.updateFn.mark();
        }
    }

    public async setTagSorting(tagId: TagID, sort: SortAlgorithm) {
        await this.setAndPersistTagSorting(tagId, sort);
        this.updateFn.trigger();
    }

    private async setAndPersistTagSorting(tagId: TagID, sort: SortAlgorithm) {
        await this.algorithm.setTagSorting(tagId, sort);
        // TODO: Per-account? https://github.com/vector-im/riot-web/issues/14114
        localStorage.setItem(`mx_tagSort_${tagId}`, sort);
    }

    public getTagSorting(tagId: TagID): SortAlgorithm {
        return this.algorithm.getTagSorting(tagId);
    }

    // noinspection JSMethodCanBeStatic
    private getStoredTagSorting(tagId: TagID): SortAlgorithm {
        // TODO: Per-account? https://github.com/vector-im/riot-web/issues/14114
        return <SortAlgorithm>localStorage.getItem(`mx_tagSort_${tagId}`);
    }

    // logic must match calculateListOrder
    private calculateTagSorting(tagId: TagID): SortAlgorithm {
        const isDefaultRecent = tagId === DefaultTagID.Invite || tagId === DefaultTagID.DM;
        const defaultSort = isDefaultRecent ? SortAlgorithm.Recent : SortAlgorithm.Alphabetic;
        const settingAlphabetical = SettingsStore.getValue("RoomList.orderAlphabetically", null, true);
        const definedSort = this.getTagSorting(tagId);
        const storedSort = this.getStoredTagSorting(tagId);

        // We use the following order to determine which of the 4 flags to use:
        // Stored > Settings > Defined > Default

        let tagSort = defaultSort;
        if (storedSort) {
            tagSort = storedSort;
        } else if (!isNullOrUndefined(settingAlphabetical)) {
            tagSort = settingAlphabetical ? SortAlgorithm.Alphabetic : SortAlgorithm.Recent;
        } else if (definedSort) {
            tagSort = definedSort;
        } // else default (already set)

        return tagSort;
    }

    public async setListOrder(tagId: TagID, order: ListAlgorithm) {
        await this.setAndPersistListOrder(tagId, order);
        this.updateFn.trigger();
    }

    private async setAndPersistListOrder(tagId: TagID, order: ListAlgorithm) {
        await this.algorithm.setListOrdering(tagId, order);
        // TODO: Per-account? https://github.com/vector-im/riot-web/issues/14114
        localStorage.setItem(`mx_listOrder_${tagId}`, order);
    }

    public getListOrder(tagId: TagID): ListAlgorithm {
        return this.algorithm.getListOrdering(tagId);
    }

    // noinspection JSMethodCanBeStatic
    private getStoredListOrder(tagId: TagID): ListAlgorithm {
        // TODO: Per-account? https://github.com/vector-im/riot-web/issues/14114
        return <ListAlgorithm>localStorage.getItem(`mx_listOrder_${tagId}`);
    }

    // logic must match calculateTagSorting
    private calculateListOrder(tagId: TagID): ListAlgorithm {
        const defaultOrder = ListAlgorithm.Natural;
        const settingImportance = SettingsStore.getValue("RoomList.orderByImportance", null, true);
        const definedOrder = this.getListOrder(tagId);
        const storedOrder = this.getStoredListOrder(tagId);

        // We use the following order to determine which of the 4 flags to use:
        // Stored > Settings > Defined > Default

        let listOrder = defaultOrder;
        if (storedOrder) {
            listOrder = storedOrder;
        } else if (!isNullOrUndefined(settingImportance)) {
            listOrder = settingImportance ? ListAlgorithm.Importance : ListAlgorithm.Natural;
        } else if (definedOrder) {
            listOrder = definedOrder;
        } // else default (already set)

        return listOrder;
    }

    private async updateAlgorithmInstances() {
        // We'll require an update, so mark for one. Marking now also prevents the calls
        // to setTagSorting and setListOrder from causing triggers.
        this.updateFn.mark();

        for (const tag of Object.keys(this.orderedLists)) {
            const definedSort = this.getTagSorting(tag);
            const definedOrder = this.getListOrder(tag);

            const tagSort = this.calculateTagSorting(tag);
            const listOrder = this.calculateListOrder(tag);

            if (tagSort !== definedSort) {
                await this.setAndPersistTagSorting(tag, tagSort);
            }
            if (listOrder !== definedOrder) {
                await this.setAndPersistListOrder(tag, listOrder);
            }
        }
    }

    protected async updateState(newState: IState) {
        if (!this.enabled) return;

        await super.updateState(newState);
    }

    private onAlgorithmListUpdated = () => {
        if (!window.mx_QuietRoomListLogging) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
            console.log("Underlying algorithm has triggered a list update - marking");
        }
        this.updateFn.mark();
    };

    private onAlgorithmFilterUpdated = () => {
        // The filter can happen off-cycle, so trigger an update. The filter will have
        // already caused a mark.
        this.updateFn.trigger();
    };

    /**
     * Regenerates the room whole room list, discarding any previous results.
     *
     * Note: This is only exposed externally for the tests. Do not call this from within
     * the app.
     * @param trigger Set to false to prevent a list update from being sent. Should only
     * be used if the calling code will manually trigger the update.
     */
    public async regenerateAllLists({trigger = true}) {
        console.warn("Regenerating all room lists");

        const sorts: ITagSortingMap = {};
        const orders: IListOrderingMap = {};
        for (const tagId of OrderedDefaultTagIDs) {
            sorts[tagId] = this.calculateTagSorting(tagId);
            orders[tagId] = this.calculateListOrder(tagId);

            RoomListLayoutStore.instance.ensureLayoutExists(tagId);
        }

        if (this.state.tagsEnabled) {
            // TODO: Fix custom tags: https://github.com/vector-im/riot-web/issues/14091
            const roomTags = TagOrderStore.getOrderedTags() || [];

            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
            console.log("rtags", roomTags);
        }

        await this.algorithm.populateTags(sorts, orders);
        await this.algorithm.setKnownRooms(this.matrixClient.getVisibleRooms());

        this.initialListsGenerated = true;

        if (trigger) this.updateFn.trigger();
    }

    public addFilter(filter: IFilterCondition): void {
        if (!window.mx_QuietRoomListLogging) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
            console.log("Adding filter condition:", filter);
        }
        this.filterConditions.push(filter);
        if (this.algorithm) {
            this.algorithm.addFilterCondition(filter);
        }
        this.updateFn.trigger();
    }

    public removeFilter(filter: IFilterCondition): void {
        if (!window.mx_QuietRoomListLogging) {
            // TODO: Remove debug: https://github.com/vector-im/riot-web/issues/14035
            console.log("Removing filter condition:", filter);
        }
        const idx = this.filterConditions.indexOf(filter);
        if (idx >= 0) {
            this.filterConditions.splice(idx, 1);

            if (this.algorithm) {
                this.algorithm.removeFilterCondition(filter);
            }
        }
        this.updateFn.trigger();
    }

    /**
     * Gets the tags for a room identified by the store. The returned set
     * should never be empty, and will contain DefaultTagID.Untagged if
     * the store is not aware of any tags.
     * @param room The room to get the tags for.
     * @returns The tags for the room.
     */
    public getTagsForRoom(room: Room): TagID[] {
        const algorithmTags = this.algorithm.getTagsForRoom(room);
        if (!algorithmTags) return [DefaultTagID.Untagged];
        return algorithmTags;
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
