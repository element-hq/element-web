/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import MatrixClientPeg from "../MatrixClientPeg";
import {ALL_RULE_TYPES, BanList} from "./BanList";
import SettingsStore, {SettingLevel} from "../settings/SettingsStore";
import {_t} from "../languageHandler";

// TODO: Move this and related files to the js-sdk or something once finalized.

export class Mjolnir {
    static _instance: Mjolnir = null;

    _lists: BanList[] = [];
    _roomIds: string[] = [];
    _mjolnirWatchRef = null;

    constructor() {
    }

    start() {
        this._updateLists(SettingsStore.getValue("mjolnirRooms"));
        this._mjolnirWatchRef = SettingsStore.watchSetting("mjolnirRooms", null, this._onListsChanged.bind(this));

        MatrixClientPeg.get().on("RoomState.events", this._onEvent.bind(this));
    }

    stop() {
        SettingsStore.unwatchSetting(this._mjolnirWatchRef);
        MatrixClientPeg.get().removeListener("RoomState.events", this._onEvent.bind(this));
    }

    async getOrCreatePersonalList(): Promise<BanList> {
        let personalRoomId = SettingsStore.getValue("mjolnirPersonalRoom");
        if (!personalRoomId) {
            const resp = await MatrixClientPeg.get().createRoom({
                name: _t("My Ban List"),
                topic: _t("This is your list of users/servers you have blocked - don't leave the room!"),
                preset: "private_chat"
            });
            personalRoomId = resp['room_id'];
            SettingsStore.setValue("mjolnirPersonalRoom", null, SettingLevel.ACCOUNT, personalRoomId);
            SettingsStore.setValue("mjolnirRooms", null, SettingLevel.ACCOUNT, [personalRoomId, ...this._roomIds]);
        }
        if (!personalRoomId) {
            throw new Error("Error finding a room ID to use");
        }

        let list = this._lists.find(b => b.roomId === personalRoomId);
        if (!list) list = new BanList(personalRoomId);
        // we don't append the list to the tracked rooms because it should already be there.
        // we're just trying to get the caller some utility access to the list

        return list;
    }

    _onEvent(event) {
        if (!this._roomIds.includes(event.getRoomId())) return;
        if (!ALL_RULE_TYPES.includes(event.getType())) return;

        this._updateLists(this._roomIds);
    }

    _onListsChanged(settingName, roomId, atLevel, newValue) {
        // We know that ban lists are only recorded at one level so we don't need to re-eval them
        this._updateLists(newValue);
    }

    _updateLists(listRoomIds: string[]) {
        this._lists = [];
        this._roomIds = listRoomIds || [];
        if (!listRoomIds) return;

        for (const roomId of listRoomIds) {
            // Creating the list updates it
            this._lists.push(new BanList(roomId));
        }
    }

    isServerBanned(serverName: string): boolean {
        for (const list of this._lists) {
            for (const rule of list.serverRules) {
                if (rule.isMatch(serverName)) {
                    return true;
                }
            }
        }
        return false;
    }

    isUserBanned(userId: string): boolean {
        for (const list of this._lists) {
            for (const rule of list.userRules) {
                if (rule.isMatch(userId)) {
                    return true;
                }
            }
        }
        return false;
    }

    static sharedInstance(): Mjolnir {
        if (!Mjolnir._instance) {
            Mjolnir._instance = new Mjolnir();
        }
        return Mjolnir._instance;
    }
}

