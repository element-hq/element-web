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

import RoomListStoreV3, { RoomListStoreV3Event } from "../stores/room-list-v3/RoomListStoreV3";
import { Room as ModuleRoom } from "./models/Room";

export class RoomListStoreApi implements IRoomListStore {
    public getRooms(): RoomsWatchable {
        return new RoomsWatchable(this.roomListStore);
    }

    private get roomListStore(): RoomListStoreV3 {
        if (!this.rls) {
            throw new Error("rls is undefined, did you forget to await waitForReady()?");
        }
        return this.rls;
    }

    public async waitForReady(): Promise<void> {
        // Check if RLS is already loaded
        if (!this.roomListStore.isLoadingRooms) return;

        // Await a promise that resolves when RLS has loaded
        const { promise, resolve } = Promise.withResolvers<void>();
        this.roomListStore.once(RoomListStoreV3Event.ListsLoaded, resolve);
        await promise;
    }
}

class RoomsWatchable extends Watchable<Room[]> {
    public constructor(private readonly rls: RoomListStoreV3) {
        super(rls.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom)));
    }

    private onRlsUpdate = (): void => {
        this.value = this.rls.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom));
    };

    protected onFirstWatch(): void {
        this.rls.on(RoomListStoreV3Event.ListsUpdate, this.onRlsUpdate);
    }

    protected onLastWatch(): void {
        this.rls.off(RoomListStoreV3Event.ListsLoaded, this.onRlsUpdate);
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
