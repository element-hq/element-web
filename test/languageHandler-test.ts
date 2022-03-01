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
} from "../src/languageHandler";

describe('languageHandler', () => {
    afterEach(() => {
        SdkConfig.unset();
        CustomTranslationOptions.lookupFn = undefined;
    });

    it('should support overriding translations', async () => {
        const str = "This is a test string that does not exist in the app.";
        const enOverride = "This is the English version of a custom string.";
        const deOverride = "This is the German version of a custom string.";
        const overrides: ICustomTranslations = {
            [str]: {
                "en": enOverride,
                "de": deOverride,
            },
        };

        const lookupUrl = "/translations.json";
        const fn = (url: string): ICustomTranslations => {
            expect(url).toEqual(lookupUrl);
            return overrides;
        };

        // First test that overrides aren't being used

        await setLanguage("en");
        expect(_t(str)).toEqual(str);

        await setLanguage("de");
        expect(_t(str)).toEqual(str);

        // Now test that they *are* being used
        SdkConfig.add({
            custom_translations_url: lookupUrl,
        });
        CustomTranslationOptions.lookupFn = fn;
        await registerCustomTranslations();

        await setLanguage("en");
        expect(_t(str)).toEqual(enOverride);

        await setLanguage("de");
        expect(_t(str)).toEqual(deOverride);
    });
});
