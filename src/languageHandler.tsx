/*
Copyright 2017 MTRNord and Cooperative EITA
Copyright 2017 Vector Creations Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import counterpart from "counterpart";
import React from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { Optional } from "matrix-events-sdk";
import { MapWithDefault, safeSet } from "matrix-js-sdk/src/utils";

import SettingsStore from "./settings/SettingsStore";
import PlatformPeg from "./PlatformPeg";
import { SettingLevel } from "./settings/SettingLevel";
import { retry } from "./utils/promise";
import SdkConfig from "./SdkConfig";
import { ModuleRunner } from "./modules/ModuleRunner";

// @ts-ignore - $webapp is a webpack resolve alias pointing to the output directory, see webpack config
import webpackLangJsonUrl from "$webapp/i18n/languages.json";

const i18nFolder = "i18n/";

// Control whether to also return original, untranslated strings
// Useful for debugging and testing
const ANNOTATE_STRINGS = false;

// We use english strings as keys, some of which contain full stops
counterpart.setSeparator("|");

// see `translateWithFallback` for an explanation of fallback handling
const FALLBACK_LOCALE = "en";
counterpart.setFallbackLocale(FALLBACK_LOCALE);

interface ErrorOptions {
    // Because we're mixing the subsitution variables and `cause` into the same object
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

    public constructor(message: string, substitutionVariablesAndCause?: IVariables & ErrorOptions) {
        const errorOptions = {
            cause: substitutionVariablesAndCause?.cause,
        };
        // Prevent "Could not find /%\(cause\)s/g in x" logs to the console by removing
        // it from the list
        const substitutionVariables = { ...substitutionVariablesAndCause };
        delete substitutionVariables["cause"];

        // Create the error with the English version of the message that we want to show
        // up in the logs
        const englishTranslatedMessage = _t(message, { ...substitutionVariables, locale: "en" });
        super(englishTranslatedMessage, errorOptions);

        // Also provide a translated version of the error in the users locale to display
        this.translatedMessage = _t(message, substitutionVariables);
    }
}

export function getUserLanguage(): string {
    const language = SettingsStore.getValue("language", null, /*excludeDefault:*/ true);
    if (language) {
        return language;
    } else {
        return normalizeLanguageKey(getLanguageFromBrowser());
    }
}

// Function which only purpose is to mark that a string is translatable
// Does not actually do anything. It's helpful for automatic extraction of translatable strings
export function _td(s: string): string {
    // eslint-disable-line @typescript-eslint/naming-convention
    return s;
}

/**
 * to improve screen reader experience translations that are not in the main page language
 * eg a translation that fell back to english from another language
 * should be wrapped with an appropriate `lang='en'` attribute
 * counterpart's `translate` doesn't expose a way to determine if the resulting translation
 * is in the target locale or a fallback locale
 * for this reason, force fallbackLocale === locale in the first call to translate
 * and fallback 'manually' so we can mark fallback strings appropriately
 * */
const translateWithFallback = (text: string, options?: IVariables): { translated: string; isFallback?: boolean } => {
    const translated = counterpart.translate(text, { ...options, fallbackLocale: counterpart.getLocale() });
    if (!translated || translated.startsWith("missing translation:")) {
        const fallbackTranslated = counterpart.translate(text, { ...options, locale: FALLBACK_LOCALE });
        if (
            (!fallbackTranslated || fallbackTranslated.startsWith("missing translation:")) &&
            process.env.NODE_ENV !== "development"
        ) {
            // Even the translation via FALLBACK_LOCALE failed; this can happen if
            //
            // 1. The string isn't in the translations dictionary, usually because you're in develop
            // and haven't run yarn i18n
            // 2. Loading the translation resources over the network failed, which can happen due to
            // to network or if the client tried to load a translation that's been removed from the
            // server.
            //
            // At this point, its the lesser evil to show the untranslated text, which
            // will be in English, so the user can still make out *something*, rather than an opaque
            // "missing translation" error.
            //
            // Don't do this in develop so people remember to run yarn i18n.
            return { translated: text, isFallback: true };
        }
        return { translated: fallbackTranslated, isFallback: true };
    }
    return { translated };
};

