/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Query the browser for the user's language preferences
 */
export function getLanguagesFromBrowser(): readonly string[] {
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    return [navigator.language ?? "en"];
}

/**
 * Query the browser for the user's primary language preference
 */
export function getLanguageFromBrowser(): string {
    return getLanguagesFromBrowser()[0];
}
