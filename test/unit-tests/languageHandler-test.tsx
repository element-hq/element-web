/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import fetchMock from "fetch-mock-jest";
import { type Translation } from "matrix-web-i18n";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api";

import SdkConfig from "../../src/SdkConfig";
import {
    _t,
    _tDom,
    CustomTranslationOptions,
    getAllLanguagesWithLabels,
    registerCustomTranslations,
    setLanguage,
    setMissingEntryGenerator,
    substitute,
    type TranslatedString,
    UserFriendlyError,
    type TranslationKey,
    type IVariables,
    type Tags,
} from "../../src/languageHandler";
import { stubClient } from "../test-utils";
import { setupLanguageMock } from "../setup/setupLanguage";

async function setupTranslationOverridesForTests(overrides: TranslationStringsObject) {
    const lookupUrl = "/translations.json";
    const fn = (url: string): TranslationStringsObject => {
        expect(url).toEqual(lookupUrl);
        return overrides;
    };

    SdkConfig.add({
        custom_translations_url: lookupUrl,
    });
    CustomTranslationOptions.lookupFn = fn;
    await registerCustomTranslations({
        testOnlyIgnoreCustomTranslationsCache: true,
    });
}

describe("languageHandler", () => {
    beforeEach(async () => {
        await setLanguage("en");
    });

    afterEach(() => {
        SdkConfig.reset();
        CustomTranslationOptions.lookupFn = undefined;
    });

    it("should support overriding translations", async () => {
        const str: TranslationKey = "power_level|default";
        const enOverride: Translation = "Visitor";
        const deOverride: Translation = "Besucher";

        // First test that overrides aren't being used
        await setLanguage("en");
        expect(_t(str)).toMatchInlineSnapshot(`"Default"`);
        await setLanguage("de");
        expect(_t(str)).toMatchInlineSnapshot(`"Standard"`);

        await setupTranslationOverridesForTests({
            [str]: {
                en: enOverride,
                de: deOverride,
            },
        });

        // Now test that they *are* being used
        await setLanguage("en");
        expect(_t(str)).toEqual(enOverride);

        await setLanguage("de");
        expect(_t(str)).toEqual(deOverride);
    });

    it("should support overriding plural translations", async () => {
        const str: TranslationKey = "voip|n_people_joined";
        const enOverride: Translation = {
            other: "%(count)s people in the call",
            one: "%(count)s person in the call",
        };
        const deOverride: Translation = {
            other: "%(count)s Personen im Anruf",
            one: "%(count)s Person im Anruf",
        };

        // First test that overrides aren't being used
        await setLanguage("en");
        expect(_t(str, { count: 1 })).toMatchInlineSnapshot(`"1 person joined"`);
        expect(_t(str, { count: 5 })).toMatchInlineSnapshot(`"5 people joined"`);
        await setLanguage("de");
        expect(_t(str, { count: 1 })).toMatchInlineSnapshot(`"1 Person beigetreten"`);
        expect(_t(str, { count: 5 })).toMatchInlineSnapshot(`"5 Personen beigetreten"`);

        await setupTranslationOverridesForTests({
            [str]: {
                en: enOverride,
                de: deOverride,
            },
        });

        // Now test that they *are* being used
        await setLanguage("en");
        expect(_t(str, { count: 1 })).toMatchInlineSnapshot(`"1 person in the call"`);
        expect(_t(str, { count: 5 })).toMatchInlineSnapshot(`"5 people in the call"`);

        await setLanguage("de");
        expect(_t(str, { count: 1 })).toMatchInlineSnapshot(`"1 Person im Anruf"`);
        expect(_t(str, { count: 5 })).toMatchInlineSnapshot(`"5 Personen im Anruf"`);
    });

    describe("UserFriendlyError", () => {
        const testErrorMessage = "This email address is already in use (%(email)s)" as TranslationKey;
        beforeEach(async () => {
            // Setup some  strings with variable substituations that we can use in the tests.
            const deOverride = "Diese E-Mail-Adresse wird bereits verwendet (%(email)s)";
            await setupTranslationOverridesForTests({
                [testErrorMessage]: {
                    en: testErrorMessage,
                    de: deOverride,
                },
            });
        });

        it("includes English message and localized translated message", async () => {
            await setLanguage("de");

            const friendlyError = new UserFriendlyError(testErrorMessage, {
                email: "test@example.com",
                cause: undefined,
            });

            // Ensure message is in English so it's readable in the logs
            expect(friendlyError.message).toStrictEqual("This email address is already in use (test@example.com)");
            // Ensure the translated message is localized appropriately
            expect(friendlyError.translatedMessage).toStrictEqual(
                "Diese E-Mail-Adresse wird bereits verwendet (test@example.com)",
            );
        });

        it("includes underlying cause error", async () => {
            await setLanguage("de");

            const underlyingError = new Error("Fake underlying error");
            const friendlyError = new UserFriendlyError(testErrorMessage, {
                email: "test@example.com",
                cause: underlyingError,
            });

            expect(friendlyError.cause).toStrictEqual(underlyingError);
        });

        it("ok to omit the substitution variables and cause object, there just won't be any cause", async () => {
            const friendlyError = new UserFriendlyError("foo error" as TranslationKey);
            expect(friendlyError.cause).toBeUndefined();
        });
    });

    describe("getAllLanguagesWithLabels", () => {
        it("should handle unknown language sanely", async () => {
            fetchMock.getOnce(
                "/i18n/languages.json",
                {
                    en: "en_EN.json",
                    de: "de_DE.json",
                    qq: "qq.json",
                },
                { overwriteRoutes: true },
            );
            await expect(getAllLanguagesWithLabels()).resolves.toMatchInlineSnapshot(`
                [
                  {
                    "label": "English",
                    "labelInTargetLanguage": "English",
                    "value": "en",
                  },
                  {
                    "label": "German",
                    "labelInTargetLanguage": "Deutsch",
                    "value": "de",
                  },
                  {
                    "label": "qq",
                    "labelInTargetLanguage": "qq",
                    "value": "qq",
                  },
                ]
            `);
            setupLanguageMock(); // restore language mock
        });
    });
});

