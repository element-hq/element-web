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

import { safeSet } from "matrix-js-sdk/src/utils";
import { TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { AnyLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/types";

import { AppModule } from "./AppModule";
import { ModuleFactory } from "./ModuleFactory";

import "./ModuleComponents";

/**
 * Handles and coordinates the operation of modules.
 */
export class ModuleRunner {
    public static readonly instance = new ModuleRunner();

    private modules: AppModule[] = [];

    private constructor() {
        // we only want one instance
    }

    /**
     * Resets the runner, clearing all known modules.
     *
     * Intended for test usage only.
     */
    public reset(): void {
        this.modules = [];
    }

    /**
     * All custom translations from all registered modules.
     */
    public get allTranslations(): TranslationStringsObject {
        const merged: TranslationStringsObject = {};

        for (const module of this.modules) {
            const i18n = module.api.translations;
            if (!i18n) continue;

            for (const [lang, strings] of Object.entries(i18n)) {
                safeSet(merged, lang, merged[lang] || {});

                for (const [str, val] of Object.entries(strings)) {
                    safeSet(merged[lang], str, val);
                }
            }
        }

        return merged;
    }

    /**
     * Registers a factory which creates a module for later loading. The factory
     * will be called immediately.
     * @param factory The module factory.
     */
    public registerModule(factory: ModuleFactory): void {
        this.modules.push(new AppModule(factory));
    }

    /**
     * Invokes a lifecycle event, notifying registered modules.
     * @param lifecycleEvent The lifecycle event.
     * @param args The arguments for the lifecycle event.
     */
    public invoke(lifecycleEvent: AnyLifecycle, ...args: any[]): void {
        for (const module of this.modules) {
            module.module.emit(lifecycleEvent, ...args);
        }
    }
}