// Wrapper for counterpart's translation function so that it handles nulls and undefineds properly
// Takes the same arguments as counterpart.translate()
function safeCounterpartTranslate(text: string, variables?: IVariables): { translated: string; isFallback?: boolean } {
    // Don't do substitutions in counterpart. We handle it ourselves so we can replace with React components
    // However, still pass the variables to counterpart so that it can choose the correct plural if count is given
    // It is enough to pass the count variable, but in the future counterpart might make use of other information too
    const options: IVariables & {
        interpolate: boolean;
    } = { ...variables, interpolate: false };

    // Horrible hack to avoid https://github.com/vector-im/element-web/issues/4191
    // The interpolation library that counterpart uses does not support undefined/null
    // values and instead will throw an error. This is a problem since everywhere else
    // in JS land passing undefined/null will simply stringify instead, and when converting
    // valid ES6 template strings to i18n strings it's extremely easy to pass undefined/null
    // if there are no existing null guards. To avoid this making the app completely inoperable,
    // we'll check all the values for undefined/null and stringify them here.
    if (options && typeof options === "object") {
        Object.keys(options).forEach((k) => {
            if (options[k] === undefined) {
                logger.warn("safeCounterpartTranslate called with undefined interpolation name: " + k);
                options[k] = "undefined";
            }
            if (options[k] === null) {
                logger.warn("safeCounterpartTranslate called with null interpolation name: " + k);
                options[k] = "null";
            }
        });
    }
    return translateWithFallback(text, options);
}

type SubstitutionValue = number | string | React.ReactNode | ((sub: string) => React.ReactNode);

export interface IVariables {
    count?: number;
    [key: string]: SubstitutionValue;
}

export type Tags = Record<string, SubstitutionValue>;

export type TranslatedString = string | React.ReactNode;

// For development/testing purposes it is useful to also output the original string
// Don't do that for release versions
const annotateStrings = (result: TranslatedString, translationKey: string): TranslatedString => {
    if (!ANNOTATE_STRINGS) {
        return result;
    }

    if (typeof result === "string") {
        return `@@${translationKey}##${result}@@`;
    } else {
        return (
            <span className="translated-string" data-orig-string={translationKey}>
                {result}
            </span>
        );
    }
};

/*
 * Translates text and optionally also replaces XML-ish elements in the text with e.g. React components
 * @param {string} text The untranslated text, e.g "click <a>here</a> now to %(foo)s".
 * @param {object} variables Variable substitutions, e.g { foo: 'bar' }
 * @param {object} tags Tag substitutions e.g. { 'a': (sub) => <a>{sub}</a> }
 *
 * In both variables and tags, the values to substitute with can be either simple strings, React components,
 * or functions that return the value to use in the substitution (e.g. return a React component). In case of
 * a tag replacement, the function receives as the argument the text inside the element corresponding to the tag.
 *
 * Use tag substitutions if you need to translate text between tags (e.g. "<a>Click here!</a>"), otherwise
 * you will end up with literal "<a>" in your output, rather than HTML. Note that you can also use variable
 * substitution to insert React components, but you can't use it to translate text between tags.
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
// eslint-next-line @typescript-eslint/naming-convention
export function _t(text: string, variables?: IVariables): string;
export function _t(text: string, variables: IVariables | undefined, tags: Tags): React.ReactNode;
export function _t(text: string, variables?: IVariables, tags?: Tags): TranslatedString {
    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    const { translated } = safeCounterpartTranslate(text, variables);
    const substituted = substitute(translated, variables, tags);

    return annotateStrings(substituted, text);
}

/*
 * Wraps normal _t function and adds atttribution for translations that used a fallback locale
 * Wraps translations that fell back from active locale to fallback locale with a `<span lang=<fallback locale>>`
 * @param {string} text The untranslated text, e.g "click <a>here</a> now to %(foo)s".
 * @param {object} variables Variable substitutions, e.g { foo: 'bar' }
 * @param {object} tags Tag substitutions e.g. { 'a': (sub) => <a>{sub}</a> }
 *
 * @return a React <span> component if any non-strings were used in substitutions
 * or translation used a fallback locale, otherwise a string
 */
