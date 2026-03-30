/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";

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
 * The value a variable or tag can take for a translation interpolation.
 *
 * When used as a function, `sub` is the text content wrapped between the tag
 * in the translation string. For example, given `"Click <a>here</a>"`, the
 * function receives `"here"` and should return a `ReactNode` wrapping it.
 *
 * @public
 */
export type SubstitutionValue = number | string | ReactNode | ((sub: string) => ReactNode);

/**
 * Variables to interpolate into a translation.
 * @public
 */
export type Variables = {
    /**
     * The number of items to count for pluralised translations
     */
    count?: number;
    [key: string]: SubstitutionValue;
};

/**
 * Tags to interpolate into a translation, where the value is a ReactNode or a function that returns a ReactNode.
 * This allows for more complex interpolations, such as links or formatted text.
 * @public
 */
export type Tags = Record<string, SubstitutionValue>;

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
    register(this: void, translations: Partial<Translations>): void;

    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     */
    translate(this: void, key: keyof Translations, variables?: Variables): string;
    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     * @param tags - Optional tags to interpolate into the translation
     */
    translate(this: void, key: keyof Translations, variables: Variables | undefined, tags: Tags): ReactNode;

    /**
     * Convert a timestamp into a translated, human-readable time,
     * using the current system time as a reference, eg. "5 minutes ago".
     * @param timeMillis - The time in milliseconds since epoch
     */
    humanizeTime(this: void, timeMillis: number): string;
}
