/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

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
import React from "react";
import { type TranslationKey as _TranslationKey, KEY_SEPARATOR } from "matrix-web-i18n";
import counterpart from "counterpart";

import type Translations from "../../i18n/strings/en_EN.json";

// @ts-ignore - $webapp is a webpack resolve alias pointing to the output directory, see webpack config
import webpackLangJsonUrl from "$webapp/i18n/languages.json";

export { KEY_SEPARATOR, normalizeLanguageKey, getNormalizedLanguageKeys } from "matrix-web-i18n";

const i18nFolder = "i18n/";

// Control whether to also return original, untranslated strings
// Useful for debugging and testing
const ANNOTATE_STRINGS = false;

// We use english strings as keys, some of which contain full stops
counterpart.setSeparator(KEY_SEPARATOR);

// see `translateWithFallback` for an explanation of fallback handling
const FALLBACK_LOCALE = "en";
counterpart.setFallbackLocale(FALLBACK_LOCALE);

/**
 * A type representing the union of possible keys into the translation file using `|` delimiter to access nested fields.
 * @example `common|error` to access `error` within the `common` sub-object.
 * {
 *     "common": {
 *         "error": "Error"
 *     }
 * }
 */
export type TranslationKey = _TranslationKey<typeof Translations>;

// Function which only purpose is to mark that a string is translatable
// Does not actually do anything. It's helpful for automatic extraction of translatable strings
export function _td(s: TranslationKey): TranslationKey {
    return s;
}

function isValidTranslation(translated: string): boolean {
    return typeof translated === "string" && !translated.startsWith("missing translation:");
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
    if (isValidTranslation(translated)) {
        return { translated };
    }

    const fallbackTranslated = counterpart.translate(text, { ...options, locale: FALLBACK_LOCALE });
    if (isValidTranslation(fallbackTranslated)) {
        return { translated: fallbackTranslated, isFallback: true };
    }

    // Even the translation via FALLBACK_LOCALE failed; this can happen if
    //
    // 1. The string isn't in the translations dictionary, usually because you're in develop
    // and haven't run yarn i18n
    // 2. Loading the translation resources over the network failed, which can happen due to
    // to network or if the client tried to load a translation that's been removed from the
    // server.
    //
    // At this point, its the lesser evil to show the i18n key which will be in English but not human-friendly,
    // so the user can still make out *something*, rather than an opaque possibly-untranslated "missing translation" error.
    return { translated: text, isFallback: true };
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
                console.warn("safeCounterpartTranslate called with undefined interpolation name: " + k);
                options[k] = "undefined";
            }
            if (options[k] === null) {
                console.warn("safeCounterpartTranslate called with null interpolation name: " + k);
                options[k] = "null";
            }
        });
    }
    return translateWithFallback(text, options);
}

/**
 * The value a variable or tag can take for a translation interpolation.
 */
type SubstitutionValue = number | string | React.ReactNode | ((sub: string) => React.ReactNode);

export interface IVariables {
    count?: number;
    [key: string]: SubstitutionValue;
}

export type Tags = Record<string, SubstitutionValue>;

export type TranslatedString = string | React.ReactNode;

// For development/testing purposes it is useful to also output the original string
// Don't do that for release versions
const annotateStrings = (result: TranslatedString, translationKey: TranslationKey): TranslatedString => {
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

export function _t(text: TranslationKey, variables?: IVariables): string;
export function _t(text: TranslationKey, variables: IVariables | undefined, tags: Tags): React.ReactNode;
export function _t(text: TranslationKey, variables?: IVariables, tags?: Tags): TranslatedString {
    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    const { translated } = safeCounterpartTranslate(text, variables);
    const substituted = substitute(translated, variables, tags);

    return annotateStrings(substituted, text);
}

/**
 * Utility function to look up a string by its translation key without resolving variables & tags
 * @param key - the translation key to return the value for
 */
export function lookupString(key: TranslationKey): string {
    return safeCounterpartTranslate(key, {}).translated;
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
export function _tDom(text: TranslationKey, variables?: IVariables): TranslatedString;
export function _tDom(text: TranslationKey, variables: IVariables, tags: Tags): React.ReactNode;
export function _tDom(text: TranslationKey, variables?: IVariables, tags?: Tags): TranslatedString {
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

/**
 * Replace parts of a text using regular expressions
 * @param text - The text on which to perform substitutions
 * @param mapping - A mapping from regular expressions in string form to replacement string or a
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
                    replaced = ((mapping as Tags)[regexpString] as (...subs: string[]) => string)(...capturedGroups);
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
                console.log(`Could not find ${regexp} in ${text}`);
            }
        }
    }

    if (shouldWrapInSpan) {
        return React.createElement("span", null, ...(output as Array<number | string | React.ReactNode>));
    } else {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return output.join("");
    }
}

type Languages = {
    [lang: string]: string;
};

/**
 * Sets the language for the application.
 * In Element web,`languageHandler.setLanguage` should be used instead.
 * @param language
 */
export async function setLanguage(language: string): Promise<void> {
    const availableLanguages = await getLangsJson();
    const chosenLanguage = language in availableLanguages ? language : "en";

    const languageData = await getLanguage(i18nFolder + availableLanguages[chosenLanguage]);

    counterpart.registerTranslations(chosenLanguage, languageData);
    counterpart.setLocale(chosenLanguage);
}

interface ICounterpartTranslation {
    [key: string]:
        | string
        | {
              [pluralisation: string]: string;
          };
}

async function getLanguage(langPath: string): Promise<ICounterpartTranslation> {
    console.log("Loading language from", langPath);
    const res = await fetch(langPath, { method: "GET" });

    if (!res.ok) {
        throw new Error(`Failed to load ${langPath}, got ${res.status}`);
    }

    return res.json();
}

export async function getLangsJson(): Promise<Languages> {
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
