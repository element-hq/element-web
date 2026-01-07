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

import type { RoomListStoreV3Class, RoomListStoreV3Event } from "../stores/room-list-v3/RoomListStoreV3";
import { Room as ModuleRoom } from "./models/Room";

interface RlsEvents {
    LISTS_LOADED_EVENT: RoomListStoreV3Event.ListsLoaded;
    LISTS_UPDATE_EVENT: RoomListStoreV3Event.ListsUpdate;
}

export class RoomListStoreApi implements IRoomListStore {
    private rls?: RoomListStoreV3Class;
    private LISTS_LOADED_EVENT?: RoomListStoreV3Event.ListsLoaded;
    private LISTS_UPDATE_EVENT?: RoomListStoreV3Event.ListsUpdate;
    public readonly moduleLoadPromise: Promise<void>;

    public constructor() {
        this.moduleLoadPromise = this.init();
    }

    /**
     * Load the RLS through a dynamic import. This is necessary to prevent
     * circular dependency issues.
     */
    private async init(): Promise<void> {
        const module = await import("../stores/room-list-v3/RoomListStoreV3");
        this.rls = module.default.instance;
        this.LISTS_LOADED_EVENT = module.LISTS_LOADED_EVENT;
        this.LISTS_UPDATE_EVENT = module.LISTS_UPDATE_EVENT;
    }

    public getRooms(): RoomsWatchable {
        return new RoomsWatchable(this.roomListStore, this.events);
    }

    private get events(): RlsEvents {
        if (!this.LISTS_LOADED_EVENT || !this.LISTS_UPDATE_EVENT) {
            throw new Error("Event type was not loaded correctly, did you forget to await waitForReady()?");
        }
        return { LISTS_LOADED_EVENT: this.LISTS_LOADED_EVENT, LISTS_UPDATE_EVENT: this.LISTS_UPDATE_EVENT };
    }

    private get roomListStore(): RoomListStoreV3Class {
        if (!this.rls) {
            throw new Error("rls is undefined, did you forget to await waitForReady()?");
        }
        return this.rls;
    }

    public async waitForReady(): Promise<void> {
        // Wait for the module to load first
        await this.moduleLoadPromise;

        // Check if RLS is already loaded
        if (!this.roomListStore.isLoadingRooms) return;

        // Await a promise that resolves when RLS has loaded
        const { promise, resolve } = Promise.withResolvers<void>();
        const { LISTS_LOADED_EVENT } = this.events;
        this.roomListStore.once(LISTS_LOADED_EVENT, resolve);
        await promise;
    }
}

class RoomsWatchable extends Watchable<Room[]> {
    public constructor(
        private readonly rls: RoomListStoreV3Class,
        private readonly events: RlsEvents,
    ) {
        super(rls.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom)));
    }

    private onRlsUpdate = (): void => {
        this.value = this.rls.getSortedRooms().map((sdkRoom) => new ModuleRoom(sdkRoom));
    };

    protected onFirstWatch(): void {
        this.rls.on(this.events.LISTS_UPDATE_EVENT, this.onRlsUpdate);
    }

    protected onLastWatch(): void {
        this.rls.off(this.events.LISTS_UPDATE_EVENT, this.onRlsUpdate);
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
