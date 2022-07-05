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

import { TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";

import { ProxiedModuleApi } from "../../src/modules/ProxiedModuleApi";
import { stubClient } from "../test-utils";
import { setLanguage } from "../../src/languageHandler";
import { ModuleRunner } from "../../src/modules/ModuleRunner";
import { registerMockModule } from "./MockModule";

describe("ProxiedApiModule", () => {
    afterEach(() => {
        ModuleRunner.instance.reset();
    });

    // Note: Remainder is implicitly tested from end-to-end tests of modules.

    describe("translations", () => {
        it("should cache translations", () => {
            const api = new ProxiedModuleApi();
            expect(api.translations).toBeFalsy();

            const translations: TranslationStringsObject = {
                ["custom string"]: {
                    "en": "custom string",
                    "fr": "custom french string",
                },
            };
            api.registerTranslations(translations);
            expect(api.translations).toBe(translations);
        });

        describe("integration", () => {
            it("should translate strings using translation system", async () => {
                // Test setup
                stubClient();

                // Set up a module to pull translations through
                const module = registerMockModule();
                const en = "custom string";
                const de = "custom german string";
                const enVars = "custom variable %(var)s";
                const varVal = "string";
                const deVars = "custom german variable %(var)s";
                const deFull = `custom german variable ${varVal}`;
                expect(module.apiInstance).toBeInstanceOf(ProxiedModuleApi);
                module.apiInstance.registerTranslations({
                    [en]: {
                        "en": en,
                        "de": de,
                    },
                    [enVars]: {
                        "en": enVars,
                        "de": deVars,
                    },
                });
                await setLanguage("de"); // calls `registerCustomTranslations()` for us

                // See if we can pull the German string out
                expect(module.apiInstance.translateString(en)).toEqual(de);
                expect(module.apiInstance.translateString(enVars, { var: varVal })).toEqual(deFull);
            });
        });
    });
});
