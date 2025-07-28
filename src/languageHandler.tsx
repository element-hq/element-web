/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import counterpart from "counterpart";
import { logger } from "matrix-js-sdk/src/logger";
import { type Optional } from "matrix-events-sdk";
import { MapWithDefault } from "matrix-js-sdk/src/utils";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api";
import _ from "lodash";

import SettingsStore from "./settings/SettingsStore";
import PlatformPeg from "./PlatformPeg";
import { SettingLevel } from "./settings/SettingLevel";
import { retry } from "./utils/promise";
import SdkConfig from "./SdkConfig";
import { ModuleRunner } from "./modules/ModuleRunner";
import {
    _t,
    normalizeLanguageKey,
    type TranslationKey,
    type IVariables,
    KEY_SEPARATOR,
    getLangsJson,
} from "./shared-components/utils/i18n";

export {
    _t,
    type IVariables,
    type Tags,
    type TranslationKey,
    type TranslatedString,
    _td,
    _tDom,
    lookupString,
    sanitizeForTranslation,
    normalizeLanguageKey,
    getNormalizedLanguageKeys,
    substitute,
} from "./shared-components/utils/i18n";

const i18nFolder = "i18n/";

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
        substitutionVariablesAndCause?: Omit<IVariables, keyof ErrorOptions> | ErrorOptions,
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

export function getUserLanguage(): string {
    const language = SettingsStore.getValue("language", null, /*excludeDefault:*/ true);
    if (typeof language === "string" && language !== "") {
        return language;
    } else {
        return normalizeLanguageKey(getLanguageFromBrowser());
    }
}

// Allow overriding the text displayed when no translation exists
// Currently only used in unit tests to avoid having to load
// the translations in element-web
export function setMissingEntryGenerator(f: (value: string) => void): void {
    counterpart.setMissingEntryGenerator(f);
}

export async function setLanguage(...preferredLangs: string[]): Promise<void> {
    PlatformPeg.get()?.setLanguage(preferredLangs);

    const availableLanguages = await getLangsJson();
    let chosenLanguage = preferredLangs.find((lang) => availableLanguages.hasOwnProperty(lang));
    if (!chosenLanguage) {
        // Fallback to en_EN if none is found
        chosenLanguage = "en";
        logger.error("Unable to find an appropriate language, preferred: ", preferredLangs);
    }

    const languageData = await getLanguageRetry(i18nFolder + availableLanguages[chosenLanguage]);

    counterpart.registerTranslations(chosenLanguage, languageData);
    counterpart.setLocale(chosenLanguage);

    await SettingsStore.setValue("language", null, SettingLevel.DEVICE, chosenLanguage);
    // Adds a lot of noise to test runs, so disable logging there.
    if (process.env.NODE_ENV !== "test") {
        logger.log("set language to " + chosenLanguage);
    }

    // Set 'en' as fallback language:
    if (chosenLanguage !== "en") {
        const fallbackLanguageData = await getLanguageRetry(i18nFolder + availableLanguages["en"]);
        counterpart.registerTranslations("en", fallbackLanguageData);
    }

    await registerCustomTranslations();
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

export function getLanguagesFromBrowser(): readonly string[] {
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    return [navigator.language ?? "en"];
}

export function getLanguageFromBrowser(): string {
    return getLanguagesFromBrowser()[0];
}

export function getCurrentLanguage(): string {
    return counterpart.getLocale();
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

interface ICounterpartTranslation {
    [key: string]:
        | string
        | {
              [pluralisation: string]: string;
          };
}

async function getLanguageRetry(langPath: string, num = 3): Promise<ICounterpartTranslation> {
    return retry(
        () => getLanguage(langPath),
        num,
        (e) => {
            logger.log("Failed to load i18n", langPath);
            logger.error(e);
            return true; // always retry
        },
    );
}

async function getLanguage(langPath: string): Promise<ICounterpartTranslation> {
    const res = await fetch(langPath, { method: "GET" });

    if (!res.ok) {
        throw new Error(`Failed to load ${langPath}, got ${res.status}`);
    }

    return res.json();
}

let cachedCustomTranslations: Optional<TranslationStringsObject> = null;
let cachedCustomTranslationsExpire = 0; // zero to trigger expiration right away

// This awkward class exists so the test runner can get at the function. It is
// not intended for practical or realistic usage.
export class CustomTranslationOptions {
    public static lookupFn?: (url: string) => TranslationStringsObject;

    private constructor() {
        // static access for tests only
    }
}

function doRegisterTranslations(customTranslations: TranslationStringsObject): void {
    // We convert the operator-friendly version into something counterpart can consume.
    // Map: lang → Record: string → translation
    const langs: MapWithDefault<string, Record<string, string>> = new MapWithDefault(() => ({}));
    for (const [translationKey, translations] of Object.entries(customTranslations)) {
        for (const [lang, translation] of Object.entries(translations)) {
            _.set(langs.getOrCreate(lang), translationKey.split(KEY_SEPARATOR), translation);
        }
    }

    // Finally, tell counterpart about our translations
    for (const [lang, translations] of langs) {
        counterpart.registerTranslations(lang, translations);
    }
}

/**
 * Any custom modules with translations to load are parsed first, followed by an
 * optionally defined translations file in the config. If no customization is made,
 * or the file can't be parsed, no action will be taken.
 *
 * This function should be called *after* registering other translations data to
 * ensure it overrides strings properly.
 */
export async function registerCustomTranslations({
    testOnlyIgnoreCustomTranslationsCache = false,
}: {
    testOnlyIgnoreCustomTranslationsCache?: boolean;
} = {}): Promise<void> {
    const moduleTranslations = ModuleRunner.instance.allTranslations;
    doRegisterTranslations(moduleTranslations);

    const lookupUrl = SdkConfig.get().custom_translations_url;
    if (!lookupUrl) return; // easy - nothing to do

    try {
        let json: Optional<TranslationStringsObject>;
        if (testOnlyIgnoreCustomTranslationsCache || Date.now() >= cachedCustomTranslationsExpire) {
            json = CustomTranslationOptions.lookupFn
                ? CustomTranslationOptions.lookupFn(lookupUrl)
                : ((await (await fetch(lookupUrl)).json()) as TranslationStringsObject);
            cachedCustomTranslations = json;

            // Set expiration to the future, but not too far. Just trying to avoid
            // repeated, successive, calls to the server rather than anything long-term.
            cachedCustomTranslationsExpire = Date.now() + 5 * 60 * 1000;
        } else {
            json = cachedCustomTranslations;
        }

        // If the (potentially cached) json is invalid, don't use it.
        if (!json) return;

        // Finally, register it.
        doRegisterTranslations(json);
    } catch (e) {
        // We consume all exceptions because it's considered non-fatal for custom
        // translations to break. Most failures will be during initial development
        // of the json file and not (hopefully) at runtime.
        logger.warn("Ignoring error while registering custom translations: ", e);

        // Like above: trigger a cache of the json to avoid successive calls.
        cachedCustomTranslationsExpire = Date.now() + 5 * 60 * 1000;
    }
}
