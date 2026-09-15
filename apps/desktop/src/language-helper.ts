/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import counterpart from "counterpart";
import { type TranslationKey as TKey } from "matrix-web-i18n";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type EN from "./i18n/strings/en_EN.json";
import { loadJsonFile } from "./utils.js";
import type Store from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FALLBACK_LOCALE = "en";

const STRINGS_DIR = path.join(__dirname, "i18n", "strings");

/**
 * Index the strings files the app was built with by the language key the web app names them with.
 *
 * The web app derives those keys from these same file names — lower cased, `_` becoming `-`, and the
 * region dropped where it only repeats the language — so deriving them from the files here is what
 * keeps the two ends agreeing. Guessing a file name back from a key cannot: `de` and `mg` would have
 * to become `de_DE` and `mg_MG`, and `zh-hans` would have to become `zh_Hans` rather than `zh_HANS`,
 * which is a different file wherever the filesystem cares about case.
 *
 * @returns The strings file to load for each language key, keyed as the web app keys them.
 */
function getStringsFiles(): Map<string, string> {
    const files = new Map<string, string>();
    for (const file of fs.readdirSync(STRINGS_DIR)) {
        if (!file.endsWith(".json")) continue;
        const parts = path.basename(file, ".json").toLowerCase().split("_");
        const key = parts.length === 2 && parts[0] === parts[1] ? parts[0] : parts.join("-");
        files.set(key, file);
    }
    return files;
}

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
        counterpart.registerTranslations(FALLBACK_LOCALE, this.fetchTranslationJson(FALLBACK_LOCALE));
        counterpart.setFallbackLocale(FALLBACK_LOCALE);
        counterpart.setSeparator("|");

        this.store = store;
        if (Array.isArray(components)) {
            this.localizedComponents = new Set(components);
        }

        if (store.has(AppLocalization.STORE_KEY)) {
            const locales = store.get(AppLocalization.STORE_KEY);
            this.setAppLocale(locales!);
        }

        this.resetLocalizedUI();
    }

    public fetchTranslationJson(locale: string): Record<string, string> {
        try {
            console.log("Fetching translation json for locale: " + locale);
            const file = getStringsFiles().get(locale.toLowerCase());
            if (!file) {
                console.log(`No translation json for locale: '${locale}'`);
                return {};
            }
            return loadJsonFile(STRINGS_DIR, file);
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

        const chosenLocale = locales.find((locale) => {
            const translations = this.fetchTranslationJson(locale);
            // Nothing to register means nothing to show. Settling on the locale anyway would leave
            // the menus in English while the app claimed to be in the chosen language, so move on to
            // the next preference instead.
            if (Object.keys(translations).length === 0) return false;
            counterpart.registerTranslations(locale, translations);
            return true;
        });

        counterpart.setLocale(chosenLocale ?? FALLBACK_LOCALE);
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
