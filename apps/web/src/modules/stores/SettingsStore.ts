/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { SettingLevel, SettingsStoreApi } from "@element-hq/element-web-module-api";
import SettingsStore from "../../settings/SettingsStore";
import type { SettingKey } from "../../settings/Settings";

export class ModuleSettingsStore implements SettingsStoreApi {
    public overrideSettingsSupportedLevels(settingName: string, supportedLevels: SettingLevel[]): void {
        const key = settingName as SettingKey;
        // Validate that the setting is real.
        SettingsStore.getSettingWithOverrides(key);
        SettingsStore.setSettingOverride(key, { supportedLevels });
    }
}
