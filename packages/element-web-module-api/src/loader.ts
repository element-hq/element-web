/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { satisfies } from "semver";

import { Api, isModule, Module, ModuleExport } from "./api";

/**
 * Error thrown when a module is incompatible with the engine version.
 * @public
 */
export class ModuleIncompatibleError extends Error {
    public constructor(pluginVersion: string) {
        super(`Plugin version ${pluginVersion} is incompatible with engine version ${__VERSION__}`);
    }
}

/**
 * A module loader for loading and starting modules.
 * @public
 */
export class ModuleLoader {
    public constructor(private api: Api) {}

    #modules: Module[] = [];
    public async load(moduleExport: ModuleExport): Promise<void> {
        if (this.#started) {
            throw new Error("PluginEngine.start() has already been called");
        }

        if (!isModule(moduleExport)) {
            throw new Error("Invalid plugin");
        }
        if (!satisfies(__VERSION__, moduleExport.default.moduleApiVersion)) {
            throw new ModuleIncompatibleError(moduleExport.default.moduleApiVersion);
        }
        const { default: Module } = moduleExport;
        this.#modules.push(new Module(this.api));
    }

    #started = false;
    public async start(): Promise<void> {
        if (this.#started) {
            throw new Error("PluginEngine.start() has already been called");
        }
        this.#started = true;

        await Promise.all(this.#modules.map((plugin) => plugin.load()));
    }
}
