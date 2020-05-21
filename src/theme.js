/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {_t} from "./languageHandler";

export const DEFAULT_THEME = "light";
import Tinter from "./Tinter";
import dis from "./dispatcher/dispatcher";
import SettingsStore, {SettingLevel} from "./settings/SettingsStore";
import ThemeController from "./settings/controllers/ThemeController";

export class ThemeWatcher {
    static _instance = null;

    constructor() {
        this._themeWatchRef = null;
        this._systemThemeWatchRef = null;
        this._dispatcherRef = null;

        // we have both here as each may either match or not match, so by having both
        // we can get the tristate of dark/light/unsupported
        this._preferDark = global.matchMedia("(prefers-color-scheme: dark)");
        this._preferLight = global.matchMedia("(prefers-color-scheme: light)");

        this._currentTheme = this.getEffectiveTheme();
    }

    start() {
        this._themeWatchRef = SettingsStore.watchSetting("theme", null, this._onChange);
        this._systemThemeWatchRef = SettingsStore.watchSetting("use_system_theme", null, this._onChange);
        if (this._preferDark.addEventListener) {
            this._preferDark.addEventListener('change', this._onChange);
            this._preferLight.addEventListener('change', this._onChange);
        }
        this._dispatcherRef = dis.register(this._onAction);
    }

    stop() {
        if (this._preferDark.addEventListener) {
            this._preferDark.removeEventListener('change', this._onChange);
            this._preferLight.removeEventListener('change', this._onChange);
        }
        SettingsStore.unwatchSetting(this._systemThemeWatchRef);
        SettingsStore.unwatchSetting(this._themeWatchRef);
        dis.unregister(this._dispatcherRef);
    }

    _onChange = () => {
        this.recheck();
    };

    _onAction = (payload) => {
        if (payload.action === 'recheck_theme') {
            // XXX forceTheme
            this.recheck(payload.forceTheme);
        }
    };

    // XXX: forceTheme param added here as local echo appears to be unreliable
    // https://github.com/vector-im/riot-web/issues/11443
    recheck(forceTheme) {
        const oldTheme = this._currentTheme;
        this._currentTheme = forceTheme === undefined ? this.getEffectiveTheme() : forceTheme;
        if (oldTheme !== this._currentTheme) {
            setTheme(this._currentTheme);
        }
    }

    getEffectiveTheme() {
        // Dev note: Much of this logic is replicated in the AppearanceUserSettingsTab

        // XXX: checking the isLight flag here makes checking it in the ThemeController
        // itself completely redundant since we just override the result here and we're
        // now effectively just using the ThemeController as a place to store the static
        // variable. The system theme setting probably ought to have an equivalent
        // controller that honours the same flag, although probablt better would be to
        // have the theme logic in one place rather than split between however many
        // different places.
        if (ThemeController.isLogin) return 'light';

        // If the user has specifically enabled the system matching option (excluding default),
        // then use that over anything else. We pick the lowest possible level for the setting
        // to ensure the ordering otherwise works.
        const systemThemeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "use_system_theme", null, false, true);
        if (systemThemeExplicit) {
            console.log("returning explicit system theme");
            if (this._preferDark.matches) return 'dark';
            if (this._preferLight.matches) return 'light';
        }

        // If the user has specifically enabled the theme (without the system matching option being
        // enabled specifically and excluding the default), use that theme. We pick the lowest possible
        // level for the setting to ensure the ordering otherwise works.
        const themeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "theme", null, false, true);
        if (themeExplicit) {
            console.log("returning explicit theme: " + themeExplicit);
            return themeExplicit;
        }

        // If the user hasn't really made a preference in either direction, assume the defaults of the
        // settings and use those.
        if (SettingsStore.getValue('use_system_theme')) {
            if (this._preferDark.matches) return 'dark';
            if (this._preferLight.matches) return 'light';
        }
        console.log("returning theme value");
        return SettingsStore.getValue('theme');
    }

    isSystemThemeSupported() {
        return this._preferDark.matches || this._preferLight.matches;
    }
}

export function enumerateThemes() {
    const BUILTIN_THEMES = {
        "light": _t("Light theme"),
        "dark": _t("Dark theme"),
    };
    const customThemes = SettingsStore.getValue("custom_themes");
    const customThemeNames = {};
    for (const {name} of customThemes) {
        customThemeNames[`custom-${name}`] = name;
    }
    return Object.assign({}, customThemeNames, BUILTIN_THEMES);
}


