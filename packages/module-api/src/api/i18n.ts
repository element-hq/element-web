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
 * The translations for a single language, keyed by translation key.
 * A nested object groups keys, which are then translated by joining them with `|`, e.g. `"group|key"`.
 * @public
 */
export interface LanguageTranslations {
    [key: string]: string | LanguageTranslations;
}

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
export type Variables = StringVariables | RichVariables;

/**
 * Variables that are guaranteed to only contain primitive (string-safe) values
 * @public
 */
export interface StringVariables {
    count?: number;
    [key: string]: number | string | null | undefined;
}

/**
 * Variables that may contain ReactNodes or functions, requiring a ReactNode return
 * @public
 */
export interface RichVariables {
    count?: number;
    [key: string]: SubstitutionValue;
}

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
     * Register translations for the module, may override app's existing translations.
     * Modules should namespace their translations to avoid being stepped on.
     */
    register(this: void, translations: Partial<Translations>): void;

    /**
     * Register the translations for a single language, may override app's existing translations.
     * Modules should namespace their translations to avoid being stepped on.
     * @param language - The language, as an IETF language tag such as `de-DE`, or with an underscore such as `de_DE`
     * @param translations - The translations for that language, keyed by translation key
     */
    registerLanguage(this: void, language: string, translations: LanguageTranslations): void;

    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     */
    translate(this: void, key: keyof Translations, variables?: StringVariables): string;
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

    /**
     * Get a copy of this API whose `register`, `registerLanguage` and `translate` prefix every key with the given
     * namespace, so that a module's translations cannot clash with those of the app or of other modules.
     * @param namespace - The prefix for every key, such as the module's config key
     */
    namespaced(this: void, namespace: string): I18nApi;
}
