/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { LegacyModuleApiExtension } from "./legacy-modules";
import { LegacyCustomisationsApiExtension } from "./legacy-customisations";

export interface Module {
    load(): Promise<void>;
}

const moduleSignature: Record<keyof Module, Type> = {
    load: "function",
};

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

export function isInterface<T>(obj: unknown, keys: Record<keyof T, Type>): obj is T {
    if (obj === null || typeof obj !== "object") return false;
    for (const key in keys) {
        if (typeof obj[key] !== keys[key]) return false;
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

export interface Api extends LegacyModuleApiExtension, LegacyCustomisationsApiExtension {}
