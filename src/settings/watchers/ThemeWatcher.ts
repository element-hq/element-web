/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import SettingsStore from '../SettingsStore';
import dis from '../../dispatcher/dispatcher';
import { Action } from '../../dispatcher/actions';
import ThemeController from "../controllers/ThemeController";
import { setTheme } from "../../theme";
import { ActionPayload } from '../../dispatcher/payloads';
import { SettingLevel } from "../SettingLevel";

export default class ThemeWatcher {
    private themeWatchRef: string;
    private systemThemeWatchRef: string;
    private dispatcherRef: string;

    private preferDark: MediaQueryList;
    private preferLight: MediaQueryList;

    private currentTheme: string;

    constructor() {
        this.themeWatchRef = null;
        this.systemThemeWatchRef = null;
        this.dispatcherRef = null;

        // we have both here as each may either match or not match, so by having both
        // we can get the tristate of dark/light/unsupported
        this.preferDark = (<any>global).matchMedia("(prefers-color-scheme: dark)");
        this.preferLight = (<any>global).matchMedia("(prefers-color-scheme: light)");

        this.currentTheme = this.getEffectiveTheme();
    }

    public start() {
        this.themeWatchRef = SettingsStore.watchSetting("theme", null, this.onChange);
        this.systemThemeWatchRef = SettingsStore.watchSetting("use_system_theme", null, this.onChange);
        if (this.preferDark.addEventListener) {
            this.preferDark.addEventListener('change', this.onChange);
            this.preferLight.addEventListener('change', this.onChange);
        }
        this.dispatcherRef = dis.register(this.onAction);
    }

    public stop() {
        if (this.preferDark.addEventListener) {
            this.preferDark.removeEventListener('change', this.onChange);
            this.preferLight.removeEventListener('change', this.onChange);
        }
        SettingsStore.unwatchSetting(this.systemThemeWatchRef);
        SettingsStore.unwatchSetting(this.themeWatchRef);
        dis.unregister(this.dispatcherRef);
    }

    private onChange = () => {
        this.recheck();
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action === Action.RecheckTheme) {
            // XXX forceTheme
            this.recheck(payload.forceTheme);
        }
    };

    // XXX: forceTheme param added here as local echo appears to be unreliable
    // https://github.com/vector-im/element-web/issues/11443
    public recheck(forceTheme?: string) {
        const oldTheme = this.currentTheme;
        this.currentTheme = forceTheme === undefined ? this.getEffectiveTheme() : forceTheme;
        if (oldTheme !== this.currentTheme) {
            setTheme(this.currentTheme);
        }
    }

    public getEffectiveTheme(): string {
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
            if (this.preferDark.matches) return 'dark';
            if (this.preferLight.matches) return 'light';
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
            if (this.preferDark.matches) return 'dark';
            if (this.preferLight.matches) return 'light';
        }
        console.log("returning theme value");
        return SettingsStore.getValue('theme');
    }

    public isSystemThemeSupported() {
        return this.preferDark.matches || this.preferLight.matches;
    }
}
