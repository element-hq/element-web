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
import type { IRoomTimelineActionPayload } from "../../actions/MatrixActionCreators";
import { RecencySorter } from "./skip-list/sorters/RecencySorter";

export class RoomListStoreV3Class extends AsyncStoreWithClient<EmptyObject> {
    private roomSkipList?: RoomSkipList;
    private readonly msc3946ProcessDynamicPredecessor: boolean;

    public constructor(dispatcher: MatrixDispatcher) {
        super(dispatcher);
        this.msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");
    }

    public getSortedRooms(): Room[] {
        if (this.roomSkipList?.initialized) return Array.from(this.roomSkipList);
        else return [];
    }

    protected async onReady(): Promise<any> {
        if (this.roomSkipList?.initialized || !this.matrixClient) return;
        const sorter = new RecencySorter(this.matrixClient.getSafeUserId() ?? "");
        this.roomSkipList = new RoomSkipList(sorter);
        const rooms = this.fetchRoomsFromSdk();
        if (!rooms) return;
        this.roomSkipList.seed(rooms);
        this.emit(LISTS_UPDATE_EVENT);
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (!this.matrixClient || !this.roomSkipList?.initialized) return;
        const room = this.getRoomFromPayload(payload);
        if (room) {
            setTimeout(() => {
                this.roomSkipList!.addRoom(room);
                this.emit(LISTS_UPDATE_EVENT);
            });
        }
    }

    private getRoomFromPayload(payload: ActionPayload): Room | undefined {
        if (payload.room) {
            return payload.room;
        }
        if (payload.action === "MatrixActions.Room.timeline") {
            const eventPayload = <IRoomTimelineActionPayload>payload;
            const roomId = eventPayload.event.getRoomId();
            const room = this.matrixClient?.getRoom(roomId);
            return room ?? undefined;
        }
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
