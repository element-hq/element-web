/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ChangeEvent, type JSX, useCallback, useMemo, useState } from "react";
import {
    InlineField,
    ToggleControl,
    Label,
    Root,
    RadioControl,
    EditInPlace,
    IconButton,
    ErrorMessage,
    HelpMessage,
} from "@vector-im/compound-web";
import DeleteIcon from "@vector-im/compound-design-tokens/assets/web/icons/delete";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { SettingsSubsection } from "./shared/SettingsSubsection";
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import dis from "../../../dispatcher/dispatcher";
import { type RecheckThemePayload } from "../../../dispatcher/payloads/RecheckThemePayload";
import { Action } from "../../../dispatcher/actions";
import { useTheme } from "../../../hooks/useTheme";
import {
    findHighContrastTheme,
    getOrderedThemes,
    type CustomTheme as CustomThemeType,
    type ITheme,
} from "../../../theme";
import { useSettingValue } from "../../../hooks/useSettings";

/**
 * Panel to choose the theme
 */
export function ThemeChoicePanel(): JSX.Element {
    const themeState = useTheme();
    const themeWatcher = useMemo(() => new ThemeWatcher(), []);
    const customThemeEnabled = useSettingValue("feature_custom_themes");

    return (
        <SettingsSubsection heading={_t("common|theme")} legacy={false} data-testid="themePanel">
            {themeWatcher.isSystemThemeSupported() && (
                <SystemTheme systemThemeActivated={themeState.systemThemeActivated} />
            )}
            <ThemeSelectors theme={themeState.theme} disabled={themeState.systemThemeActivated} />
            {customThemeEnabled && <CustomTheme theme={themeState.theme} />}
        </SettingsSubsection>
    );
}

/**
 * Component to toggle the system theme
 */
interface SystemThemeProps {
    /* Whether the system theme is activated */
    systemThemeActivated: boolean;
}

/**
 * Component to toggle the system theme
 */
function SystemTheme({ systemThemeActivated }: SystemThemeProps): JSX.Element {
    return (
        <Root
            onChange={async (evt) => {
                const checked = new FormData(evt.currentTarget).get("systemTheme") === "on";
                await SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, checked);
                dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
            }}
        >
            <InlineField
                name="systemTheme"
                control={<ToggleControl name="systemTheme" defaultChecked={systemThemeActivated} />}
            >
                <Label>{SettingsStore.getDisplayName("use_system_theme")}</Label>
            </InlineField>
        </Root>
    );
}

/**
 * Component to select the theme
 */
interface ThemeSelectorProps {
    /* The current theme */
    theme: string;
    /* The theme can't be selected */
    disabled: boolean;
}

/**
 * Component to select the theme
 */
function ThemeSelectors({ theme, disabled }: ThemeSelectorProps): JSX.Element {
    const themes = useThemes();

    return (
        <Root
            className="mx_ThemeChoicePanel_ThemeSelectors"
            onChange={async (evt) => {
                // We don't have any file in the form, we can cast it as string safely
                const newTheme = new FormData(evt.currentTarget).get("themeSelector") as string | null;

                // Do nothing if the same theme is selected
                if (!newTheme || theme === newTheme) return;

                // doing getValue in the .catch will still return the value we failed to set,
                SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme).catch(() => {
                    dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
                });

                // The settings watcher doesn't fire until the echo comes back from the
                // server, so to make the theme change immediately we need to manually
                // do the dispatch now
                // XXX: The local echoed value appears to be unreliable, in particular
                // when settings custom themes(!) so adding forceTheme to override
                // the value from settings.
                dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme, forceTheme: newTheme });
            }}
        >
            {themes.map((_theme) => {
                const isChecked = theme === _theme.id;
                return (
                    <InlineField
                        className={classNames("mx_ThemeChoicePanel_themeSelector", {
                            [`mx_ThemeChoicePanel_themeSelector_enabled`]: !disabled && theme === _theme.id,
                            [`mx_ThemeChoicePanel_themeSelector_disabled`]: disabled,
                            // We need to force the compound theme to be light or dark
                            // The theme selection doesn't depend on the current theme
                            // For example when the light theme is used, the dark theme selector should be dark
                            "cpd-theme-light": !_theme.isDark,
                            "cpd-theme-dark": _theme.isDark,
                        })}
                        name="themeSelector"
                        key={_theme.id}
                        control={
                            <RadioControl
                                name="themeSelector"
                                checked={!disabled && isChecked}
                                disabled={disabled}
                                value={_theme.id}
                            />
                        }
                    >
                        <Label className="mx_ThemeChoicePanel_themeSelector_Label">{_theme.name}</Label>
                    </InlineField>
                );
            })}
        </Root>
    );
}

/**
 * Return all the available themes
 */
