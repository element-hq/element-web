/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { getLangsJson, getLocale, normalizeLanguageKey } from "@element-hq/web-shared-components";

async function getAllLanguagesFromJson(): Promise<string[]> {
    return Object.keys(await getLangsJson());
}

type Language = {
    value: string;
    label: string; // translated
    labelInTargetLanguage: string; // translated
};

export async function getAllLanguagesWithLabels(): Promise<Language[]> {
    const languageNames = new Intl.DisplayNames([getLocale()], { type: "language", style: "short" });
    const languages = await getAllLanguagesFromJson();
    return languages.map<Language>((langKey) => {
        return {
            value: langKey,
            label: languageNames.of(langKey)!,
            labelInTargetLanguage: new Intl.DisplayNames([langKey], { type: "language", style: "short" }).of(langKey)!,
        };
    });
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
    const currentLang = getLocale();
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