function setCustomThemeVars(customTheme) {
    const {style} = document.body;

    function setCSSVariable(name, hexColor, doPct = true) {
        style.setProperty(`--${name}`, hexColor);
        if (doPct) {
            // uses #rrggbbaa to define the color with alpha values at 0%, 15% and 50%
            style.setProperty(`--${name}-0pct`, hexColor + "00");
            style.setProperty(`--${name}-15pct`, hexColor + "26");
            style.setProperty(`--${name}-50pct`, hexColor + "7F");
        }
    }

    if (customTheme.colors) {
        for (const [name, value] of Object.entries(customTheme.colors)) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i += 1) {
                    setCSSVariable(`${name}_${i}`, value[i], false);
                }
            } else {
                setCSSVariable(name, value);
            }
        }
    }
}

function getCustomTheme(themeName) {
    // set css variables
    const customThemes = SettingsStore.getValue("custom_themes");
    if (!customThemes) {
        throw new Error(`No custom themes set, can't set custom theme "${themeName}"`);
    }
    const customTheme = customThemes.find(t => t.name === themeName);
    if (!customTheme) {
        const knownNames = customThemes.map(t => t.name).join(", ");
        throw new Error(`Can't find custom theme "${themeName}", only know ${knownNames}`);
    }
    return customTheme;
}

/**
 * Called whenever someone changes the theme
 * Async function that returns once the theme has been set
 * (ie. the CSS has been loaded)
 *
 * @param {string} theme new theme
 */
export async function setTheme(theme) {
    if (!theme) {
        const themeWatcher = new ThemeWatcher();
        theme = themeWatcher.getEffectiveTheme();
    }
    let stylesheetName = theme;
    if (theme.startsWith("custom-")) {
        const customTheme = getCustomTheme(theme.substr(7));
        stylesheetName = customTheme.is_dark ? "dark-custom" : "light-custom";
        setCustomThemeVars(customTheme);
    }

    // look for the stylesheet elements.
    // styleElements is a map from style name to HTMLLinkElement.
    const styleElements = Object.create(null);
    let a;
    for (let i = 0; (a = document.getElementsByTagName("link")[i]); i++) {
        const href = a.getAttribute("href");
        // shouldn't we be using the 'title' tag rather than the href?
        const match = href.match(/^bundles\/.*\/theme-(.*)\.css$/);
        if (match) {
            styleElements[match[1]] = a;
        }
    }

    if (!(stylesheetName in styleElements)) {
        throw new Error("Unknown theme " + stylesheetName);
    }

    // disable all of them first, then enable the one we want. Chrome only
    // bothers to do an update on a true->false transition, so this ensures
    // that we get exactly one update, at the right time.
    //
    // ^ This comment was true when we used to use alternative stylesheets
    // for the CSS.  Nowadays we just set them all as disabled in index.html
    // and enable them as needed.  It might be cleaner to disable them all
    // at the same time to prevent loading two themes simultaneously and
    // having them interact badly... but this causes a flash of unstyled app
    // which is even uglier.  So we don't.

    styleElements[stylesheetName].disabled = false;

    return new Promise((resolve) => {
        const switchTheme = function() {
            // we re-enable our theme here just in case we raced with another
            // theme set request as per https://github.com/vector-im/riot-web/issues/5601.
            // We could alternatively lock or similar to stop the race, but
            // this is probably good enough for now.
            styleElements[stylesheetName].disabled = false;
            Object.values(styleElements).forEach((a) => {
                if (a == styleElements[stylesheetName]) return;
                a.disabled = true;
            });
            const bodyStyles = global.getComputedStyle(document.getElementsByTagName("body")[0]);
            if (bodyStyles.backgroundColor) {
                document.querySelector('meta[name="theme-color"]').content = bodyStyles.backgroundColor;
            }
            Tinter.setTheme(theme);
            resolve();
        };

        // turns out that Firefox preloads the CSS for link elements with
        // the disabled attribute, but Chrome doesn't.

        let cssLoaded = false;

        styleElements[stylesheetName].onload = () => {
            switchTheme();
        };

        for (let i = 0; i < document.styleSheets.length; i++) {
            const ss = document.styleSheets[i];
            if (ss && ss.href === styleElements[stylesheetName].href) {
                cssLoaded = true;
                break;
            }
        }

        if (cssLoaded) {
            styleElements[stylesheetName].onload = undefined;
            switchTheme();
        }
    });
}
