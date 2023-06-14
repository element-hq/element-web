/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";

import {
    _t,
    _tDom,
    TranslatedString,
    setLanguage,
    setMissingEntryGenerator,
    substitute,
} from "../../src/languageHandler";
import { stubClient } from "../test-utils";

describe("languageHandler", function () {
    // See setupLanguage.ts for how we are stubbing out translations to provide fixture data for these tests
    const basicString = "Rooms";
    const selfClosingTagSub = "Accept <policyLink /> to continue:";
    const textInTagSub = "<a>Upgrade</a> to your own domain";
    const plurals = "and %(count)s others...";
    const variableSub = "You are now ignoring %(userId)s";

    type TestCase = [string, string, Record<string, unknown>, Record<string, unknown> | undefined, TranslatedString];
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
            const text = "%(var1)s %(var2)s";
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
        const lvExistingPlural = "Uploading %(filename)s and %(count)s others";
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
            const STRING_NOT_IN_THE_DICTIONARY = "a string that isn't in the translations dictionary";
            expect(_t(STRING_NOT_IN_THE_DICTIONARY, {})).toEqual(STRING_NOT_IN_THE_DICTIONARY);
        });

        it("_tDom", () => {
            const STRING_NOT_IN_THE_DICTIONARY = "a string that isn't in the translations dictionary";
            expect(_tDom(STRING_NOT_IN_THE_DICTIONARY, {})).toEqual(
                <span lang="en">{STRING_NOT_IN_THE_DICTIONARY}</span>,
            );
        });
    });
});
