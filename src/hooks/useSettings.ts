/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";

// Hook to fetch the value of a setting and dynamically update when it changes
export const useSettingValue = <T>(settingName: string, roomId: string | null = null, excludeDefault = false): T => {
    const [value, setValue] = useState(SettingsStore.getValue<T>(settingName, roomId, excludeDefault));

    useEffect(() => {
        const ref = SettingsStore.watchSetting(settingName, roomId, () => {
            setValue(SettingsStore.getValue<T>(settingName, roomId, excludeDefault));
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [settingName, roomId, excludeDefault]);

    return value;
};

/**
 * Hook to fetch the value of a setting at a specific level and dynamically update when it changes
 * @see SettingsStore.getValueAt
 * @param level
 * @param settingName
 * @param roomId
 * @param explicit
 * @param excludeDefault
 */
export const useSettingValueAt = <T>(
    level: SettingLevel,
    settingName: string,
    roomId: string | null = null,
    explicit = false,
    excludeDefault = false,
): T => {
    const [value, setValue] = useState(
        SettingsStore.getValueAt<T>(level, settingName, roomId, explicit, excludeDefault),
    );

    useEffect(() => {
        const ref = SettingsStore.watchSetting(settingName, roomId, () => {
            setValue(SettingsStore.getValueAt<T>(level, settingName, roomId, explicit, excludeDefault));
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [level, settingName, roomId, explicit, excludeDefault]);

    return value;
};

// Hook to fetch whether a feature is enabled and dynamically update when that changes
export const useFeatureEnabled = (featureName: string, roomId: string | null = null): boolean => {
    const [enabled, setEnabled] = useState(SettingsStore.getValue<boolean>(featureName, roomId));

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
