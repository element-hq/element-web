/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import counterpart from "counterpart";
import { type TranslationKey as TKey } from "matrix-web-i18n";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type EN from "./i18n/strings/en_EN.json";
import { loadJsonFile } from "./utils.js";
import type Store from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FALLBACK_LOCALE = "en";

type TranslationKey = TKey<typeof EN>;

type SubstitutionValue = number | string;

interface Variables {
    [key: string]: SubstitutionValue | undefined;
    count?: number;
}

export function _t(text: TranslationKey, variables: Variables = {}): string {
    const { count } = variables;

    // Horrible hack to avoid https://github.com/vector-im/element-web/issues/4191
    // The interpolation library that counterpart uses does not support undefined/null
    // values and instead will throw an error. This is a problem since everywhere else
    // in JS land passing undefined/null will simply stringify instead, and when converting
    // valid ES6 template strings to i18n strings it's extremely easy to pass undefined/null
    // if there are no existing null guards. To avoid this making the app completely inoperable,
    // we'll check all the values for undefined/null and stringify them here.
    Object.keys(variables).forEach((key) => {
        if (variables[key] === undefined) {
            console.warn("safeCounterpartTranslate called with undefined interpolation name: " + key);
            variables[key] = "undefined";
        }
        if (variables[key] === null) {
            console.warn("safeCounterpartTranslate called with null interpolation name: " + key);
            variables[key] = "null";
        }
    });
    let translated = counterpart.translate(text, variables);
    if (!translated && count !== undefined) {
        // counterpart does not do fallback if no pluralisation exists in the preferred language, so do it here
        translated = counterpart.translate(text, { ...variables, locale: FALLBACK_LOCALE });
    }

    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    return translated;
}

type Component = () => void;

export class AppLocalization {
    private static readonly STORE_KEY = "locale";

    private readonly localizedComponents?: Set<Component>;
    private readonly store: Store;

    public constructor({ components = [], store }: { components: Component[]; store: Store }) {
        counterpart.registerTranslations(FALLBACK_LOCALE, this.fetchTranslationJson("en_EN"));
        counterpart.setFallbackLocale(FALLBACK_LOCALE);
        counterpart.setSeparator("|");

        this.store = store;
        if (Array.isArray(components)) {
            this.localizedComponents = new Set(components);
        }

        if (store.has(AppLocalization.STORE_KEY)) {
            const locales = store.get(AppLocalization.STORE_KEY);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.setAppLocale(locales!);
        }

        this.resetLocalizedUI();
    }

    // Format language strings from normalized form to non-normalized form (e.g. en-gb to en_GB)
    private denormalize(locale: string): string {
        if (locale === "en") {
            locale = "en_EN";
        }
        const parts = locale.split("-");
        if (parts.length > 1) {
            parts[1] = parts[1].toUpperCase();
        }
        return parts.join("_");
    }

    public fetchTranslationJson(locale: string): Record<string, string> {
        try {
            console.log("Fetching translation json for locale: " + locale);
            return loadJsonFile(__dirname, "i18n", "strings", `${this.denormalize(locale)}.json`);
        } catch (e) {
            console.log(`Could not fetch translation json for locale: '${locale}'`, e);
            return {};
        }
    }

    public setAppLocale(locales: string | string[]): void {
        console.log(`Changing application language to ${locales}`);

        if (!Array.isArray(locales)) {
            locales = [locales];
        }

        const loadedLocales = locales.filter((locale) => {
            const translations = this.fetchTranslationJson(locale);
            if (translations !== null) {
                counterpart.registerTranslations(locale, translations);
            }
            return !!translations;
        });

        counterpart.setLocale(loadedLocales[0]);
        this.store.set(AppLocalization.STORE_KEY, locales);

        this.resetLocalizedUI();
    }

    public resetLocalizedUI(): void {
        console.log("Resetting the UI components after locale change");
        this.localizedComponents?.forEach((componentSetup) => {
            if (typeof componentSetup === "function") {
                componentSetup();
            }
        });
    }
}
