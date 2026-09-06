/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type SettingsApi as ISettingsApi,
    type Level,
    type Settings,
    Watchable,
} from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";
import type { ModuleSettings } from "../settings/Settings";
import type { SettingLevel } from "../settings/SettingLevel";

export class SettingsApi<T extends Settings = Settings> implements ISettingsApi<T> {
    public registerSettings(settings: T): void {
        SettingsStore.registerRuntimeSettings(settings as unknown as ModuleSettings);
    }

    public getValue<K extends keyof T | string>(
        settingName: K,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<K extends keyof T ? T[K] : unknown> {
        //@ts-expect-error: settingsName is strictly typed but we want relaxed type here.
        return new SettingsWatchable(settingName, roomId, excludeDefault);
    }

    public setValue<K extends keyof T | string>(
        settingName: K,
        roomId: string | null,
        level: Level,
        value: K extends keyof T ? T[K] : unknown,
    ): Promise<void> {
        //@ts-expect-error: settingsName is strictly typed but we want relaxed type here.
        return SettingsStore.setValue(settingName, roomId, level, value);
    }
}

class SettingsWatchable<T> extends Watchable<T> {
    private watcherReference?: string;

    public constructor(
        private readonly settingName: string,
        roomId?: string | null,
        excludeDefault?: boolean,
    ) {
        //@ts-expect-error: settingsName is strictly typed but we want relaxed type here.
        super(SettingsStore.getValue(settingName, roomId, excludeDefault));
    }

    private onSettingUpdate = (
        settingsName: string,
        roomId: string | null,
        atLevel: SettingLevel,
        newValAtLevel: T,
        newVal: T,
    ): void => {
        // This only needs to checks atLevel when we add a getValueAtLevel to the API.
        this.value = newVal;
    };

    protected onFirstWatch(): void {
        //@ts-expect-error: settingsName is strictly typed but we want relaxed type here.
        this.watcherReference = SettingsStore.watchSetting(this.settingName, null, this.onSettingUpdate);
    }

    protected onLastWatch(): void {
        if (this.watcherReference) SettingsStore.unwatchSetting(this.watcherReference);
    }
}
