/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type SettingsApi as ISettingsApi,
    type BaseSettings,
    type Level,
    type SettingValue,
    Watchable,
} from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";

/**
 * Implementation of the module API for reading and writing settings.
 */
export class SettingsApi implements ISettingsApi {
    public registerSettings(settings: Record<string, BaseSettings>): void {
        //@ts-expect-error: Level values are a subset of SettingLevel values but typescript uses nominal typing for enums so explicitly tell it to ignore that error.
        SettingsStore.registerModuleSettings(settings);
    }

    public getValue<K extends string>(
        settingName: K,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<SettingValue<K>> {
        return new SettingsWatchable(settingName, roomId, excludeDefault);
    }

    public setValue<K extends string>(
        settingName: K,
        roomId: string | null,
        level: Level,
        value: SettingValue<K>,
    ): Promise<void> {
        //@ts-expect-error: SettingStore is strictly typed to only accept settings that it knows, but we're using module level settings here.
        return SettingsStore.setValue(settingName, roomId, level, value);
    }
}

/**
 * A watchable holding the value of a setting.
 */
class SettingsWatchable<T> extends Watchable<T> {
    private watcherReference?: string;

    public constructor(
        private readonly settingName: string,
        private readonly roomId: string | null = null,
        private readonly excludeDefault = false,
    ) {
        //@ts-expect-error: SettingStore is strictly typed to only accept settings that it knows, but we're using module level settings here.
        super(SettingsStore.getValue(settingName, roomId, excludeDefault));
    }

    private onSettingUpdate = (): void => {
        //@ts-expect-error: SettingStore is strictly typed to only accept settings that it knows, but we're using module level settings here.
        this.value = SettingsStore.getValue(this.settingName, this.roomId, this.excludeDefault);
    };

    protected onFirstWatch(): void {
        // The setting may have changed since this watchable was created.
        this.onSettingUpdate();
        //@ts-expect-error: SettingStore is strictly typed to only accept settings that it knows, but we're using module level settings here.
        this.watcherReference = SettingsStore.watchSetting(this.settingName, this.roomId, this.onSettingUpdate);
    }

    protected onLastWatch(): void {
        if (this.watcherReference) SettingsStore.unwatchSetting(this.watcherReference);
    }
}
