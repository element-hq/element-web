/*
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

/**
 * Generalized management class for dealing with watchers on a per-handler (per-level)
 * basis without duplicating code. Handlers are expected to push updates through this
 * class, which are then proxied outwards to any applicable watchers.
 */
export class WatchManager {
    _watchers = {}; // { settingName: { roomId: callbackFns[] } }

    // Proxy for handlers to delegate changes to this manager
    watchSetting(settingName, roomId, cb) {
        if (!this._watchers[settingName]) this._watchers[settingName] = {};
        if (!this._watchers[settingName][roomId]) this._watchers[settingName][roomId] = [];
        this._watchers[settingName][roomId].push(cb);
    }

    // Proxy for handlers to delegate changes to this manager
    unwatchSetting(cb) {
        for (const settingName of Object.keys(this._watchers)) {
            for (const roomId of Object.keys(this._watchers[settingName])) {
                let idx;
                while ((idx = this._watchers[settingName][roomId].indexOf(cb)) !== -1) {
                    this._watchers[settingName][roomId].splice(idx, 1);
                }
            }
        }
    }

    notifyUpdate(settingName, inRoomId, atLevel, newValueAtLevel) {
        // Dev note: We could avoid raising changes for ultimately inconsequential changes, but
        // we also don't have a reliable way to get the old value of a setting. Instead, we'll just
        // let it fall through regardless and let the receiver dedupe if they want to.

        if (!this._watchers[settingName]) return;

        const roomWatchers = this._watchers[settingName];
        const callbacks = [];

        if (inRoomId !== null && roomWatchers[inRoomId]) {
            callbacks.push(...roomWatchers[inRoomId]);
        }

        if (!inRoomId) {
            // Fire updates to all the individual room watchers too, as they probably
            // care about the change higher up.
            callbacks.push(...Object.values(roomWatchers).reduce((r, a) => [...r, ...a], []));
        } else if (roomWatchers[null]) {
            callbacks.push(...roomWatchers[null]);
        }

        for (const callback of callbacks) {
            callback(inRoomId, atLevel, newValueAtLevel);
        }
    }
}
