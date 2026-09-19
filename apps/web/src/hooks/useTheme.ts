/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useState } from "react";

import { SettingLevel } from "../settings/SettingLevel";
import ThemeWatcher, { ThemeWatcherEvent } from "../settings/watchers/ThemeWatcher";
import { useSettingValue, useSettingValueAt } from "./useSettings";

interface ThemeState {
    /** The theme the user chose in the settings, which is not what is shown when system theme matching is on. */
    theme: string;
    /** Whether the theme follows the system's light/dark preference. */
    systemThemeActivated: boolean;
    /**
     * The theme Element Web is showing right now, kept current: `theme` unless system theme matching is on, in which
     * case the system's. The same answer `ThemeWatcher.getEffectiveTheme` gives, as `WidgetMessaging` uses it for the
     * widget theme.
     */
    effectiveTheme: string;
}

/**
 * Hook to fetch the current theme and whether system theme matching is enabled.
 */
export function useTheme(): ThemeState {
    // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
    // show the right values for things.

    const themeChoice = useSettingValue("theme");
    const systemThemeExplicit = useSettingValueAt(SettingLevel.DEVICE, "use_system_theme", null, false, true);
    const themeExplicit = useSettingValueAt(SettingLevel.DEVICE, "theme", null, false, true);
    const systemThemeActivated = useSettingValue("use_system_theme");

    // The effective theme also depends on the system's preference, which the settings alone cannot tell us.
    const [watcher] = useState(() => new ThemeWatcher());
    const [effectiveTheme, setEffectiveTheme] = useState(() => watcher.getEffectiveTheme());
    useEffect(() => {
        watcher.start();
        watcher.on(ThemeWatcherEvent.Change, setEffectiveTheme);
        // Anything that changed between the first render and now
        setEffectiveTheme(watcher.getEffectiveTheme());
        return () => {
            watcher.off(ThemeWatcherEvent.Change, setEffectiveTheme);
            watcher.stop();
        };
    }, [watcher]);

    // If the user has enabled system theme matching, use that.
    if (systemThemeExplicit) {
        return {
            theme: themeChoice,
            systemThemeActivated: true,
            effectiveTheme,
        };
    }

    // If the user has set a theme explicitly, use that (no system theme matching)
    if (themeExplicit) {
        return {
            theme: themeChoice,
            systemThemeActivated: false,
            effectiveTheme,
        };
    }

    // Otherwise assume the defaults for the settings
    return {
        theme: themeChoice,
        systemThemeActivated,
        effectiveTheme,
    };
}