describe("languageHandler JSX", function () {
    // See setupLanguage.ts for how we are stubbing out translations to provide fixture data for these tests
    const basicString = "common|rooms";
    const selfClosingTagSub = "Accept <policyLink /> to continue:" as TranslationKey;
    const textInTagSub = "<a>Upgrade</a> to your own domain" as TranslationKey;
    const plurals = "common|and_n_others";
    const variableSub = "slash_command|ignore_dialog_description";

    type TestCase = [string, TranslationKey, IVariables, Tags | undefined, TranslatedString];
    const testCasesEn: TestCase[] = [
        // description of the test case, translationString, variables, tags, expected result
        ["translates a basic string", basicString, {}, undefined, "Rooms"],
        ["handles plurals when count is 0", plurals, { count: 0 }, undefined, "and 0 others..."],
        ["handles plurals when count is 1", plurals, { count: 1 }, undefined, "and one other..."],
        ["handles plurals when count is not 1", plurals, { count: 2 }, undefined, "and 2 others..."],
        ["handles simple variable substitution", variableSub, { userId: "foo" }, undefined, "You are now ignoring foo"],
        [
            "handles simple tag substitution",
            selfClosingTagSub,
            {},
            { policyLink: () => "foo" },
            "Accept foo to continue:",
        ],
        ["handles text in tags", textInTagSub, {}, { a: (sub: string) => `x${sub}x` }, "xUpgradex to your own domain"],
        [
            "handles variable substitution with React function component",
            variableSub,
            { userId: () => <i>foo</i> },
            undefined,
            // eslint-disable-next-line react/jsx-key
            <span>
                You are now ignoring <i>foo</i>
            </span>,
        ],
        [
            "handles variable substitution with react node",
            variableSub,
            { userId: <i>foo</i> },
            undefined,
            // eslint-disable-next-line react/jsx-key
            <span>
                You are now ignoring <i>foo</i>
            </span>,
        ],
        [
            "handles tag substitution with React function component",
            selfClosingTagSub,
            {},
            { policyLink: () => <i>foo</i> },
            // eslint-disable-next-line react/jsx-key
            <span>
                Accept <i>foo</i> to continue:
            </span>,
        ],
    ];

    let oldNodeEnv: string | undefined;
    beforeAll(() => {
        oldNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
    });

    afterAll(() => {
        process.env.NODE_ENV = oldNodeEnv;
    });

    describe("when translations exist in language", () => {
        beforeEach(function () {
            stubClient();

            setLanguage("en");
            setMissingEntryGenerator((key) => key.split("|", 2)[1]);
        });

        it("translates a string to german", async () => {
            await setLanguage("de");
            const translated = _t(basicString);
            expect(translated).toBe("Räume");
        });

        it.each(testCasesEn)("%s", (_d, translationString, variables, tags, result) => {
            expect(_t(translationString, variables, tags!)).toEqual(result);
        });

        it("replacements in the wrong order", function () {
            const text = "%(var1)s %(var2)s" as TranslationKey;
            expect(_t(text, { var2: "val2", var1: "val1" })).toBe("val1 val2");
        });

        it("multiple replacements of the same variable", function () {
            const text = "%(var1)s %(var1)s";
            expect(substitute(text, { var1: "val1" })).toBe("val1 val1");
        });

        it("multiple replacements of the same tag", function () {
            const text = "<a>Click here</a> to join the discussion! <a>or here</a>";
            expect(substitute(text, {}, { a: (sub) => `x${sub}x` })).toBe(
                "xClick herex to join the discussion! xor herex",
            );
        });
    });

    describe("for a non-en language", () => {
        beforeEach(() => {
            stubClient();
            setLanguage("lv");
            // counterpart doesnt expose any way to restore default config
            // missingEntryGenerator is mocked in the root setup file
            // reset to default here
            const counterpartDefaultMissingEntryGen = function (key: string) {
                return "missing translation: " + key;
            };
            setMissingEntryGenerator(counterpartDefaultMissingEntryGen);
        });

        // mocked lv has only `"Uploading %(filename)s and %(count)s others|one"`
        const lvExistingPlural = "room|upload|uploading_multiple_file";
        const lvNonExistingPlural = "%(spaceName)s and %(count)s others";

        describe("pluralization", () => {
            const pluralCases = [
                [
                    "falls back when plural string exists but not for for count",
                    lvExistingPlural,
                    { count: 2, filename: "test.txt" },
                    undefined,
                    "Uploading test.txt and 2 others",
                ],
                [
                    "falls back when plural string does not exists at all",
                    lvNonExistingPlural,
                    { count: 2, spaceName: "test" },
                    undefined,
                    "test and 2 others",
                ],
            ] as TestCase[];

            describe("_t", () => {
                it("translated correctly when plural string exists for count", () => {
                    expect(_t(lvExistingPlural, { count: 1, filename: "test.txt" })).toEqual(
                        "Качване на test.txt и 1 друг",
                    );
                });
                it.each(pluralCases)("%s", (_d, translationString, variables, tags, result) => {
                    expect(_t(translationString, variables, tags!)).toEqual(result);
                });
            });

            describe("_tDom()", () => {
                it("translated correctly when plural string exists for count", () => {
                    expect(_tDom(lvExistingPlural, { count: 1, filename: "test.txt" })).toEqual(
                        "Качване на test.txt и 1 друг",
                    );
                });
                it.each(pluralCases)(
                    "%s and translates with fallback locale, attributes fallback locale",
                    (_d, translationString, variables, tags, result) => {
                        expect(_tDom(translationString, variables, tags!)).toEqual(<span lang="en">{result}</span>);
                    },
                );
            });
        });

        describe("when a translation string does not exist in active language", () => {
            describe("_t", () => {
                it.each(testCasesEn)(
                    "%s and translates with fallback locale",
                    (_d, translationString, variables, tags, result) => {
                        expect(_t(translationString, variables, tags!)).toEqual(result);
                    },
                );
            });

            describe("_tDom()", () => {
                it.each(testCasesEn)(
                    "%s and translates with fallback locale, attributes fallback locale",
                    (_d, translationString, variables, tags, result) => {
                        expect(_tDom(translationString, variables, tags!)).toEqual(<span lang="en">{result}</span>);
                    },
                );
            });
        });
    });

    describe("when languages dont load", () => {
        it("_t", () => {
            const STRING_NOT_IN_THE_DICTIONARY = "a string that isn't in the translations dictionary" as TranslationKey;
            expect(_t(STRING_NOT_IN_THE_DICTIONARY, {})).toEqual(STRING_NOT_IN_THE_DICTIONARY);
        });

        it("_tDom", () => {
            const STRING_NOT_IN_THE_DICTIONARY = "a string that isn't in the translations dictionary" as TranslationKey;
            expect(_tDom(STRING_NOT_IN_THE_DICTIONARY, {})).toEqual(
                <span lang="en">{STRING_NOT_IN_THE_DICTIONARY}</span>,
            );
        });
    });
});
