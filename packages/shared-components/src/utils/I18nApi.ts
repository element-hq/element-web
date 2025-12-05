/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type I18nApi as II18nApi, type Variables, type Translations } from "@element-hq/element-web-module-api";

import { humanizeTime } from "./humanize";
import { _t, getLocale, registerTranslations } from "./i18n";
import { type TranslationKey } from "../i18nKeys";

export class I18nApi implements II18nApi {
    /**
     * Read the current language of the user in IETF Language Tag format
     */
    public get language(): string {
        return getLocale();
    }

    /**
     * Register translations for the module, may override app's existing translations
     */
    public register(translations: Partial<Translations>): void {
        const langs: Record<string, Record<string, string>> = {};
        for (const key in translations) {
            for (const lang in translations[key]) {
                langs[lang] = langs[lang] || {};
                langs[lang][key] = translations[key][lang];
            }
        }

        // Finally, tell counterpart about our translations
        for (const lang in langs) {
            registerTranslations(lang, langs[lang]);
        }
    }

    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     */
    public translate(key: TranslationKey, variables?: Variables): string {
        return _t(key, variables);
    }

    public humanizeTime(timeMillis: number): string {
        return humanizeTime(timeMillis, this);
    }
}
