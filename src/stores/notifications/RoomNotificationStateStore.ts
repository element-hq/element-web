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

import { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { DefaultTagID, TagID } from "../room-list/models";
import { FetchRoomFn, ListNotificationState } from "./ListNotificationState";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomNotificationState } from "./RoomNotificationState";
import { SummarizedNotificationState } from "./SummarizedNotificationState";

interface IState {}

export class RoomNotificationStateStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new RoomNotificationStateStore();

    private roomMap = new Map<Room, RoomNotificationState>();
    private listMap = new Map<TagID, ListNotificationState>();

    private constructor() {
        super(defaultDispatcher, {});
    }

    /**
     * Gets a snapshot of notification state for all visible rooms. The number of states recorded
     * on the SummarizedNotificationState is equivalent to rooms.
     */
    public get globalState(): SummarizedNotificationState {
        // If we're not ready yet, just return an empty state
        if (!this.matrixClient) return new SummarizedNotificationState();

        // Only count visible rooms to not torment the user with notification counts in rooms they can't see.
        // This will include highlights from the previous version of the room internally
        const globalState = new SummarizedNotificationState();
        for (const room of this.matrixClient.getVisibleRooms()) {
            globalState.add(this.getRoomState(room));
        }
        return globalState;
    }

    /**
     * Gets an instance of the list state class for the given tag.
     * @param tagId The tag to get the notification state for.
     * @returns The notification state for the tag.
     */
    public getListState(tagId: TagID): ListNotificationState {
        if (this.listMap.has(tagId)) {
            return this.listMap.get(tagId);
        }

        // TODO: Update if/when invites move out of the room list.
        const useTileCount = tagId === DefaultTagID.Invite;
        const getRoomFn: FetchRoomFn = (room: Room) => {
            return this.getRoomState(room);
        };
        const state = new ListNotificationState(useTileCount, tagId, getRoomFn);
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
        return this.roomMap.get(room);
    }

    public static get instance(): RoomNotificationStateStore {
        return RoomNotificationStateStore.internalInstance;
    }

    protected async onNotReady(): Promise<any> {
        for (const roomState of this.roomMap.values()) {
            roomState.destroy();
        }
    }

    // We don't need this, but our contract says we do.
    protected async onAction(payload: ActionPayload) {
        return Promise.resolve();
    }
}
