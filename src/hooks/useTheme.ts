/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SettingLevel } from "../settings/SettingLevel";
import { useSettingValue, useSettingValueAt } from "./useSettings";

/**
 * Hook to fetch the current theme and whether system theme matching is enabled.
 */
export function useTheme(): { theme: string; systemThemeActivated: boolean } {
    // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
    // show the right values for things.

    const themeChoice = useSettingValue<string>("theme");
    const systemThemeExplicit = useSettingValueAt<string>(SettingLevel.DEVICE, "use_system_theme", null, false, true);
    const themeExplicit = useSettingValueAt<string>(SettingLevel.DEVICE, "theme", null, false, true);
    const systemThemeActivated = useSettingValue<boolean>("use_system_theme");

    // If the user has enabled system theme matching, use that.
    if (systemThemeExplicit) {
        return {
            theme: themeChoice,
            systemThemeActivated: true,
        };
    }

    // If the user has set a theme explicitly, use that (no system theme matching)
    if (themeExplicit) {
        return {
            theme: themeChoice,
            systemThemeActivated: false,
        };
    }

    // Otherwise assume the defaults for the settings
    return {
        theme: themeChoice,
        systemThemeActivated,
    };
}
