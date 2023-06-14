/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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
import { SyncState } from "matrix-js-sdk/src/sync";
import { ClientEvent } from "matrix-js-sdk/src/client";

import { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher, { MatrixDispatcher } from "../../dispatcher/dispatcher";
import { DefaultTagID, TagID } from "../room-list/models";
import { FetchRoomFn, ListNotificationState } from "./ListNotificationState";
import { RoomNotificationState } from "./RoomNotificationState";
import { SummarizedNotificationState } from "./SummarizedNotificationState";
import { VisibilityProvider } from "../room-list/filters/VisibilityProvider";
import { PosthogAnalytics } from "../../PosthogAnalytics";
import SettingsStore from "../../settings/SettingsStore";

interface IState {}

export const UPDATE_STATUS_INDICATOR = Symbol("update-status-indicator");

export class RoomNotificationStateStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new RoomNotificationStateStore();
        instance.start();
        return instance;
    })();
    private roomMap = new Map<Room, RoomNotificationState>();

    private listMap = new Map<TagID, ListNotificationState>();
    private _globalState = new SummarizedNotificationState();

    private constructor(dispatcher = defaultDispatcher) {
        super(dispatcher, {});
        SettingsStore.watchSetting("feature_dynamic_room_predecessors", null, () => {
            // We pass SyncState.Syncing here to "simulate" a sync happening.
            // The code that receives these events actually doesn't care
            // what state we pass, except that it behaves differently if we
            // pass SyncState.Error.
            this.emitUpdateIfStateChanged(SyncState.Syncing, false);
        });
    }

    /**
     * @internal Public for test only
     */
    public static testInstance(dispatcher: MatrixDispatcher): RoomNotificationStateStore {
        return new RoomNotificationStateStore();
    }

    /**
     * Gets a snapshot of notification state for all visible rooms. The number of states recorded
     * on the SummarizedNotificationState is equivalent to rooms.
     */
    public get globalState(): SummarizedNotificationState {
        return this._globalState;
    }

    /**
     * Gets an instance of the list state class for the given tag.
     * @param tagId The tag to get the notification state for.
     * @returns The notification state for the tag.
     */
    public getListState(tagId: TagID): ListNotificationState {
        if (this.listMap.has(tagId)) {
            return this.listMap.get(tagId)!;
        }

        // TODO: Update if/when invites move out of the room list.
        const useTileCount = tagId === DefaultTagID.Invite;
        const getRoomFn: FetchRoomFn = (room: Room) => {
            return this.getRoomState(room);
        };
        const state = new ListNotificationState(useTileCount, getRoomFn);
        this.listMap.set(tagId, state);
        return state;
    }

    /**
     * Gets a copy of the notification state for a room. The consumer should not
     * attempt to destroy the returned state as it may be shared with other
     * consumers.
     * @param room The room to get the notification state for.
     * @returns The room's notification state.
     */
    public getRoomState(room: Room): RoomNotificationState {
        if (!this.roomMap.has(room)) {
            this.roomMap.set(room, new RoomNotificationState(room));
        }
        return this.roomMap.get(room)!;
    }

    public static get instance(): RoomNotificationStateStore {
        return RoomNotificationStateStore.internalInstance;
    }

    private onSync = (state: SyncState, prevState: SyncState | null): void => {
        this.emitUpdateIfStateChanged(state, state !== prevState);
    };

    /**
     * If the SummarizedNotificationState of this room has changed, or forceEmit
     * is true, emit an UPDATE_STATUS_INDICATOR event.
     *
     * @internal public for test
     */
    public emitUpdateIfStateChanged = (state: SyncState, forceEmit: boolean): void => {
        if (!this.matrixClient) return;
        // Only count visible rooms to not torment the user with notification counts in rooms they can't see.
        // This will include highlights from the previous version of the room internally
        const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
        const globalState = new SummarizedNotificationState();
        const visibleRooms = this.matrixClient.getVisibleRooms(msc3946ProcessDynamicPredecessor);

        let numFavourites = 0;
        for (const room of visibleRooms) {
            if (VisibilityProvider.instance.isRoomVisible(room)) {
                globalState.add(this.getRoomState(room));

                if (room.tags[DefaultTagID.Favourite] && !room.getType()) numFavourites++;
            }
        }

        PosthogAnalytics.instance.setProperty("numFavouriteRooms", numFavourites);

        if (
            this.globalState.symbol !== globalState.symbol ||
            this.globalState.count !== globalState.count ||
            this.globalState.color !== globalState.color ||
            this.globalState.numUnreadStates !== globalState.numUnreadStates ||
            forceEmit
        ) {
            this._globalState = globalState;
            this.emit(UPDATE_STATUS_INDICATOR, globalState, state);
        }
    };

    protected async onReady(): Promise<void> {
        this.matrixClient?.on(ClientEvent.Sync, this.onSync);
    }

    protected async onNotReady(): Promise<any> {
        this.matrixClient?.off(ClientEvent.Sync, this.onSync);
        for (const roomState of this.roomMap.values()) {
            roomState.destroy();
        }
    }

    // We don't need this, but our contract says we do.
    protected async onAction(payload: ActionPayload): Promise<void> {}
}
