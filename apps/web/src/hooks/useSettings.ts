/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

import SettingsStore from "../settings/SettingsStore";
import { type SettingLevel } from "../settings/SettingLevel";
import { type FeatureSettingKey, type SettingKey, type Settings } from "../settings/Settings.tsx";

// Hook to fetch the value of a setting and dynamically update when it changes
export function useSettingValue<S extends SettingKey>(
    settingName: S,
    roomId: string | null,
    excludeDefault: true,
): Settings[S]["default"] | undefined;
export function useSettingValue<S extends SettingKey>(
    settingName: S,
    roomId?: string | null,
    excludeDefault?: false,
): Settings[S]["default"];
export function useSettingValue<S extends SettingKey>(
    settingName: S,
    roomId: string | null = null,
    excludeDefault = false,
): Settings[S]["default"] | undefined {
    const [value, setValue] = useState(
        // XXX: This seems naff but is needed to convince TypeScript that the overload is fine
        excludeDefault
            ? SettingsStore.getValue(settingName, roomId, excludeDefault)
            : SettingsStore.getValue(settingName, roomId, excludeDefault),
    );

    useEffect(() => {
        const ref = SettingsStore.watchSetting(settingName, roomId, () => {
            setValue(
                // XXX: This seems naff but is needed to convince TypeScript that the overload is fine
                excludeDefault
                    ? SettingsStore.getValue(settingName, roomId, excludeDefault)
                    : SettingsStore.getValue(settingName, roomId, excludeDefault),
            );
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [settingName, roomId, excludeDefault]);

    return value;
}

/**
 * Hook to fetch the value of a setting at a specific level and dynamically update when it changes
 * @see SettingsStore.getValueAt
 * @param level
 * @param settingName
 * @param roomId
 * @param explicit
 * @param excludeDefault
 */
export const useSettingValueAt = <S extends SettingKey>(
    level: SettingLevel,
    settingName: S,
    roomId: string | null = null,
    explicit = false,
    excludeDefault = false,
): Settings[S]["default"] => {
    const [value, setValue] = useState(SettingsStore.getValueAt(level, settingName, roomId, explicit, excludeDefault));

    useEffect(() => {
        const ref = SettingsStore.watchSetting(settingName, roomId, () => {
            setValue(SettingsStore.getValueAt(level, settingName, roomId, explicit, excludeDefault));
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [level, settingName, roomId, explicit, excludeDefault]);

    return value;
};

// Hook to fetch whether a feature is enabled and dynamically update when that changes
export const useFeatureEnabled = (featureName: FeatureSettingKey, roomId: string | null = null): boolean => {
    const [enabled, setEnabled] = useState(SettingsStore.getValue(featureName, roomId));

    useEffect(() => {
        const ref = SettingsStore.watchSetting(featureName, roomId, () => {
            setEnabled(SettingsStore.getValue(featureName, roomId));
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [featureName, roomId]);

    return enabled;
};
