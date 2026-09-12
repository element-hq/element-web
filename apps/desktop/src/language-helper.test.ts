/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeEach, vi } from "vitest";
import { fs as memfs, vol } from "memfs";
import counterpart from "counterpart";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("node:fs", () => ({ default: memfs }));
vi.mock("node:fs/promises", () => ({ default: memfs.promises }));

const { AppLocalization } = await import("./language-helper.js");
const stringsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "i18n", "strings");

// Named the way the app is really built: a region which repeats the language, one which does not, and
// a script subtag whose case does not survive being upper-cased.
const strings = {
    [path.join(stringsDir, "en_EN.json")]: JSON.stringify({ greeting: "Hello" }),
    [path.join(stringsDir, "de_DE.json")]: JSON.stringify({ greeting: "Hallo" }),
    [path.join(stringsDir, "mg_MG.json")]: JSON.stringify({ greeting: "Salama" }),
    [path.join(stringsDir, "pt_BR.json")]: JSON.stringify({ greeting: "Olá" }),
    [path.join(stringsDir, "zh_Hans.json")]: JSON.stringify({ greeting: "你好" }),
    [path.join(stringsDir, "fr.json")]: JSON.stringify({ greeting: "Bonjour" }),
};

const store = { has: () => false, get: () => undefined, set: vi.fn() };

const localization = (): InstanceType<typeof AppLocalization> =>
    new AppLocalization({ components: [], store: store as never });

describe("AppLocalization", () => {
    beforeEach(() => {
        vol.reset();
        vol.fromJSON(strings);
    });

    describe("fetchTranslationJson", () => {
        it.each([
            ["de", "Hallo"],
            ["mg", "Salama"],
            ["pt-br", "Olá"],
            ["zh-hans", "你好"],
            ["fr", "Bonjour"],
            ["en", "Hello"],
        ])("loads the strings the web app asks for by the key '%s'", (locale, greeting) => {
            expect(localization().fetchTranslationJson(locale)).toEqual({ greeting });
        });

        it("returns nothing for a language which was not built in", () => {
            expect(localization().fetchTranslationJson("cy")).toEqual({});
        });
    });

    describe("setAppLocale", () => {
        it("skips a preference with no strings and settles on the next one", () => {
            localization().setAppLocale(["cy", "de"]);

            expect(counterpart.getLocale()).toBe("de");
        });

        it("falls back to English when none of the preferences have strings", () => {
            localization().setAppLocale(["cy", "eo"]);

            expect(counterpart.getLocale()).toBe("en");
        });
    });
});
