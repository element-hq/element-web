/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    _t,
    normalizeLanguageKey,
    type StringVariables,
    getLangsJson,
    getLocale,
    setMissingEntryGenerator as setMissingEntryGeneratorSharedComponents,
} from "@element-hq/web-shared-components";

import { getUserLanguage } from "./i18n/settings.ts";

export {
    _t,
    type IVariables,
    type Tags,
    type TranslatedString,
    _td,
    _tDom,
    lookupString,
    sanitizeForTranslation,
    normalizeLanguageKey,
    getNormalizedLanguageKeys,
    substitute,
} from "@element-hq/web-shared-components";

export interface ErrorOptions {
    // Because we're mixing the substitution variables and `cause` into the same object
    // below, we want them to always explicitly say whether there is an underlying error
    // or not to avoid typos of "cause" slipping through unnoticed.
    cause: unknown | undefined;
}

/**
 * Used to rethrow an error with a user-friendly translatable message while maintaining
 * access to that original underlying error. Downstream consumers can display the
 * `translatedMessage` property in the UI and inspect the underlying error with the
 * `cause` property.
 *
 * The error message will display as English in the console and logs so Element
 * developers can easily understand the error and find the source in the code. It also
 * helps tools like Sentry deduplicate the error, or just generally searching in
 * rageshakes to find all instances regardless of the users locale.
 *
 * @param message - The untranslated error message text, e.g "Something went wrong with %(foo)s".
 * @param substitutionVariablesAndCause - Variable substitutions for the translation and
 * original cause of the error. If there is no cause, just pass `undefined`, e.g { foo:
 * 'bar', cause: err || undefined }
 */
export class UserFriendlyError extends Error {
    public readonly translatedMessage: string;

    public constructor(
        message: TranslationKey,
        substitutionVariablesAndCause?: Omit<StringVariables, keyof ErrorOptions> | ErrorOptions,
    ) {
        // Prevent "Could not find /%\(cause\)s/g in x" logs to the console by removing it from the list
        const { cause, ...substitutionVariables } = substitutionVariablesAndCause ?? {};
        const errorOptions = { cause };

        // Create the error with the English version of the message that we want to show up in the logs
        const englishTranslatedMessage = _t(message, { ...substitutionVariables, locale: "en" });
        super(englishTranslatedMessage, errorOptions);

        // Also provide a translated version of the error in the users locale to display
        this.translatedMessage = _t(message, substitutionVariables);
    }
}

/**
 * Allow overriding the text displayed when no translation exists
 * Currently only used in unit tests to avoid having to load
 * the translations in element-web
 * @knipignore
 */
export function setMissingEntryGenerator(f: (value: string) => void): void {
    setMissingEntryGeneratorSharedComponents(f);
}

type Language = {
    value: string;
    label: string; // translated
    labelInTargetLanguage: string; // translated
};

export async function getAllLanguagesFromJson(): Promise<string[]> {
    return Object.keys(await getLangsJson());
}

export async function getAllLanguagesWithLabels(): Promise<Language[]> {
    const languageNames = new Intl.DisplayNames([getUserLanguage()], { type: "language", style: "short" });
    const languages = await getAllLanguagesFromJson();
    return languages.map<Language>((langKey) => {
        return {
            value: langKey,
            label: languageNames.of(langKey)!,
            labelInTargetLanguage: new Intl.DisplayNames([langKey], { type: "language", style: "short" }).of(langKey)!,
        };
    });
}

export function getCurrentLanguage(): string {
    return getLocale();
}

/**
 * Given a list of language codes, pick the most appropriate one
 * given the current language (ie. getCurrentLanguage())
 * English is assumed to be a reasonable default.
 *
 * @param {string[]} langs List of language codes to pick from
 * @returns {string} The most appropriate language code from langs
 */
export function pickBestLanguage(langs: string[]): string {
    const currentLang = getCurrentLanguage();
    const normalisedLangs = langs.map(normalizeLanguageKey);

    {
        // Best is an exact match
        const currentLangIndex = normalisedLangs.indexOf(currentLang);
        if (currentLangIndex > -1) return langs[currentLangIndex];
    }

    {
        // Failing that, a different dialect of the same language
        const closeLangIndex = normalisedLangs.findIndex((l) => l.slice(0, 2) === currentLang.slice(0, 2));
        if (closeLangIndex > -1) return langs[closeLangIndex];
    }

    {
        // Neither of those? Try an english variant.
        const enIndex = normalisedLangs.findIndex((l) => l.startsWith("en"));
        if (enIndex > -1) return langs[enIndex];
    }

    // if nothing else, use the first
    return langs[0];
}
