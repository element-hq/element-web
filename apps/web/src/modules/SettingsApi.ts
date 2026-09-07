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

    // The idea with the typing here is to be strict with the settings typed in the
    // generic parameter while being less strict with the others.
    // For instance, if you had a type `MySettings` which mapped "module.myModule.foo"
    // to a boolean, `SettingsApi<MySettings>.getValue("module.myModule.foo")` should return
    // a Watchable<boolean>.
    // But for the settings not defined, the watchable would have weaker type (eg: any).
    // So `SettingsApi<MySettings>.getValue("bar")` would return Watchable<any> and
    // `SettingsApi<MySettings>.getValue<string>("bar") would return Watchable<string>.
    // This is done to provide a good balance between type safety and flexibility.
    public getValue<K extends keyof Settings>(
        settingName: K,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<T[K]["default"]>;
    public getValue<V = any>(settingName: string, roomId?: string | null, excludeDefault?: boolean): Watchable<V>;
    public getValue<K extends keyof Settings, V = any>(
        settingName: K | string,
        roomId?: string | null,
        excludeDefault?: boolean,
    ): Watchable<T[K]["default"]> | Watchable<V> {
        return new SettingsWatchable(settingName, roomId, excludeDefault) as Watchable<T[K]["default"]> | Watchable<V>;
    }

    // Continuing with the example above, `SettingsApi<MySettings>.setValue("module.myModule.foo", null, Level.Device, "hello")`
    // would throw a type error because the setting value isn't a boolean.
    // However, any value could be provided for a non typed setting like "bar", so
    // `SettingsApi<MySettings>.setValue("bar", null, Level.Device, "hello")`
    // `SettingsApi<MySettings>.setValue("bar", null, Level.Device, true)`
    // `SettingsApi<MySettings>.setValue("bar", null, Level.Device, 123)`
    // are all acceptable from a type POV.
    public setValue<K extends keyof Settings>(
        settingName: K,
        roomId: string | null,
        level: Level,
        value: T[K]["default"],
    ): Promise<void>;
    public setValue<V = any>(settingName: string, roomId: string | null, level: Level, value: V): Promise<void>;
    public setValue<K extends keyof Settings, V = any>(
        settingName: K | string,
        roomId: string | null,
        level: Level,
        value: T[K]["default"] | V,
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
