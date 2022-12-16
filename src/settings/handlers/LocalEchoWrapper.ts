/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import { SettingLevel } from "../SettingLevel";

/**
 * A wrapper for a SettingsHandler that performs local echo on
 * changes to settings. This wrapper will use the underlying
 * handler as much as possible to ensure values are not stale.
 */
export default class LocalEchoWrapper extends SettingsHandler {
    private cache: {
        [settingName: string]: {
            [roomId: string]: any;
        };
    } = {};

    /**
     * Creates a new local echo wrapper
     * @param {SettingsHandler} handler The handler to wrap
     * @param {SettingLevel} level The level to notify updates at
     */
    public constructor(private readonly handler: SettingsHandler, private readonly level: SettingLevel) {
        super();
    }

    public getValue(settingName: string, roomId: string): any {
        const cacheRoomId = roomId ?? "UNDEFINED"; // avoid weird keys
        const bySetting = this.cache[settingName];
        if (bySetting?.hasOwnProperty(cacheRoomId)) {
            return bySetting[cacheRoomId];
        }

        return this.handler.getValue(settingName, roomId);
    }

    public async setValue(settingName: string, roomId: string, newValue: any): Promise<void> {
        if (!this.cache[settingName]) this.cache[settingName] = {};
        const bySetting = this.cache[settingName];

        const cacheRoomId = roomId ?? "UNDEFINED"; // avoid weird keys
        bySetting[cacheRoomId] = newValue;

        const currentValue = this.handler.getValue(settingName, roomId);
        const handlerPromise = this.handler.setValue(settingName, roomId, newValue);
        this.handler.watchers?.notifyUpdate(settingName, roomId, this.level, newValue);

        try {
            await handlerPromise;
        } catch (e) {
            // notify of a rollback
            this.handler.watchers?.notifyUpdate(settingName, roomId, this.level, currentValue);
        } finally {
            // only expire the cache if our value hasn't been overwritten yet
            if (bySetting[cacheRoomId] === newValue) {
                delete bySetting[cacheRoomId];
            }
        }
    }

    public canSetValue(settingName: string, roomId: string): boolean {
        return this.handler.canSetValue(settingName, roomId);
    }

    public isSupported(): boolean {
        return this.handler.isSupported();
    }
}
