/*
Copyright 2017 Travis Ralston

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

import Promise from 'bluebird';
import SettingsHandler from "./SettingsHandler";
import MatrixClientPeg from '../MatrixClientPeg';

/**
 * Gets and sets settings at the "room-account" level for the current user.
 */
export default class RoomAccountSettingsHandler extends SettingsHandler {
    getValue(settingName, roomId) {
        const room = MatrixClientPeg.get().getRoom(roomId);
        if (!room) return Promise.reject();

        const value = room.getAccountData(this._getEventType(settingName));
        if (!value) return Promise.reject();
        return Promise.resolve(value);
    }

    setValue(settingName, roomId, newValue) {
        return MatrixClientPeg.get().setRoomAccountData(
            roomId, this._getEventType(settingName), newValue
        );
    }

    canSetValue(settingName, roomId) {
        const room = MatrixClientPeg.get().getRoom(roomId);
        return !!room; // If they have the room, they can set their own account data
    }

    isSupported() {
        return !!MatrixClientPeg.get();
    }

    _getEventType(settingName) {
        return "im.vector.setting." + settingName;
    }
}