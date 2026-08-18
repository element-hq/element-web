/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import {
    Button,
    ErrorMessage,
    Field,
    HelpMessage,
    IconButton,
    Label,
    Root,
    Text,
    TextControl,
} from "@vector-im/compound-web";
import { DeleteIcon, RestartIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t, _td } from "..";
import { useViewModel, type ViewModel } from "../core/viewmodel";
import styles from "./CustomThemesView.module.css";

/**
 * Why an attempt to add a custom theme failed.
 *
 * The view model reports the failure as one of these values rather than as a
 * message, so that the view stays the only layer that knows about translations.
 */
export const CustomThemeError = {
    /** The downloaded document was not a valid theme (missing or invalid `name` / `colors`). */
    InvalidSchema: "InvalidSchema",
    /** The URL could not be fetched, or the response was not JSON. */
    DownloadFailed: "DownloadFailed",
    /** A theme with the same name is already installed. */
    AlreadyInstalled: "AlreadyInstalled",
    /** A write to the settings store did not complete (or wasn't confirmed) in time. */
    SaveFailed: "SaveFailed",
} as const;
export type CustomThemeError = (typeof CustomThemeError)[keyof typeof CustomThemeError];

const ERROR_LABELS: Record<CustomThemeError, TranslationKey> = {
    [CustomThemeError.InvalidSchema]: _td("devtools|custom_themes|error_invalid"),
    [CustomThemeError.DownloadFailed]: _td("devtools|custom_themes|error_downloading"),
    [CustomThemeError.AlreadyInstalled]: _td("devtools|custom_themes|error_already_installed"),
    [CustomThemeError.SaveFailed]: _td("devtools|custom_themes|error_save_failed"),
};

export interface CustomThemeInfo {
    /**
     * The theme's name, as declared in its definition.
     */
    name: string;
    /**
     * Whether this theme records the URL it came from, and so can be re-downloaded. False for
     * themes that were added before we started recording that URL.
     */
    canRefresh: boolean;
    /**
     * Whether this theme is currently being re-downloaded.
     */
    isRefreshing: boolean;
    /**
     * Why the last attempt to refresh this theme failed, or `null` if there is nothing to report.
     */
    error: CustomThemeError | null;
}

export interface CustomThemesViewSnapshot {
    /**
     * The currently installed custom themes.
     */
    themes: readonly CustomThemeInfo[];
    /**
     * The URL currently entered into the "add theme" field.
     */
    url: string;
    /**
     * Whether a theme is currently being downloaded.
     */
    isDownloading: boolean;
    /**
     * Why the last attempt to add a theme failed, or `null` if there is nothing to report.
     */
    error: CustomThemeError | null;
}

export interface CustomThemesViewActions {
    /**
     * Called when the user edits the URL field. Also clears any error being shown.
     */
    setUrl: (url: string) => void;
    /**
     * Called when the user submits the form. Downloads and installs the theme at the current URL.
     */
    addTheme: () => Promise<void>;
    /**
     * Called when the user deletes an installed theme.
     */
    removeTheme: (name: string) => Promise<void>;
    /**
     * Called when the user re-downloads an installed theme from the URL it came from.
     */
    refreshTheme: (name: string) => Promise<void>;
}

export type CustomThemesViewModel = ViewModel<CustomThemesViewSnapshot, CustomThemesViewActions>;

export interface CustomThemesViewProps {
    vm: CustomThemesViewModel;
}

/**
 * Developer tool for installing custom themes from a URL, and removing installed ones.
 */
export function CustomThemesView({ vm }: CustomThemesViewProps): JSX.Element {
    const { themes, url, isDownloading, error } = useViewModel(vm);

    return (
        <div className={styles.customThemes}>
            <Root
                className={styles.form}
                onSubmit={(evt) => {
                    evt.preventDefault();
                    void vm.addTheme();
                }}
            >
                <Field name="customThemeUrl">
                    <Label>{_t("devtools|custom_themes|url_label")}</Label>
                    {/* Deliberately not disabled while downloading: disabling it dims the help
                        message below the minimum contrast ratio, and the view model already
                        ignores a second submit while one is in flight. */}
                    <TextControl value={url} onChange={(evt) => vm.setUrl(evt.target.value)} />
                    {error ? (
                        <ErrorMessage>{_t(ERROR_LABELS[error])}</ErrorMessage>
                    ) : (
                        <HelpMessage>{_t("devtools|custom_themes|help")}</HelpMessage>
                    )}
                </Field>
                <Button type="submit" size="md" disabled={isDownloading || url.trim() === ""}>
                    {isDownloading ? _t("devtools|custom_themes|downloading") : _t("devtools|custom_themes|add")}
                </Button>
            </Root>
            {themes.length > 0 && (
                <ul className={styles.list} aria-label={_t("devtools|custom_themes|installed_heading")}>
                    {themes.map((theme) => (
                        <li key={theme.name} className={styles.theme} aria-label={theme.name}>
                            <div className={styles.row}>
                                <span className={styles.name}>{theme.name}</span>
                                {theme.canRefresh && (
                                    <IconButton
                                        aria-label={_t("devtools|custom_themes|refresh")}
                                        tooltip={_t("devtools|custom_themes|refresh")}
                                        disabled={theme.isRefreshing}
                                        onClick={() => void vm.refreshTheme(theme.name)}
                                    >
                                        <RestartIcon />
                                    </IconButton>
                                )}
                                <IconButton
                                    destructive={true}
                                    aria-label={_t("action|delete")}
                                    tooltip={_t("action|delete")}
                                    disabled={theme.isRefreshing}
                                    onClick={() => void vm.removeTheme(theme.name)}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </div>
                            {theme.error && (
                                // Not an ErrorMessage: that is a form message and must live inside a Field
                                <Text as="span" size="sm" className={styles.error}>
                                    {_t(ERROR_LABELS[theme.error])}
                                </Text>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
