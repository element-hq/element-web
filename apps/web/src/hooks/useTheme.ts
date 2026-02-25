/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { SettingLevel } from "../settings/SettingLevel";
import { useSettingValue, useSettingValueAt } from "./useSettings";

/**
 * Hook to fetch the current theme and whether system theme matching is enabled.
 */
export function useTheme(): { theme: string; systemThemeActivated: boolean } {
    // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
    // show the right values for things.

    const themeChoice = useSettingValue("theme");
    const systemThemeExplicit = useSettingValueAt(SettingLevel.DEVICE, "use_system_theme", null, false, true);
    const themeExplicit = useSettingValueAt(SettingLevel.DEVICE, "theme", null, false, true);
    const systemThemeActivated = useSettingValue("use_system_theme");

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
