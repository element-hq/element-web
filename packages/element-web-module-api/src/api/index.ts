/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Root } from "react-dom/client";
import { LegacyModuleApiExtension } from "./legacy-modules";
import { LegacyCustomisationsApiExtension } from "./legacy-customisations";
import { ConfigApi } from "./config";
import { I18nApi } from "./i18n";
import { CustomComponentsApi } from "./custom-components";
import { NavigationApi } from "./navigation.ts";
import { DialogApiExtension } from "./dialog.ts";
import { AccountAuthApiExtension } from "./auth.ts";
import { ProfileApiExtension } from "./profile.ts";
import { ExtrasApi } from "./extras.ts";
import { BuiltinsApi } from "./builtins.ts";

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
    default: "function",
};

type Type = "function" | "string" | "number" | "boolean" | "object";

function isInterface<T>(obj: unknown, type: "object" | "function", keys: Record<keyof T, Type>): obj is T {
    if (obj === null || typeof obj !== type) return false;
    for (const key in keys) {
        if (typeof (obj as Record<keyof T, unknown>)[key] !== keys[key]) return false;
    }
    return true;
}

export function isModule(module: unknown): module is ModuleExport {
    return (
        isInterface(module, "object", moduleExportSignature) &&
        isInterface(module.default, "function", moduleFactorySignature) &&
        isInterface(module.default.prototype, "object", moduleSignature)
    );
}

/**
 * The API for modules to interact with the application.
 * @public
 */
export interface Api
    extends LegacyModuleApiExtension,
        LegacyCustomisationsApiExtension,
        DialogApiExtension,
        AccountAuthApiExtension,
        ProfileApiExtension {
    /**
     * The API to read config.json values.
     * Keys should be scoped to the module in reverse domain name notation.
     * @public
     */
    readonly config: ConfigApi;
    /**
     * The internationalisation API.
     * @public
     */
    readonly i18n: I18nApi;
    /**
     * The root node the main application is rendered to.
     * Intended for rendering sibling React trees.
     * @public
     */
    readonly rootNode: HTMLElement;

    /**
     * The custom message component API.
     * @alpha
     */
    readonly customComponents: CustomComponentsApi;

    readonly builtins: BuiltinsApi;

    /**
     * API to navigate the application.
     * @public
     */
    readonly navigation: NavigationApi;

    readonly extras: ExtrasApi;

    /**
     * Create a ReactDOM root for rendering React components.
     * Exposed to allow modules to avoid needing to bundle their own ReactDOM.
     * @param element - the element to render use as the root.
     * @public
     */
    createRoot(element: Element): Root;
}
