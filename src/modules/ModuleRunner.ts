/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { safeSet } from "matrix-js-sdk/src/utils";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api/lib/types/translations";
import { type AnyLifecycle } from "@matrix-org/react-sdk-module-api/lib/lifecycles/types";
import {
    DefaultCryptoSetupExtensions,
    type ProvideCryptoSetupExtensions,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CryptoSetupExtensions";
import {
    DefaultExperimentalExtensions,
    type ProvideExperimentalExtensions,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/ExperimentalExtensions";

import { AppModule } from "./AppModule";
import { type ModuleFactory } from "./ModuleFactory";

import "./ModuleComponents";

/**
 * Handles and manages extensions provided by modules.
 */
class ExtensionsManager {
    // Private backing fields for extensions
    private cryptoSetupExtension: ProvideCryptoSetupExtensions;
    private experimentalExtension: ProvideExperimentalExtensions;

    /** `true` if `cryptoSetupExtension` is the default implementation; `false` if it is implemented by a module. */
    private hasDefaultCryptoSetupExtension = true;

    /** `true` if `experimentalExtension` is the default implementation; `false` if it is implemented by a module. */
    private hasDefaultExperimentalExtension = true;

    /**
     * Create a new instance.
     */
    public constructor() {
        // Set up defaults
        this.cryptoSetupExtension = new DefaultCryptoSetupExtensions();
        this.experimentalExtension = new DefaultExperimentalExtensions();
    }

    /**
     * Provides a crypto setup extension.
     *
     * @returns The registered extension. If no module provides this extension, a default implementation is returned.
     */
    public get cryptoSetup(): ProvideCryptoSetupExtensions {
        return this.cryptoSetupExtension;
    }

    /**
     * Provides an experimental extension.
     *
     * @remarks
     * This method extension is provided to simplify experimentation and development, and is not intended for production code.
     *
     * @returns The registered extension. If no module provides this extension, a default implementation is returned.
     */
    public get experimental(): ProvideExperimentalExtensions {
        return this.experimentalExtension;
    }

    /**
     * Add any extensions provided by the module.
     *
     * @param module - The appModule to check for extensions.
     *
     * @throws if an extension is provided by more than one module.
     */
    public addExtensions(module: AppModule): void {
        const runtimeModule = module.module;

        /* Add the cryptoSetup extension if any */
        if (runtimeModule.extensions?.cryptoSetup) {
            if (this.hasDefaultCryptoSetupExtension) {
                this.cryptoSetupExtension = runtimeModule.extensions?.cryptoSetup;
                this.hasDefaultCryptoSetupExtension = false;
            } else {
                throw new Error(
                    `adding cryptoSetup extension implementation from module ${runtimeModule.moduleName} but an implementation was already provided.`,
                );
            }
        }

        /* Add the experimental extension if any */
        if (runtimeModule.extensions?.experimental) {
            if (this.hasDefaultExperimentalExtension) {
                this.experimentalExtension = runtimeModule.extensions?.experimental;
                this.hasDefaultExperimentalExtension = false;
            } else {
                throw new Error(
                    `adding experimental extension implementation from module ${runtimeModule.moduleName} but an implementation was already provided.`,
                );
            }
        }
    }
}

/**
 * Handles and coordinates the operation of modules.
 */
export class ModuleRunner {
    public static readonly instance = new ModuleRunner();

    private extensionsManager = new ExtensionsManager();

    private modules: AppModule[] = [];

    private constructor() {
        // we only want one instance
    }

    /**
     * Exposes all extensions which may be overridden/provided by modules.
     *
     * @returns An `ExtensionsManager` which exposes the extensions.
     */
    public get extensions(): ExtensionsManager {
        return this.extensionsManager;
    }

    /**
     * Resets the runner, clearing all known modules, and all extensions
     *
     * Intended for test usage only.
     */
    public reset(): void {
        this.modules = [];
        this.extensionsManager = new ExtensionsManager();
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
        const appModule = new AppModule(factory);

        this.modules.push(appModule);

        // Check if the new module provides any extensions, and also ensure a given extension is only provided by a single runtime module.
        this.extensionsManager.addExtensions(appModule);
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
