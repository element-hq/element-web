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
import { ActionPayload, defaultDispatcher } from "../../dispatcher-types";
import SettingsStore from "../../settings/SettingsStore";
import { DefaultTagID, OrderedDefaultTagIDs, TagID } from "./models";
import { IAlgorithm, ITagMap, ITagSortingMap, ListAlgorithm, SortAlgorithm } from "./algorithms/IAlgorithm";
import TagOrderStore from "../TagOrderStore";
import { getAlgorithmInstance } from "./algorithms";
import { AsyncStore } from "../AsyncStore";

interface IState {
    tagsEnabled?: boolean;

    preferredSort?: SortAlgorithm;
    preferredAlgorithm?: ListAlgorithm;
}

/**
 * The event/channel which is called when the room lists have been changed. Raised
 * with one argument: the instance of the store.
 */
export const LISTS_UPDATE_EVENT = "lists_update";

class _RoomListStore extends AsyncStore<ActionPayload> {
    private matrixClient: MatrixClient;
    private initialListsGenerated = false;
    private enabled = false;
    private algorithm: IAlgorithm;

    private readonly watchedSettings = [
        'RoomList.orderAlphabetically',
        'RoomList.orderByImportance',
        'feature_custom_tags',
    ];

    constructor() {
        super(defaultDispatcher);

        this.checkEnabled();
        for (const settingName of this.watchedSettings) SettingsStore.monitorSetting(settingName, null);
    }

    public get orderedLists(): ITagMap {
        if (!this.algorithm) return {}; // No tags yet.
        return this.algorithm.getOrderedRooms();
    }

    // TODO: Remove enabled flag when the old RoomListStore goes away
    private checkEnabled() {
        this.enabled = SettingsStore.isFeatureEnabled("feature_new_room_list");
        if (this.enabled) {
            console.log("ENABLING NEW ROOM LIST STORE");
        }
    }

    private async readAndCacheSettingsFromStore() {
        const tagsEnabled = SettingsStore.isFeatureEnabled("feature_custom_tags");
        const orderByImportance = SettingsStore.getValue("RoomList.orderByImportance");
        const orderAlphabetically = SettingsStore.getValue("RoomList.orderAlphabetically");
        await this.updateState({
            tagsEnabled,
            preferredSort: orderAlphabetically ? SortAlgorithm.Alphabetic : SortAlgorithm.Recent,
            preferredAlgorithm: orderByImportance ? ListAlgorithm.Importance : ListAlgorithm.Natural,
        });
        this.setAlgorithmClass();
    }

    protected async onDispatch(payload: ActionPayload) {
        if (payload.action === 'MatrixActions.sync') {
            // Filter out anything that isn't the first PREPARED sync.
            if (!(payload.prevState === 'PREPARED' && payload.state !== 'PREPARED')) {
                return;
            }

            // TODO: Remove this once the RoomListStore becomes default
            this.checkEnabled();
            if (!this.enabled) return;

            this.matrixClient = payload.matrixClient;

            // Update any settings here, as some may have happened before we were logically ready.
            console.log("Regenerating room lists: Startup");
            await this.readAndCacheSettingsFromStore();
            await this.regenerateAllLists();
        }

        // TODO: Remove this once the RoomListStore becomes default
        if (!this.enabled) return;

        if (payload.action === 'on_client_not_viable' || payload.action === 'on_logged_out') {
            // Reset state without causing updates as the client will have been destroyed
            // and downstream code will throw NPE errors.
            this.reset(null, true);
            this.matrixClient = null;
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
        } else if (payload.action === 'MatrixActions.Room.receipt') {
            // First see if the receipt event is for our own user. If it was, trigger
            // a room update (we probably read the room on a different device).
            // noinspection JSObjectNullOrUndefined - this.matrixClient can't be null by this point in the lifecycle
            const myUserId = this.matrixClient.getUserId();
            for (const eventId of Object.keys(payload.event.getContent())) {
                const receiptUsers = Object.keys(payload.event.getContent()[eventId]['m.read'] || {});
                if (receiptUsers.includes(myUserId)) {
                    // TODO: Update room now that it's been read
                    return;
                }
            }
        } else if (payload.action === 'MatrixActions.Room.tags') {
            // TODO: Update room from tags
        } else if (payload.action === 'MatrixActions.room.timeline') {
            // TODO: Update room from new events
        } else if (payload.action === 'MatrixActions.Event.decrypted') {
            // TODO: Update room from decrypted event
        } else if (payload.action === 'MatrixActions.accountData' && payload.event_type === 'm.direct') {
            // TODO: Update DMs
        } else if (payload.action === 'MatrixActions.Room.myMembership') {
            // TODO: Update room from membership change
        } else if (payload.action === 'MatrixActions.room') {
            // TODO: Update room from creation/join
        } else if (payload.action === 'view_room') {
            // TODO: Update sticky room
        }
    }

    private getSortAlgorithmFor(tagId: TagID): SortAlgorithm {
        switch (tagId) {
            case DefaultTagID.Invite:
            case DefaultTagID.Untagged:
            case DefaultTagID.Archived:
            case DefaultTagID.LowPriority:
            case DefaultTagID.DM:
                return this.state.preferredSort;
            case DefaultTagID.Favourite:
            default:
                return SortAlgorithm.Manual;
        }
    }

    protected async updateState(newState: IState) {
        if (!this.enabled) return;

        await super.updateState(newState);
    }

    private setAlgorithmClass() {
        this.algorithm = getAlgorithmInstance(this.state.preferredAlgorithm);
    }

    private async regenerateAllLists() {
        console.warn("Regenerating all room lists");
        const tags: ITagSortingMap = {};
        for (const tagId of OrderedDefaultTagIDs) {
            tags[tagId] = this.getSortAlgorithmFor(tagId);
        }

        if (this.state.tagsEnabled) {
            // TODO: Find a more reliable way to get tags
            const roomTags = TagOrderStore.getOrderedTags() || [];
            console.log("rtags", roomTags);
        }

        await this.algorithm.populateTags(tags);
        await this.algorithm.setKnownRooms(this.matrixClient.getRooms());

        this.initialListsGenerated = true;

        this.emit(LISTS_UPDATE_EVENT, this);
    }
}

export default class RoomListStore {
    private static internalInstance: _RoomListStore;

    public static get instance(): _RoomListStore {
        if (!RoomListStore.internalInstance) {
            RoomListStore.internalInstance = new _RoomListStore();
        }

        return RoomListStore.internalInstance;
    }
}
