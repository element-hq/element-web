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

const INSPECIFIC_TAG = "INSPECIFIC_TAG";
type INSPECIFIC_TAG = "INSPECIFIC_TAG";

interface IState {}

export class RoomNotificationStateStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new RoomNotificationStateStore();

    private roomMap = new Map<Room, Map<TagID | INSPECIFIC_TAG, RoomNotificationState>>();

    private constructor() {
        super(defaultDispatcher, {});
    }

    /**
     * Creates a new list notification state. The consumer is expected to set the rooms
     * on the notification state, and destroy the state when it no longer needs it.
     * @param tagId The tag to create the notification state for.
     * @returns The notification state for the tag.
     */
    public getListState(tagId: TagID): ListNotificationState {
        // Note: we don't cache these notification states as the consumer is expected to call
        // .setRooms() on the returned object, which could confuse other consumers.

        // TODO: Update if/when invites move out of the room list.
        const useTileCount = tagId === DefaultTagID.Invite;
        const getRoomFn: FetchRoomFn = (room: Room) => {
            return this.getRoomState(room, tagId);
        };
        return new ListNotificationState(useTileCount, tagId, getRoomFn);
    }

    /**
     * Gets a copy of the notification state for a room. The consumer should not
     * attempt to destroy the returned state as it may be shared with other
     * consumers.
     * @param room The room to get the notification state for.
     * @param inTagId Optional tag ID to scope the notification state to.
     * @returns The room's notification state.
     */
    public getRoomState(room: Room, inTagId?: TagID): RoomNotificationState {
        if (!this.roomMap.has(room)) {
            this.roomMap.set(room, new Map<TagID | INSPECIFIC_TAG, RoomNotificationState>());
        }

        const targetTag = inTagId ? inTagId : INSPECIFIC_TAG;

        const forRoomMap = this.roomMap.get(room);
        if (!forRoomMap.has(targetTag)) {
            forRoomMap.set(inTagId ? inTagId : INSPECIFIC_TAG, new RoomNotificationState(room));
        }

        return forRoomMap.get(targetTag);
    }

    public static get instance(): RoomNotificationStateStore {
        return RoomNotificationStateStore.internalInstance;
    }

    protected async onNotReady(): Promise<any> {
        for (const roomMap of this.roomMap.values()) {
            for (const roomState of roomMap.values()) {
                roomState.destroy();
            }
        }
    }

    // We don't need this, but our contract says we do.
    protected async onAction(payload: ActionPayload) {
        return Promise.resolve();
    }
}
