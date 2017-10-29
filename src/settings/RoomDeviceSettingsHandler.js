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

/**
 * Gets and sets settings at the "room-device" level for the current device in a particular
 * room.
 */
export default class RoomDeviceSettingsHandler extends SettingsHandler {
    getValue(settingName, roomId) {
        const value = localStorage.getItem(this._getKey(settingName, roomId));
        if (!value) return null;
        return JSON.parse(value).value;
    }

    setValue(settingName, roomId, newValue) {
        if (newValue === null) {
            localStorage.removeItem(this._getKey(settingName, roomId));
        } else {
            newValue = JSON.stringify({value: newValue});
            localStorage.setItem(this._getKey(settingName, roomId), newValue);
        }

        return Promise.resolve();
    }

    canSetValue(settingName, roomId) {
        return true; // It's their device, so they should be able to
    }

    isSupported() {
        return !!localStorage;
    }

    _getKey(settingName, roomId) {
        return "mx_setting_" + settingName + "_" + roomId;
    }
}