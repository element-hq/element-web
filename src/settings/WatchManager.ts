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

import { SettingLevel } from "./SettingLevel";

export type CallbackFn = (changedInRoomId: string, atLevel: SettingLevel, newValAtLevel: any) => void;

const IRRELEVANT_ROOM = Symbol("any room");

interface RoomWatcherMap {
    // @ts-ignore - TS wants string-only keys but we know better - https://github.com/Microsoft/TypeScript/issues/1863
    [roomId: string | symbol]: CallbackFn[];
}

/**
 * Generalized management class for dealing with watchers on a per-handler (per-level)
 * basis without duplicating code. Handlers are expected to push updates through this
 * class, which are then proxied outwards to any applicable watchers.
 */
export class WatchManager {
    private watchers: {[settingName: string]: RoomWatcherMap} = {};

    // Proxy for handlers to delegate changes to this manager
    public watchSetting(settingName: string, roomId: string | null, cb: CallbackFn) {
        if (!this.watchers[settingName]) this.watchers[settingName] = {};
        if (!this.watchers[settingName][roomId]) this.watchers[settingName][roomId] = [];
        this.watchers[settingName][roomId].push(cb);
    }

    // Proxy for handlers to delegate changes to this manager
    public unwatchSetting(cb: CallbackFn) {
        for (const settingName of Object.keys(this.watchers)) {
            for (const roomId of Object.keys(this.watchers[settingName])) {
                let idx;
                while ((idx = this.watchers[settingName][roomId].indexOf(cb)) !== -1) {
                    this.watchers[settingName][roomId].splice(idx, 1);
                }
            }
        }
    }

    public notifyUpdate(settingName: string, inRoomId: string | null, atLevel: SettingLevel, newValueAtLevel: any) {
        // Dev note: We could avoid raising changes for ultimately inconsequential changes, but
        // we also don't have a reliable way to get the old value of a setting. Instead, we'll just
        // let it fall through regardless and let the receiver dedupe if they want to.

        if (!this.watchers[settingName]) return;

        const roomWatchers = this.watchers[settingName];
        const callbacks = [];

        if (inRoomId !== null && roomWatchers[inRoomId]) {
            callbacks.push(...roomWatchers[inRoomId]);
        }

        if (!inRoomId) {
            // Fire updates to all the individual room watchers too, as they probably
            // care about the change higher up.
            callbacks.push(...Object.values(roomWatchers).reduce((r, a) => [...r, ...a], []));
        } else if (roomWatchers[IRRELEVANT_ROOM]) {
            callbacks.push(...roomWatchers[IRRELEVANT_ROOM]);
        }

        for (const callback of callbacks) {
            callback(inRoomId, atLevel, newValueAtLevel);
        }
    }
}