// eslint-next-line @typescript-eslint/naming-convention
export function _tDom(text: string, variables?: IVariables): TranslatedString;
export function _tDom(text: string, variables: IVariables, tags: Tags): React.ReactNode;
export function _tDom(text: string, variables?: IVariables, tags?: Tags): TranslatedString {
    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    const { translated, isFallback } = safeCounterpartTranslate(text, variables);
    const substituted = substitute(translated, variables, tags);

    // wrap en fallback translation with lang attribute for screen readers
    const result = isFallback ? <span lang="en">{substituted}</span> : substituted;

    return annotateStrings(result, text);
}

/**
 * Sanitizes unsafe text for the sanitizer, ensuring references to variables will not be considered
 * replaceable by the translation functions.
 * @param {string} text The text to sanitize.
 * @returns {string} The sanitized text.
 */
export function sanitizeForTranslation(text: string): string {
    // Add a non-breaking space so the regex doesn't trigger when translating.
    return text.replace(/%\(([^)]*)\)/g, "%\xa0($1)");
}

/*
 * Similar to _t(), except only does substitutions, and no translation
 * @param {string} text The text, e.g "click <a>here</a> now to %(foo)s".
 * @param {object} variables Variable substitutions, e.g { foo: 'bar' }
 * @param {object} tags Tag substitutions e.g. { 'a': (sub) => <a>{sub}</a> }
 *
 * The values to substitute with can be either simple strings, or functions that return the value to use in
 * the substitution (e.g. return a React component). In case of a tag replacement, the function receives as
 * the argument the text inside the element corresponding to the tag.
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
export function substitute(text: string, variables?: IVariables): string;
export function substitute(text: string, variables: IVariables | undefined, tags: Tags | undefined): string;
export function substitute(text: string, variables?: IVariables, tags?: Tags): string | React.ReactNode {
    let result: React.ReactNode | string = text;

    if (variables !== undefined) {
        const regexpMapping: IVariables = {};
        for (const variable in variables) {
            regexpMapping[`%\\(${variable}\\)s`] = variables[variable];
        }
        result = replaceByRegexes(result as string, regexpMapping);
    }

    if (tags !== undefined) {
        const regexpMapping: Tags = {};
        for (const tag in tags) {
            regexpMapping[`(<${tag}>(.*?)<\\/${tag}>|<${tag}>|<${tag}\\s*\\/>)`] = tags[tag];
        }
        result = replaceByRegexes(result as string, regexpMapping);
    }

    return result;
}

/*
 * Replace parts of a text using regular expressions
 * @param {string} text The text on which to perform substitutions
 * @param {object} mapping A mapping from regular expressions in string form to replacement string or a
 * function which will receive as the argument the capture groups defined in the regexp. E.g.
 * { 'Hello (.?) World': (sub) => sub.toUpperCase() }
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
export function replaceByRegexes(text: string, mapping: IVariables): string;
export function replaceByRegexes(text: string, mapping: Tags): React.ReactNode;
export function replaceByRegexes(text: string, mapping: IVariables | Tags): string | React.ReactNode {
    // We initially store our output as an array of strings and objects (e.g. React components).
    // This will then be converted to a string or a <span> at the end
    const output: SubstitutionValue[] = [text];

    // If we insert any components we need to wrap the output in a span. React doesn't like just an array of components.
    let shouldWrapInSpan = false;

    for (const regexpString in mapping) {
        // TODO: Cache regexps
        const regexp = new RegExp(regexpString, "g");

        // Loop over what output we have so far and perform replacements
        // We look for matches: if we find one, we get three parts: everything before the match, the replaced part,
        // and everything after the match. Insert all three into the output. We need to do this because we can insert objects.
        // Otherwise there would be no need for the splitting and we could do simple replacement.
        let matchFoundSomewhere = false; // If we don't find a match anywhere we want to log it
        for (let outputIndex = 0; outputIndex < output.length; outputIndex++) {
            const inputText = output[outputIndex];
            if (typeof inputText !== "string") {
                // We might have inserted objects earlier, don't try to replace them
                continue;
            }

            // process every match in the string
            // starting with the first
            let match = regexp.exec(inputText);

            if (!match) continue;
            matchFoundSomewhere = true;

            // The textual part before the first match
            const head = inputText.slice(0, match.index);

            const parts: SubstitutionValue[] = [];
            // keep track of prevMatch
            let prevMatch;
            while (match) {
                // store prevMatch
                prevMatch = match;
                const capturedGroups = match.slice(2);

                let replaced: SubstitutionValue;
                // If substitution is a function, call it
                if (mapping[regexpString] instanceof Function) {
                    replaced = ((mapping as Tags)[regexpString] as Function)(...capturedGroups);
                } else {
                    replaced = mapping[regexpString];
                }

                if (typeof replaced === "object") {
                    shouldWrapInSpan = true;
                }

                // Here we also need to check that it actually is a string before comparing against one
                // The head and tail are always strings
                if (typeof replaced !== "string" || replaced !== "") {
                    parts.push(replaced);
                }

                // try the next match
                match = regexp.exec(inputText);

                // add the text between prevMatch and this one
                // or the end of the string if prevMatch is the last match
                let tail;
                if (match) {
                    const startIndex = prevMatch.index + prevMatch[0].length;
                    tail = inputText.slice(startIndex, match.index);
                } else {
                    tail = inputText.slice(prevMatch.index + prevMatch[0].length);
                }
                if (tail) {
                    parts.push(tail);
                }
            }

            // Insert in reverse order as splice does insert-before and this way we get the final order correct
            // remove the old element at the same time
            output.splice(outputIndex, 1, ...parts);

            if (head !== "") {
                // Don't push empty nodes, they are of no use
                output.splice(outputIndex, 0, head);
            }
        }
        if (!matchFoundSomewhere) {
            if (
                // The current regexp did not match anything in the input. Missing
                // matches is entirely possible because you might choose to show some
                // variables only in the case of e.g. plurals. It's still a bit
                // suspicious, and could be due to an error, so log it. However, not
                // showing count is so common that it's not worth logging. And other
                // commonly unused variables here, if there are any.
                regexpString !== "%\\(count\\)s" &&
                // Ignore the `locale` option which can be used to override the locale
                // in counterpart
                regexpString !== "%\\(locale\\)s"
            ) {
                logger.log(`Could not find ${regexp} in ${text}`);
            }
        }
    }

    if (shouldWrapInSpan) {
        return React.createElement("span", null, ...output);
    } else {
        return output.join("");
    }
}

// Allow overriding the text displayed when no translation exists
// Currently only used in unit tests to avoid having to load
// the translations in element-web
export function setMissingEntryGenerator(f: (value: string) => void): void {
    counterpart.setMissingEntryGenerator(f);
}

type Languages = {
    [lang: string]: {
        fileName: string;
        label: string;
    };
};

export function setLanguage(preferredLangs: string | string[]): Promise<void> {
    if (!Array.isArray(preferredLangs)) {
        preferredLangs = [preferredLangs];
    }

    const plaf = PlatformPeg.get();
    if (plaf) {
        plaf.setLanguage(preferredLangs);
    }

    let langToUse: string;
    let availLangs: Languages;
    return getLangsJson()
        .then((result) => {
            availLangs = result;

            for (let i = 0; i < preferredLangs.length; ++i) {
                if (availLangs.hasOwnProperty(preferredLangs[i])) {
                    langToUse = preferredLangs[i];
                    break;
                }
            }
            if (!langToUse) {
                // Fallback to en_EN if none is found
                langToUse = "en";
                logger.error("Unable to find an appropriate language");
            }

            return getLanguageRetry(i18nFolder + availLangs[langToUse].fileName);
        })
        .then(async (langData): Promise<ICounterpartTranslation | undefined> => {
            counterpart.registerTranslations(langToUse, langData);
            await registerCustomTranslations();
            counterpart.setLocale(langToUse);
            await SettingsStore.setValue("language", null, SettingLevel.DEVICE, langToUse);
            // Adds a lot of noise to test runs, so disable logging there.
            if (process.env.NODE_ENV !== "test") {
                logger.log("set language to " + langToUse);
            }

            // Set 'en' as fallback language:
            if (langToUse !== "en") {
                return getLanguageRetry(i18nFolder + availLangs["en"].fileName);
            }
        })
        .then(async (langData): Promise<void> => {
            if (langData) counterpart.registerTranslations("en", langData);
            await registerCustomTranslations();
        });
}

type Language = {
    value: string;
    label: string;
};

export function getAllLanguagesFromJson(): Promise<Language[]> {
    return getLangsJson().then((langsObject) => {
        const langs: Language[] = [];
        for (const langKey in langsObject) {
            if (langsObject.hasOwnProperty(langKey)) {
                langs.push({
                    value: langKey,
                    label: langsObject[langKey].label,
                });
            }
        }
        return langs;
    });
}

export function getLanguagesFromBrowser(): readonly string[] {
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    if (navigator.language) return [navigator.language];
    return [navigator.userLanguage || "en"];
}

export function getLanguageFromBrowser(): string {
    return getLanguagesFromBrowser()[0];
}

/**
 * Turns a language string, normalises it,
 * (see normalizeLanguageKey) into an array of language strings
 * with fallback to generic languages
 * (eg. 'pt-BR' => ['pt-br', 'pt'])
 *
 * @param {string} language The input language string
 * @return {string[]} List of normalised languages
 */
