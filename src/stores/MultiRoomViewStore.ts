/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { RoomViewStore } from "./RoomViewStore";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";
import { type SdkContextClass } from "../contexts/SDKContext";
import { Action } from "../dispatcher/actions";

/**
 * Acts as a cache of many RoomViewStore instances, creating them as necessary
 * given a room ID.
 */
export class MultiRoomViewStore {
    /**
     * Map from room-id to RVS instance.
     */
    private stores: Map<string, RoomViewStore> = new Map();

    public constructor(
        private dispatcher: MatrixDispatcher,
        private sdkContextClass: SdkContextClass,
    ) {}

    /**
     * Get a RVS instance for the room identified by the given roomId.
     */
    public getRoomViewStoreForRoom(roomId: string): RoomViewStore {
        // Get existing store / create new store
        const store = this.stores.has(roomId)
            ? this.stores.get(roomId)!
            : new RoomViewStore(this.dispatcher, this.sdkContextClass, roomId);

        // RoomView component does not render the room unless you call viewRoom
        store.viewRoom({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: undefined,
        });

        // Cache the store, okay to do even if the store is already in the map
        this.stores.set(roomId, store);

        return store;
    }

    /**
     * Remove a RVS instance that was created by {@link getRoomViewStoreForRoom}.
     */
    public removeRoomViewStore(roomId: string): void {
        const didRemove = this.stores.delete(roomId);
        if (!didRemove) {
            logger.warn(`removeRoomViewStore called with ${roomId} but no store exists for this room.`);
        }
    }

    public dispose(): void {
        for (const id of this.stores.keys()) {
            this.removeRoomViewStore(id);
        }
    }
}
