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

export type CallbackFn = (changedInRoomId: string | null, atLevel: SettingLevel, newValAtLevel: any) => void;

const IRRELEVANT_ROOM: string | null = null;

/**
 * Generalized management class for dealing with watchers on a per-handler (per-level)
 * basis without duplicating code. Handlers are expected to push updates through this
 * class, which are then proxied outwards to any applicable watchers.
 */
export class WatchManager {
    private watchers = new Map<string, Map<string | null, CallbackFn[]>>(); // settingName -> roomId -> CallbackFn[]

    // Proxy for handlers to delegate changes to this manager
    public watchSetting(settingName: string, roomId: string | null, cb: CallbackFn): void {
        if (!this.watchers.has(settingName)) this.watchers.set(settingName, new Map());
        if (!this.watchers.get(settingName)!.has(roomId)) this.watchers.get(settingName)!.set(roomId, []);
        this.watchers.get(settingName)!.get(roomId)!.push(cb);
    }

    // Proxy for handlers to delegate changes to this manager
    public unwatchSetting(cb: CallbackFn): void {
        this.watchers.forEach((map) => {
            map.forEach((callbacks) => {
                let idx: number;
                while ((idx = callbacks.indexOf(cb)) !== -1) {
                    callbacks.splice(idx, 1);
                }
            });
        });
    }

    public notifyUpdate(
        settingName: string,
        inRoomId: string | null,
        atLevel: SettingLevel,
        newValueAtLevel: any,
    ): void {
        // Dev note: We could avoid raising changes for ultimately inconsequential changes, but
        // we also don't have a reliable way to get the old value of a setting. Instead, we'll just
        // let it fall through regardless and let the receiver dedupe if they want to.

        if (!this.watchers.has(settingName)) return;

        const roomWatchers = this.watchers.get(settingName)!;
        const callbacks: CallbackFn[] = [];

        if (inRoomId !== null && roomWatchers.has(inRoomId)) {
            callbacks.push(...roomWatchers.get(inRoomId)!);
        }

        if (!inRoomId) {
            // Fire updates to all the individual room watchers too, as they probably care about the change higher up.
            callbacks.push(...Array.from(roomWatchers.values()).flat(1));
        } else if (roomWatchers.has(IRRELEVANT_ROOM)) {
            callbacks.push(...roomWatchers.get(IRRELEVANT_ROOM)!);
        }

        for (const callback of callbacks) {
            callback(inRoomId, atLevel, newValueAtLevel);
        }
    }
}
