/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EmptyObject, Room } from "matrix-js-sdk/src/matrix";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import type { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import SettingsStore from "../../settings/SettingsStore";
import { VisibilityProvider } from "../room-list/filters/VisibilityProvider";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { LISTS_UPDATE_EVENT } from "../room-list/RoomListStore";
import { RoomSkipList } from "./skip-list/RoomSkipList";
import { RecencySorter } from "./skip-list/sorters/RecencySorter";
import { AlphabeticSorter } from "./skip-list/sorters/AlphabeticSorter";

export class RoomListStoreV3Class extends AsyncStoreWithClient<EmptyObject> {
    private roomSkipList?: RoomSkipList;
    private readonly msc3946ProcessDynamicPredecessor: boolean;

    public constructor(dispatcher: MatrixDispatcher) {
        super(dispatcher);
        this.msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
    }

    public getRooms(): Room[] {
        let rooms = this.matrixClient?.getVisibleRooms(this.msc3946ProcessDynamicPredecessor) ?? [];
        rooms = rooms.filter((r) => VisibilityProvider.instance.isRoomVisible(r));
        return rooms;
    }

    public getSortedRooms(): Room[] {
        if (this.roomSkipList?.initialized) return Array.from(this.roomSkipList);
        else return [];
    }

    public useAlphabeticSorting(): void {
        if (this.roomSkipList) {
            const sorter = new AlphabeticSorter();
            this.roomSkipList.useNewSorter(sorter, this.getRooms());
        }
    }

    public useRecencySorting(): void {
        if (this.roomSkipList && this.matrixClient) {
            const sorter = new RecencySorter(this.matrixClient?.getSafeUserId() ?? "");
            this.roomSkipList.useNewSorter(sorter, this.getRooms());
        }
    }

    protected async onReady(): Promise<any> {
        if (this.roomSkipList?.initialized || !this.matrixClient) return;
        const sorter = new RecencySorter(this.matrixClient.getSafeUserId());
        this.roomSkipList = new RoomSkipList(sorter);
        const rooms = this.getRooms();
        this.roomSkipList.seed(rooms);
        this.emit(LISTS_UPDATE_EVENT);
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        return;
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
