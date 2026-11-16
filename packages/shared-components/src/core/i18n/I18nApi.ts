/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type I18nApi as II18nApi,
    type Variables,
    type Translations,
    type Tags,
} from "@element-hq/element-web-module-api";

import { humanizeTime } from "../utils/humanize";
import { _t, getLocale, KEY_SEPARATOR, registerTranslations } from "./i18n";

export class I18nApi implements II18nApi {
    /**
     * @param namespace - Path of keys that `register` and `translate` nest every key under, empty for no namespace
     * @param root - The un-namespaced API this one was derived from, if any
     */
    public constructor(
        private readonly namespace: string[] = [],
        private readonly root?: I18nApi,
    ) {}

    /**
     * Read the current language of the user in IETF Language Tag format
     */
    public get language(): string {
        return getLocale();
    }

    /**
     * Register translations for the module, may override app's existing translations
     */
    public register = (translations: Partial<Translations>): void => {
        const langs: Record<string, Record<string, string>> = {};

        for (const key in translations) {
            for (const lang in translations[key]) {
                langs[lang] = langs[lang] || {};
                langs[lang][key] = translations[key][lang];
            }
        }

        // Finally, tell counterpart about our translations, nested under the namespace
        for (const lang in langs) {
            registerTranslations(
                lang,
                this.namespace.reduceRight<object>((data, segment) => ({ [segment]: data }), langs[lang]),
            );
        }
    };

    /**
     * Perform a translation, with optional variables
     * @param key - The key to translate
     * @param variables - Optional variables to interpolate into the translation
     * @param tags - Optional tags to interpolate into the translation
     */
    // The cast lets an arrow function satisfy the overloads; `TranslationKey` only lists the app's own keys
    public translate = ((key: string, variables?: Variables, tags?: Tags): React.ReactNode | string => {
        const namespacedKey = [...this.namespace, key].join(KEY_SEPARATOR) as TranslationKey;
        if (tags) return _t(namespacedKey, variables, tags);
        return _t(namespacedKey, variables!);
    }) as II18nApi["translate"];

    // Uses the app's own translations, so it must go through the un-namespaced API
    public humanizeTime = (timeMillis: number): string => humanizeTime(timeMillis, this.root ?? this);

    /**
     * Get a copy of this API whose `register` and `translate` prefix every key with the given namespace
     * @param namespace - The prefix for every key
     */
    public namespaced = (namespace: string): II18nApi =>
        new I18nApi([...this.namespace, ...namespace.split(KEY_SEPARATOR)], this.root ?? this);
}
