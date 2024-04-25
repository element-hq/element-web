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
import { AllExtensions } from "@matrix-org/react-sdk-module-api/lib/types/extensions";
import { DefaultCryptoSetupExtensions } from "@matrix-org/react-sdk-module-api/lib/lifecycles/CryptoSetupExtensions";
import { DefaultExperimentalExtensions } from "@matrix-org/react-sdk-module-api/lib/lifecycles/ExperimentalExtensions";
import { RuntimeModule } from "@matrix-org/react-sdk-module-api";

import { AppModule } from "./AppModule";
import { ModuleFactory } from "./ModuleFactory";

import "./ModuleComponents";

/**
 * Handles and coordinates the operation of modules.
 */
export class ModuleRunner {
    public static readonly instance = new ModuleRunner();

    public className: string = ModuleRunner.name;

    public extensions: AllExtensions = {
        cryptoSetup: new DefaultCryptoSetupExtensions(),
        experimental: new DefaultExperimentalExtensions(),
    };

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

        this.extensions = {
            cryptoSetup: new DefaultCryptoSetupExtensions(),
            experimental: new DefaultExperimentalExtensions(),
        };
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
     * Ensure we register extensions provided by the modules
     */
    private updateExtensions(): void {
        const cryptoSetupExtensions: Array<RuntimeModule> = [];
        const experimentalExtensions: Array<RuntimeModule> = [];

        this.modules.forEach((m) => {
            /* Record the cryptoSetup extensions if any */
            if (m.module.extensions?.cryptoSetup) {
                cryptoSetupExtensions.push(m.module);
            }

            /* Record the experimantal extensions if any */
            if (m.module.extensions?.experimental) {
                experimentalExtensions.push(m.module);
            }
        });

        /* Enforce rule that only a single module may provide a given extension */
        if (cryptoSetupExtensions.length > 1) {
            throw new Error(
                `cryptoSetup extension is provided by modules ${cryptoSetupExtensions
                    .map((m) => m.moduleName)
                    .join(", ")}, but can only be provided by a single module`,
            );
        }
        if (experimentalExtensions.length > 1) {
            throw new Error(
                `experimental extension is provided by modules ${experimentalExtensions
                    .map((m) => m.moduleName)
                    .join(", ")}, but can only be provided by a single module`,
            );
        }

        /* Override the default extension if extension was provided by a module */
        if (cryptoSetupExtensions.length == 1) {
            this.extensions.cryptoSetup = cryptoSetupExtensions[0].extensions?.cryptoSetup;
        }

        if (experimentalExtensions.length == 1) {
            this.extensions.experimental = cryptoSetupExtensions[0].extensions?.experimental;
        }
    }

    /**
     * Registers a factory which creates a module for later loading. The factory
     * will be called immediately.
     * @param factory The module factory.
     */
    public registerModule(factory: ModuleFactory): void {
        this.modules.push(new AppModule(factory));

        /**
         * Check if the new module provides any extensions, and also ensure a given extension is only provided by a single runtime module
         * Slightly inefficient to do this on each registration, but avoids changes to element-web installer code
         * Also note that this require that the statement in the comment above, about immediately calling the factory, is in fact true
         * (otherwise wrapped RuntimeModules will not be available)
         */

        this.updateExtensions();
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
