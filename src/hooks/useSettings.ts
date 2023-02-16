/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { useEffect, useState } from "react";

import SettingsStore from "../settings/SettingsStore";

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
