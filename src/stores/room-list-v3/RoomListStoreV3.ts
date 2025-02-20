/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EmptyObject, Room } from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import type { ActionPayload } from "../../dispatcher/payloads";
import type { Filter, FilterKey } from "./filters";
import type { Sorter } from "./sorters";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import SettingsStore from "../../settings/SettingsStore";
import { VisibilityProvider } from "../room-list/filters/VisibilityProvider";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { LISTS_UPDATE_EVENT } from "../room-list/RoomListStore";
import { AllRoomsFilter } from "./filters/AllRoomsFilter";
import { FavouriteFilter } from "./filters/FavouriteFilter";
import { RecencySorter } from "./sorters/RecencySorter";

export class RoomListStoreV3Class extends AsyncStoreWithClient<EmptyObject> {
    /**
     * This is the unsorted, unfiltered raw list of rooms from the js-sdk.
     */
    private rooms: Room[] = [];

    private readonly msc3946ProcessDynamicPredecessor: boolean;

    /**
     * Mapping from FilterKey | string to a set of Rooms
     */
    private filteredRooms: Map<FilterKey, Set<Room>> = new Map();
    private sortedRooms: Room[] = [];

    private readonly filters: Filter[] = [new AllRoomsFilter(), new FavouriteFilter()];
    private sorter: Sorter = new RecencySorter();

    public constructor(dispatcher: MatrixDispatcher) {
        super(dispatcher);
        this.msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
    }

    public setSorter(sorter: Sorter): void {
        this.sorter = sorter;
    }

    public getFilteredRooms(filters: FilterKey[]): Set<Room> | null {
        const sets = filters.map((f) => this.filteredRooms.get(f)).filter((s) => !!s);
        if (!sets.length) return null;
        if (sets.length === 1) return sets[0];
        // Find the intersection of these filtered sets
        const intersection = new Set<Room>();
        const [firstSet, ...otherSets] = sets;
        for (const room of firstSet) {
            if (!otherSets.some((set) => !set.has(room))) intersection.add(room);
        }
        return intersection;
    }

    public getSortedFilteredRooms(filters: FilterKey[]): Array<Room> {
        const filteredSet = this.getFilteredRooms(filters);
        if (!filteredSet) return this.sortedRooms;
        return this.sortedRooms?.filter((room) => filteredSet.has(room));
    }

    protected async onReady(): Promise<any> {
        const rooms = this.fetchRoomsFromSdk();
        if (!rooms) return;
        this.rooms = rooms;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (
            ![
                "MatrixActions.Room.receipt",
                "MatrixActions.Room.tags",
                "MatrixActions.Room.timeline",
                "MatrixActions.Event.decrypted",
                "MatrixActions.accountData",
                "MatrixActions.Room.myMembership",
            ].includes(payload.action)
        )
            return;
        setTimeout(() => {
            this.recalculate();
        });
    }

    private recalculate(): void {
        const t0 = performance.now();
        this.fetchRoomsFromSdk();
        this.filterRooms();
        this.sortRooms();
        const t1 = performance.now();
        console.log("RLS Performance, time taken = ", t1 - t0);
        this.emit(LISTS_UPDATE_EVENT);
    }

    private filterRooms(): void {
        for (const filter of this.filters) {
            const rooms = filter.filter(this.rooms);
            this.filteredRooms.set(filter.key, new Set(rooms));
        }
    }

    private sortRooms(): void {
        this.sortedRooms = this.sorter.sort(this.rooms);
    }

    private fetchRoomsFromSdk(): Room[] | null {
        if (!this.matrixClient) return null;
        let rooms = this.matrixClient.getVisibleRooms(this.msc3946ProcessDynamicPredecessor);
        rooms = rooms.filter((r) => VisibilityProvider.instance.isRoomVisible(r));
        return rooms;
    }
}

export default class RoomListStoreV3 {
    private static internalInstance: RoomListStoreV3Class;

    public static get instance(): RoomListStoreV3Class {
        if (!RoomListStoreV3.internalInstance) {
            const instance = new RoomListStoreV3Class(defaultDispatcher);
            instance.start();
            RoomListStoreV3.internalInstance = instance;
        }

        return this.internalInstance;
    }
}

window.mxRoomListStoreV3 = RoomListStoreV3.instance;
