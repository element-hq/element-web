/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import SettingsStore from "../../../src/settings/SettingsStore";
import ThemeWatcher from "../../../src/settings/watchers/ThemeWatcher";
import { SettingLevel } from "../../../src/settings/SettingLevel";

function makeMatchMedia(values: any) {
    class FakeMediaQueryList {
        matches: false;
        media?: null;
        onchange?: null;
        addListener() {}
        removeListener() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {
            return true;
        }

        constructor(query: string) {
            this.matches = values[query];
        }
    }

    return function matchMedia(query: string) {
        return new FakeMediaQueryList(query) as unknown as MediaQueryList;
    };
}

function makeGetValue(values: any) {
    return function getValue<T = any>(settingName: string, _roomId: string | null = null, _excludeDefault = false): T {
        return values[settingName];
    };
}

function makeGetValueAt(values: any) {
    return function getValueAt(
        _level: SettingLevel,
        settingName: string,
        _roomId: string | null = null,
        _explicit = false,
        _excludeDefault = false,
    ): any {
        return values[settingName];
    };
}

describe("ThemeWatcher", function () {
    it("should choose a light theme by default", () => {
        // Given no system settings
        global.matchMedia = makeMatchMedia({});

        // Then getEffectiveTheme returns light
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light");
    });

    it("should choose default theme if system settings are inconclusive", () => {
        // Given no system settings but we asked to use them
        global.matchMedia = makeMatchMedia({});
        SettingsStore.getValue = makeGetValue({
            use_system_theme: true,
            theme: "light",
        });

        // Then getEffectiveTheme returns light
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light");
    });

    it("should choose a dark theme if that is selected", () => {
        // Given system says light high contrast but theme is set to dark
        global.matchMedia = makeMatchMedia({
            "(prefers-contrast: more)": true,
            "(prefers-color-scheme: light)": true,
        });
        SettingsStore.getValueAt = makeGetValueAt({ theme: "dark" });

        // Then getEffectiveTheme returns dark
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("dark");
    });

    it("should choose a light theme if that is selected", () => {
        // Given system settings say dark high contrast but theme set to light
        global.matchMedia = makeMatchMedia({
            "(prefers-contrast: more)": true,
            "(prefers-color-scheme: dark)": true,
        });
        SettingsStore.getValueAt = makeGetValueAt({ theme: "light" });

        // Then getEffectiveTheme returns light
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light");
    });

    it("should choose a light-high-contrast theme if that is selected", () => {
        // Given system settings say dark and theme set to light-high-contrast
        global.matchMedia = makeMatchMedia({ "(prefers-color-scheme: dark)": true });
        SettingsStore.getValueAt = makeGetValueAt({ theme: "light-high-contrast" });

        // Then getEffectiveTheme returns light-high-contrast
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light-high-contrast");
    });

    it("should choose a light theme if system prefers it (via default)", () => {
        // Given system prefers lightness, even though we did not
        // click "Use system theme" or choose a theme explicitly
        global.matchMedia = makeMatchMedia({ "(prefers-color-scheme: light)": true });
        SettingsStore.getValueAt = makeGetValueAt({});
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns light
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light");
    });

    it("should choose a dark theme if system prefers it (via default)", () => {
        // Given system prefers darkness, even though we did not
        // click "Use system theme" or choose a theme explicitly
        global.matchMedia = makeMatchMedia({ "(prefers-color-scheme: dark)": true });
        SettingsStore.getValueAt = makeGetValueAt({});
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns dark
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("dark");
    });

    it("should choose a light theme if system prefers it (explicit)", () => {
        // Given system prefers lightness
        global.matchMedia = makeMatchMedia({ "(prefers-color-scheme: light)": true });
        SettingsStore.getValueAt = makeGetValueAt({ use_system_theme: true });
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns light
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light");
    });

    it("should choose a dark theme if system prefers it (explicit)", () => {
        // Given system prefers darkness
        global.matchMedia = makeMatchMedia({ "(prefers-color-scheme: dark)": true });
        SettingsStore.getValueAt = makeGetValueAt({ use_system_theme: true });
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns dark
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("dark");
    });

    it("should choose a high-contrast theme if system prefers it", () => {
        // Given system prefers high contrast and light
        global.matchMedia = makeMatchMedia({
            "(prefers-contrast: more)": true,
            "(prefers-color-scheme: light)": true,
        });
        SettingsStore.getValueAt = makeGetValueAt({ use_system_theme: true });
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns light-high-contrast
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("light-high-contrast");
    });

    it("should not choose a high-contrast theme if not available", () => {
        // Given system prefers high contrast and dark, but we don't (yet)
        // have a high-contrast dark theme
        global.matchMedia = makeMatchMedia({
            "(prefers-contrast: more)": true,
            "(prefers-color-scheme: dark)": true,
        });
        SettingsStore.getValueAt = makeGetValueAt({ use_system_theme: true });
        SettingsStore.getValue = makeGetValue({ use_system_theme: true });

        // Then getEffectiveTheme returns dark
        const themeWatcher = new ThemeWatcher();
        expect(themeWatcher.getEffectiveTheme()).toBe("dark");
    });
});
