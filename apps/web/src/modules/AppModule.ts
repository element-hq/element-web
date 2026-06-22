/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RuntimeModule } from "@matrix-org/react-sdk-module-api/lib/RuntimeModule";

import { type ModuleFactory } from "./ModuleFactory";
import { ProxiedModuleApi } from "./ProxiedModuleApi";
import { type SdkContextClass } from "../contexts/SDKContextClass.ts";
import defaultDispatcher from "../dispatcher/dispatcher.ts";

/**
 * Wraps a module factory into a usable module. Acts as a simple container
 * for the constructs needed to operate a module.
 */
export class AppModule {
    /**
     * The module instance.
     */
    public readonly module: RuntimeModule;

    /**
     * The API instance used by the module.
     */
    public readonly api;

    /**
     * Converts a factory into an AppModule. The factory will be called
     * immediately.
     * @param factory The module factory.
     */
    public constructor(factory: ModuleFactory, sdkContext: SdkContextClass) {
        this.api = new ProxiedModuleApi(defaultDispatcher, sdkContext);
        this.module = factory(this.api);
    }
}
