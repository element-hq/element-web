/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useEffect, useState } from "react";

import ThemeWatcher, { ThemeWatcherEvent } from "../settings/watchers/ThemeWatcher";

/**
 * The theme Element Web is showing right now, kept current: the user's explicit choice, or the system's
 * when system theme matching is on (which `useTheme` does not resolve). The same answer
 * `ThemeWatcher.getEffectiveTheme` gives, as `WidgetMessaging` uses it for the widget theme.
 */
export function useEffectiveTheme(): string {
    const [watcher] = useState(() => new ThemeWatcher());
    const [theme, setTheme] = useState(() => watcher.getEffectiveTheme());
    useEffect(() => {
        watcher.start();
        watcher.on(ThemeWatcherEvent.Change, setTheme);
        // Anything that changed between the first render and now
        setTheme(watcher.getEffectiveTheme());
        return () => {
            watcher.off(ThemeWatcherEvent.Change, setTheme);
            watcher.stop();
        };
    }, [watcher]);
    return theme;
}
