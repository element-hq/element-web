/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { type Translation } from "matrix-web-i18n";

import SdkConfig from "../../src/SdkConfig";
import { _t } from ".";
import { setLanguage } from "./settings";
import { setupTranslationOverridesForTests } from "./__mocks__";

describe("registerCustomTranslations", () => {
    beforeEach(async () => {
        await setLanguage("en");
    });

    afterEach(() => {
        SdkConfig.reset();
        fetchMock.removeRoute("i18n-override");
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
});
