/*
Copyright 2017 Travis Ralston
Copyright 2019 New Vector Ltd.

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

import SettingsHandler from "./SettingsHandler";

/**
 * A wrapper for a SettingsHandler that performs local echo on
 * changes to settings. This wrapper will use the underlying
 * handler as much as possible to ensure values are not stale.
 */
export default class LocalEchoWrapper extends SettingsHandler {
    /**
     * Creates a new local echo wrapper
     * @param {SettingsHandler} handler The handler to wrap
     */
    constructor(handler) {
        super();
        this._handler = handler;
        this._cache = {
            // settingName: { roomId: value }
        };
    }

    getValue(settingName, roomId) {
        const cacheRoomId = roomId ? roomId : "UNDEFINED"; // avoid weird keys
        const bySetting = this._cache[settingName];
        if (bySetting && bySetting.hasOwnProperty(cacheRoomId)) {
            return bySetting[cacheRoomId];
        }

        return this._handler.getValue(settingName, roomId);
    }

    setValue(settingName, roomId, newValue) {
        if (!this._cache[settingName]) this._cache[settingName] = {};
        const bySetting = this._cache[settingName];

        const cacheRoomId = roomId ? roomId : "UNDEFINED"; // avoid weird keys
        bySetting[cacheRoomId] = newValue;

        const handlerPromise = this._handler.setValue(settingName, roomId, newValue);
        return Promise.resolve(handlerPromise).finally(() => {
            delete bySetting[cacheRoomId];
        });
    }


    canSetValue(settingName, roomId) {
        return this._handler.canSetValue(settingName, roomId);
    }

    isSupported() {
        return this._handler.isSupported();
    }
}
