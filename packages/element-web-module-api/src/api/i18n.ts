/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The translations for the module.
 * @public
 */
export type Translations = Record<
    string,
    {
        [ietfLanguageTag: string]: string;
    }
>;

/**
 * Variables to interpolate into a translation.
 * @public
 */
export type Variables = {
    /**
     * The number of items to count for pluralised translations
     */
    count?: number;
    [key: string]: number | string | undefined;
};

/**
 * The API for interacting with translations.
 * @public
 */
export interface I18nApi {
    /**
     * Read the current language of the user in IETF Language Tag format
     */
    get language(): string;

    /**
     * Register translations for the module, may override app's existing translations
     */
    register(translations: Partial<Translations>): void;

    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     */
    translate(key: keyof Translations, variables?: Variables): string;

    /**
     * Convert a timestamp into a human-readable time string
     * @param timeMillis - The time in milliseconds since epoch
     */
    humanizeTime(timeMillis: number): string;
}
