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

import { TagID } from "./models";
import { Room } from "matrix-js-sdk/src/models/room";
import SettingsStore from "../../settings/SettingsStore";
import RoomListStore from "./RoomListStore2";
import OldRoomListStore from "../RoomListStore";

/**
 * Temporary RoomListStore proxy. Should be replaced with RoomListStore2 when
 * it is available to everyone.
 *
 * TODO: Remove this when RoomListStore gets fully replaced.
 */
export class RoomListStoreTempProxy {
    public static isUsingNewStore(): boolean {
        return SettingsStore.isFeatureEnabled("feature_new_room_list");
    }

    public static addListener(handler: () => void) {
        if (RoomListStoreTempProxy.isUsingNewStore()) {
            return RoomListStore.instance.addListener(handler);
        } else {
            return OldRoomListStore.addListener(handler);
        }
    }

    public static getRoomLists(): {[tagId in TagID]: Room[]} {
        if (RoomListStoreTempProxy.isUsingNewStore()) {
            return RoomListStore.instance.orderedLists;
        } else {
            return OldRoomListStore.getRoomLists();
        }
    }
}
