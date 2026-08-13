/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    CustomThemeError,
    type CustomThemeInfo,
    type CustomThemesViewActions,
    type CustomThemesViewSnapshot,
} from "@element-hq/web-shared-components";

import type SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import { type MatrixDispatcher } from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type RecheckThemePayload } from "../../dispatcher/payloads/RecheckThemePayload";
import { type CustomTheme } from "../../theme";

/**
 * The subset of {@link SettingsStore} that this view model depends on.
 */
export type CustomThemesSettingsStore = Pick<
    typeof SettingsStore,
    "getValue" | "setValue" | "watchSetting" | "unwatchSetting"
>;

export interface CustomThemesViewModelProps {
    /**
     * The settings store holding the `custom_themes` and `theme` settings.
     */
    settingsStore: CustomThemesSettingsStore;
    /**
     * The dispatcher used to ask the app to re-evaluate the active theme.
     */
    dispatcher: MatrixDispatcher;
}

/**
 * View model backing the custom themes developer tool.
 *
 * Owns downloading a theme from a URL, validating it, and adding it to (or removing it from)
 * the `custom_themes` account setting.
 */
export class CustomThemesViewModel
    extends BaseViewModel<CustomThemesViewSnapshot, CustomThemesViewModelProps>
    implements CustomThemesViewActions
{
    /**
     * Transient per-theme refresh state, keyed by theme name. Kept outside the settings store so
     * that rebuilding the theme list from settings doesn't discard it.
     */
    private refreshState = new Map<string, { isRefreshing: boolean; error: CustomThemeError | null }>();

    public constructor(props: CustomThemesViewModelProps) {
        super(props, {
            themes: [],
            url: "",
            isDownloading: false,
            error: null,
        });
        this.snapshot.merge({ themes: this.buildThemes() });

        const watcherRef = props.settingsStore.watchSetting("custom_themes", null, this.onCustomThemesChanged);
        this.disposables.track(() => props.settingsStore.unwatchSetting(watcherRef));
    }

    /**
     * Read the installed custom themes out of the settings store.
     */
    private getInstalledThemes(): CustomTheme[] {
        return this.props.settingsStore.getValue("custom_themes") || [];
    }

    /**
     * Build the theme list for the snapshot by combining what is stored in settings with the
     * transient refresh state.
     */
    private buildThemes(): CustomThemeInfo[] {
        return this.getInstalledThemes().map((theme) => ({
            name: theme.name,
            // Themes added before we started recording the source URL cannot be re-downloaded
            canRefresh: Boolean(theme.source_url),
            isRefreshing: this.refreshState.get(theme.name)?.isRefreshing ?? false,
            error: this.refreshState.get(theme.name)?.error ?? null,
        }));
    }

    private onCustomThemesChanged = (): void => {
        this.snapshot.merge({ themes: this.buildThemes() });
    };

    /**
     * Download and validate the theme at the given URL.
     *
     * @returns the theme, or the reason it could not be used.
     */
    private async downloadTheme(url: string): Promise<{ theme: CustomTheme } | { error: CustomThemeError }> {
        let themeInfo: CustomTheme;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
            // XXX: need some schema for this
            themeInfo = await response.json();
        } catch (e) {
            logger.error(e);
            return { error: CustomThemeError.DownloadFailed };
        }

        if (!themeInfo || typeof themeInfo["name"] !== "string" || typeof themeInfo["colors"] !== "object") {
            return { error: CustomThemeError.InvalidSchema };
        }

        // Record where the theme came from so that it can be re-downloaded later
        return { theme: { ...themeInfo, source_url: url } };
    }

    public setUrl = (url: string): void => {
        this.snapshot.merge({ url, error: null });
    };

    public addTheme = async (): Promise<void> => {
        const url = this.snapshot.current.url.trim();
        // Ignore an empty field, and don't let a second submit race the first
        if (!url || this.snapshot.current.isDownloading) return;

        this.snapshot.merge({ isDownloading: true, error: null });
        try {
            const result = await this.downloadTheme(url);
            if ("error" in result) {
                this.snapshot.merge({ error: result.error });
                return;
            }

            // Cheap clone so that we never mutate the array held inside the settings store
            const themes = [...this.getInstalledThemes()];
            if (themes.some((theme) => theme.name === result.theme.name)) {
                this.snapshot.merge({ error: CustomThemeError.AlreadyInstalled });
                return;
            }
            themes.push(result.theme);

            await this.props.settingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, themes);
            this.snapshot.merge({ url: "", error: null, themes: this.buildThemes() });
        } finally {
            this.snapshot.merge({ isDownloading: false });
        }
    };

    public refreshTheme = async (name: string): Promise<void> => {
        const existing = this.getInstalledThemes().find((theme) => theme.name === name);
        // Themes added before we started recording the source URL cannot be re-downloaded
        if (!existing?.source_url || this.refreshState.get(name)?.isRefreshing) return;

        this.setRefreshState(name, { isRefreshing: true, error: null });
        try {
            const result = await this.downloadTheme(existing.source_url);
            if ("error" in result) {
                this.setRefreshState(name, { isRefreshing: false, error: result.error });
                return;
            }

            // Replace the theme in place so that its position in the list is preserved
            const themes = this.getInstalledThemes().map((theme) => (theme.name === name ? result.theme : theme));
            await this.props.settingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, themes);
            this.refreshState.delete(name);

            // Re-apply the theme so that the new colours take effect immediately
            if (this.props.settingsStore.getValue("theme") === `custom-${result.theme.name}`) {
                this.props.dispatcher.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
            }
        } finally {
            this.setRefreshState(name, { isRefreshing: false, error: this.refreshState.get(name)?.error ?? null });
        }
    };

    /**
     * Update the transient refresh state for a theme and republish the theme list.
     */
    private setRefreshState(name: string, state: { isRefreshing: boolean; error: CustomThemeError | null }): void {
        if (!state.isRefreshing && !state.error) {
            this.refreshState.delete(name);
        } else {
            this.refreshState.set(name, state);
        }
        this.snapshot.merge({ themes: this.buildThemes() });
    }

    public removeTheme = async (name: string): Promise<void> => {
        // This has to be read *before* we write `custom_themes`: ThemeController rewrites the
        // `theme` setting to the default as soon as the custom theme stops existing, so afterwards
        // we can no longer tell whether the theme we just deleted was the active one.
        const wasActive = this.props.settingsStore.getValue("theme") === `custom-${name}`;

        const themes = this.getInstalledThemes().filter((theme) => theme.name !== name);
        await this.props.settingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, themes);
        this.refreshState.delete(name);
        this.snapshot.merge({ themes: this.buildThemes() });

        if (wasActive) {
            // Setting the theme to null at the device level falls back to the default theme
            await this.props.settingsStore.setValue("theme", null, SettingLevel.DEVICE, null);
            this.props.dispatcher.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
        }
    };
}