export function getNormalizedLanguageKeys(language: string): string[] {
    const languageKeys: string[] = [];
    const normalizedLanguage = normalizeLanguageKey(language);
    const languageParts = normalizedLanguage.split("-");
    if (languageParts.length === 2 && languageParts[0] === languageParts[1]) {
        languageKeys.push(languageParts[0]);
    } else {
        languageKeys.push(normalizedLanguage);
        if (languageParts.length === 2) {
            languageKeys.push(languageParts[0]);
        }
    }
    return languageKeys;
}

/**
 * Returns a language string with underscores replaced with
 * hyphens, and lowercased.
 *
 * @param {string} language The language string to be normalized
 * @returns {string} The normalized language string
 */
export function normalizeLanguageKey(language: string): string {
    return language.toLowerCase().replace("_", "-");
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

async function getLangsJson(): Promise<Languages> {
    let url: string;
    if (typeof webpackLangJsonUrl === "string") {
        // in Jest this 'url' isn't a URL, so just fall through
        url = webpackLangJsonUrl;
    } else {
        url = i18nFolder + "languages.json";
    }

    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {
        throw new Error(`Failed to load ${url}, got ${res.status}`);
    }

    return res.json();
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

export interface ICustomTranslations {
    // Format is a map of english string to language to override
    [str: string]: {
        [lang: string]: string;
    };
}

let cachedCustomTranslations: Optional<ICustomTranslations> = null;
let cachedCustomTranslationsExpire = 0; // zero to trigger expiration right away

// This awkward class exists so the test runner can get at the function. It is
// not intended for practical or realistic usage.
export class CustomTranslationOptions {
    public static lookupFn?: (url: string) => ICustomTranslations;

    private constructor() {
        // static access for tests only
    }
}

function doRegisterTranslations(customTranslations: ICustomTranslations): void {
    // We convert the operator-friendly version into something counterpart can
    // consume.
    // Map: lang → Record: string → translation
    const langs: MapWithDefault<string, Record<string, string>> = new MapWithDefault(() => ({}));
    for (const [str, translations] of Object.entries(customTranslations)) {
        for (const [lang, newStr] of Object.entries(translations)) {
            safeSet(langs.getOrCreate(lang), str, newStr);
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
        let json: Optional<ICustomTranslations>;
        if (testOnlyIgnoreCustomTranslationsCache || Date.now() >= cachedCustomTranslationsExpire) {
            json = CustomTranslationOptions.lookupFn
                ? CustomTranslationOptions.lookupFn(lookupUrl)
                : ((await (await fetch(lookupUrl)).json()) as ICustomTranslations);
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
