/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../SettingsStore";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import ThemeController from "../controllers/ThemeController";
import { findHighContrastTheme } from "../../theme";
import { type ActionPayload } from "../../dispatcher/payloads";
import { SettingLevel } from "../SettingLevel";

export enum ThemeWatcherEvent {
    Change = "change",
}

interface ThemeWatcherEventHandlerMap {
    [ThemeWatcherEvent.Change]: (theme: string) => void;
}

export default class ThemeWatcher extends TypedEventEmitter<ThemeWatcherEvent, ThemeWatcherEventHandlerMap> {
    private themeWatchRef?: string;
    private systemThemeWatchRef?: string;
    private dispatcherRef?: string;

    private preferDark: MediaQueryList;
    private preferLight: MediaQueryList;
    private preferHighContrast: MediaQueryList;

    private currentTheme: string;

    public constructor() {
        super();
        // we have both here as each may either match or not match, so by having both
        // we can get the tristate of dark/light/unsupported
        this.preferDark = (<any>global).matchMedia("(prefers-color-scheme: dark)");
        this.preferLight = (<any>global).matchMedia("(prefers-color-scheme: light)");
        this.preferHighContrast = (<any>global).matchMedia("(prefers-contrast: more)");

        this.currentTheme = this.getEffectiveTheme();
    }

    public start(): void {
        this.themeWatchRef = SettingsStore.watchSetting("theme", null, this.onChange);
        this.systemThemeWatchRef = SettingsStore.watchSetting("use_system_theme", null, this.onChange);
        this.preferDark.addEventListener("change", this.onChange);
        this.preferLight.addEventListener("change", this.onChange);
        this.preferHighContrast.addEventListener("change", this.onChange);
        this.dispatcherRef = dis.register(this.onAction);
    }

    public stop(): void {
        this.preferDark.removeEventListener("change", this.onChange);
        this.preferLight.removeEventListener("change", this.onChange);
        this.preferHighContrast.removeEventListener("change", this.onChange);
        SettingsStore.unwatchSetting(this.systemThemeWatchRef);
        SettingsStore.unwatchSetting(this.themeWatchRef);
        dis.unregister(this.dispatcherRef);
    }

    private onChange = (): void => {
        this.recheck();
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.RecheckTheme) {
            // XXX forceTheme
            this.recheck(payload.forceTheme);
        }
    };

    // XXX: forceTheme param added here as local echo appears to be unreliable
    // https://github.com/vector-im/element-web/issues/11443
    public recheck(forceTheme?: string): void {
        const oldTheme = this.currentTheme;
        this.currentTheme = forceTheme === undefined ? this.getEffectiveTheme() : forceTheme;
        if (oldTheme !== this.currentTheme) this.emit(ThemeWatcherEvent.Change, this.currentTheme);
    }

    public getEffectiveTheme(): string {
        // Dev note: Much of this logic is replicated in the AppearanceUserSettingsTab

        // XXX: checking the isLight flag here makes checking it in the ThemeController
        // itself completely redundant since we just override the result here and we're
        // now effectively just using the ThemeController as a place to store the static
        // variable. The system theme setting probably ought to have an equivalent
        // controller that honours the same flag, although probably better would be to
        // have the theme logic in one place rather than split between however many
        // different places.
        if (ThemeController.isLogin) return "light";

        // If the user has specifically enabled the system matching option (excluding default),
        // then use that over anything else. We pick the lowest possible level for the setting
        // to ensure the ordering otherwise works.
        const systemThemeExplicit = SettingsStore.getValueAt(
            SettingLevel.DEVICE,
            "use_system_theme",
            null,
            false,
            true,
        );
        if (systemThemeExplicit) {
            logger.log("returning explicit system theme");
            const theme = this.themeBasedOnSystem();
            if (theme) {
                return theme;
            }
        }

        // If the user has specifically enabled the theme (without the system matching option being
        // enabled specifically and excluding the default), use that theme. We pick the lowest possible
        // level for the setting to ensure the ordering otherwise works.
        const themeExplicit = SettingsStore.getValueAt(SettingLevel.DEVICE, "theme", null, false, true);
        if (themeExplicit) {
            logger.log("returning explicit theme: " + themeExplicit);
            return themeExplicit;
        }

        // If the user hasn't really made a preference in either direction, assume the defaults of the
        // settings and use those.
        if (SettingsStore.getValue("use_system_theme")) {
            const theme = this.themeBasedOnSystem();
            if (theme) {
                return theme;
            }
        }
        logger.log("returning theme value");
        return SettingsStore.getValue("theme");
    }

    private themeBasedOnSystem(): string | undefined {
        let newTheme: string | undefined;
        if (this.preferDark.matches) {
            newTheme = "dark";
        } else if (this.preferLight.matches) {
            newTheme = "light";
        }
        if (newTheme && this.preferHighContrast.matches) {
            const hcTheme = findHighContrastTheme(newTheme);
            if (hcTheme) {
                newTheme = hcTheme;
            }
        }
        return newTheme;
    }

    public isSystemThemeSupported(): boolean {
        return this.preferDark.matches || this.preferLight.matches;
    }
}
