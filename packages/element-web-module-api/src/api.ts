/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { LegacyModuleApiExtension } from "./legacy-modules";
import { LegacyCustomisationsApiExtension } from "./legacy-customisations";

/**
 * Module interface for modules to implement.
 * @public
 */
export interface Module {
    load(): Promise<void>;
}

const moduleSignature: Record<keyof Module, Type> = {
    load: "function",
};

/**
 * Module interface for modules to export as the default export.
 * @public
 */
export interface ModuleFactory {
    readonly moduleApiVersion: string;
    new (api: Api): Module;
    readonly prototype: Module;
}

const moduleFactorySignature: Record<keyof ModuleFactory, Type> = {
    moduleApiVersion: "string",
    prototype: "object",
};

export interface ModuleExport {
    default: ModuleFactory;
}

const moduleExportSignature: Record<keyof ModuleExport, Type> = {
    default: "object",
};

type Type = "function" | "string" | "number" | "boolean" | "object";

function isInterface<T>(obj: unknown, keys: Record<keyof T, Type>): obj is T {
    if (obj === null || typeof obj !== "object") return false;
    for (const key in keys) {
        if (typeof (obj as Record<keyof T, unknown>)[key] !== keys[key]) return false;
    }
    return true;
}

export function isModule(module: unknown): module is ModuleExport {
    return (
        isInterface(module, moduleExportSignature) &&
        isInterface(module.default, moduleFactorySignature) &&
        isInterface(module.default.prototype, moduleSignature)
    );
}

/**
 * The configuration for the application.
 * Should be extended via declaration merging.
 * @public
 */
export interface Config {
    // The branding name of the application
    brand: string;
    // Other config options are available but not specified in the types as that would make it difficult to change for element-web
    // they are accessible at runtime all the same, see list at https://github.com/element-hq/element-web/blob/develop/docs/config.md
}

/**
 * API for accessing the configuration.
 * @public
 */
export interface ConfigApi {
    get(): Config;
    get<K extends keyof Config>(key: K): Config[K];
    get<K extends keyof Config = never>(key?: K): Config | Config[K];
}

/**
 * The API for modules to interact with the application.
 * @public
 */
export interface Api extends LegacyModuleApiExtension, LegacyCustomisationsApiExtension {
    config: ConfigApi;
}
