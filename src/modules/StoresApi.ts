/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {
    type StoresApi as IStoresApi,
    type RoomListStoreApi as IRoomListStore,
    type Room,
    Watchable,
} from "@element-hq/element-web-module-api";

import RoomListStoreV3, { LISTS_LOADED_EVENT, LISTS_UPDATE_EVENT } from "../stores/room-list-v3/RoomListStoreV3";
import { Room as ModuleRoom } from "./models/Room";

class RoomListStoreApi implements IRoomListStore {
    public getRooms(): RoomsWatchable {
        return new RoomsWatchable();
    }

    public async waitForReady(): Promise<void> {
        // Check if RLS is already loaded
        if (!RoomListStoreV3.instance.isLoadingRooms) return;

        // Return a promise that resolves when RLS has loaded
        let resolve: () => void;
        const promise: Promise<void> = new Promise((_resolve) => {
            resolve = _resolve;
        });
        RoomListStoreV3.instance.once(LISTS_LOADED_EVENT, () => {
            resolve();
        });
        return promise;
    }
}

class RoomsWatchable extends Watchable<Room[]> {
    public constructor() {
        super(RoomListStoreV3.instance.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom)));
    }

    private onRlsUpdate = (): void => {
        this.value = RoomListStoreV3.instance.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom));
    };

    protected onFirstWatch(): void {
        RoomListStoreV3.instance.on(LISTS_UPDATE_EVENT, this.onRlsUpdate);
    }

    protected onLastWatch(): void {
        RoomListStoreV3.instance.off(LISTS_UPDATE_EVENT, this.onRlsUpdate);
    }
}

export class StoresApi implements IStoresApi {
    private roomListStoreApi?: IRoomListStore;

    public get roomListStore(): IRoomListStore {
        if (!this.roomListStoreApi) {
            this.roomListStoreApi = new RoomListStoreApi();
        }
        return this.roomListStoreApi;
    }
}