function useThemes(): Array<ITheme & { isDark: boolean }> {
    const customThemes = useSettingValue("custom_themes");
    return useMemo(() => {
        // Put the custom theme into a map
        // To easily find the theme by name when going through the themes list
        const checkedCustomThemes = customThemes || [];
        const customThemeMap = checkedCustomThemes.reduce(
            (map, theme) => map.set(theme.name, theme),
            new Map<string, CustomThemeType>(),
        );

        const themes = getOrderedThemes();
        // Separate the built-in themes from the custom themes
        // To insert the high contrast theme between them
        const builtInThemes = themes.filter((theme) => !customThemeMap.has(theme.name));
        const otherThemes = themes.filter((theme) => customThemeMap.has(theme.name));

        const highContrastTheme = makeHighContrastTheme();
        if (highContrastTheme) builtInThemes.push(highContrastTheme);

        const allThemes = builtInThemes.concat(otherThemes);

        // Check if the themes are dark
        return allThemes.map((theme) => {
            const customTheme = customThemeMap.get(theme.name);
            const isDark = (customTheme ? customTheme.is_dark : theme.id.includes("dark")) || false;
            return { ...theme, isDark };
        });
    }, [customThemes]);
}

/**
 * Create the light high contrast theme
 */
function makeHighContrastTheme(): ITheme | undefined {
    const lightHighContrastId = findHighContrastTheme("light");
    if (lightHighContrastId) {
        return {
            name: _t("settings|appearance|high_contrast"),
            id: lightHighContrastId,
        };
    }
}

interface CustomThemeProps {
    /**
     * The current theme
     */
    theme: string;
}

/**
 * Add and manager custom themes
 */
function CustomTheme({ theme }: CustomThemeProps): JSX.Element {
    const [customTheme, setCustomTheme] = useState<string>("");
    const [error, setError] = useState<string>();
    const clear = useCallback(() => {
        setError(undefined);
        setCustomTheme("");
    }, [setError, setCustomTheme]);

    return (
        <div className="mx_ThemeChoicePanel_CustomTheme">
            <EditInPlace
                className="mx_ThemeChoicePanel_CustomTheme_EditInPlace"
                label={_t("settings|appearance|custom_theme_add")}
                cancelButtonLabel={_t("action|cancel")}
                saveButtonLabel={_t("settings|appearance|custom_theme_add")}
                savingLabel={_t("settings|appearance|custom_theme_downloading")}
                value={customTheme}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setError(undefined);
                    setCustomTheme(e.target.value);
                }}
                onSave={async () => {
                    // The field empty is empty
                    if (!customTheme) return;

                    // Get the custom themes and do a cheap clone
                    // To avoid to mutate the original array in the settings
                    const currentThemes = SettingsStore.getValue("custom_themes").map((t) => t) || [];

                    try {
                        const r = await fetch(customTheme);
                        // XXX: need some schema for this
                        const themeInfo = await r.json();
                        if (
                            !themeInfo ||
                            typeof themeInfo["name"] !== "string" ||
                            typeof themeInfo["colors"] !== "object"
                        ) {
                            setError(_t("settings|appearance|custom_theme_invalid"));
                            return;
                        }

                        // Check if the theme is already existing
                        const isAlreadyExisting = Boolean(currentThemes.find((t) => t.name === themeInfo.name));
                        if (isAlreadyExisting) {
                            clear();
                            return;
                        }

                        currentThemes.push(themeInfo);
                    } catch (e) {
                        logger.error(e);
                        setError(_t("settings|appearance|custom_theme_error_downloading"));
                        return;
                    }

                    // Reset the error
                    clear();
                    await SettingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, currentThemes);
                }}
                onCancel={clear}
            >
                <HelpMessage>{_t("settings|appearance|custom_theme_help")}</HelpMessage>
                {error && <ErrorMessage>{error}</ErrorMessage>}
            </EditInPlace>
            <CustomThemeList theme={theme} />
        </div>
    );
}

interface CustomThemeListProps {
    /*
     * The current theme
     */
    theme: string;
}

/**
 * List of the custom themes
 */
function CustomThemeList({ theme: currentTheme }: CustomThemeListProps): JSX.Element {
    const customThemes = useSettingValue("custom_themes") || [];

    return (
        <ul className="mx_ThemeChoicePanel_CustomThemeList">
            {customThemes.map((theme) => {
                return (
                    <li key={theme.name} className="mx_ThemeChoicePanel_CustomThemeList_theme" aria-label={theme.name}>
                        <span className="mx_ThemeChoicePanel_CustomThemeList_name">{theme.name}</span>
                        <IconButton
                            destructive={true}
                            aria-label={_t("action|delete")}
                            tooltip={_t("action|delete")}
                            onClick={async () => {
                                // Get the custom themes and do a cheap clone
                                // To avoid to mutate the original array in the settings
                                const currentThemes = SettingsStore.getValue("custom_themes").map((t) => t) || [];

                                // Remove the theme from the list
                                const newThemes = currentThemes.filter((t) => t.name !== theme.name);
                                await SettingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, newThemes);

                                // If the delete custom theme is the current theme, reset the theme to the default theme
                                // By settings the theme at null at the device level, we are getting the default theme
                                if (currentTheme === `custom-${theme.name}`) {
                                    await SettingsStore.setValue("theme", null, SettingLevel.DEVICE, null);
                                    dis.dispatch<RecheckThemePayload>({
                                        action: Action.RecheckTheme,
                                    });
                                }
                            }}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </li>
                );
            })}
        </ul>
    );
}
