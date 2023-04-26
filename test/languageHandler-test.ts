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

import SdkConfig from "../src/SdkConfig";
import {
    _t,
    CustomTranslationOptions,
    ICustomTranslations,
    registerCustomTranslations,
    setLanguage,
    UserFriendlyError,
} from "../src/languageHandler";

async function setupTranslationOverridesForTests(overrides: ICustomTranslations) {
    const lookupUrl = "/translations.json";
    const fn = (url: string): ICustomTranslations => {
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
    afterEach(() => {
        SdkConfig.reset();
        CustomTranslationOptions.lookupFn = undefined;
    });

    it("should support overriding translations", async () => {
        const str = "This is a test string that does not exist in the app.";
        const enOverride = "This is the English version of a custom string.";
        const deOverride = "This is the German version of a custom string.";

        // First test that overrides aren't being used
        await setLanguage("en");
        expect(_t(str)).toEqual(str);
        await setLanguage("de");
        expect(_t(str)).toEqual(str);

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

    describe("UserFriendlyError", () => {
        const testErrorMessage = "This email address is already in use (%(email)s)";
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
            const friendlyError = new UserFriendlyError("foo error");
            expect(friendlyError.cause).toBeUndefined();
        });
    });
});
