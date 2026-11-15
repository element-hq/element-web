/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { satisfies } from "semver";

import { type Api, isModule, type Module, type ModuleExport } from "./api";

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
    private modules: Module[] = [];
    private started = false;

    public constructor(private api: Api) {}

    public async load(moduleExport: ModuleExport): Promise<void> {
        if (this.started) {
            throw new Error("PluginEngine.start() has already been called");
        }

        if (!isModule(moduleExport)) {
            throw new Error("Invalid plugin");
        }
        if (!satisfies(__VERSION__, moduleExport.default.moduleApiVersion)) {
            throw new ModuleIncompatibleError(moduleExport.default.moduleApiVersion);
        }
        const { default: Module } = moduleExport;
        this.modules.push(new Module(this.api));
    }

    public async start(): Promise<void> {
        if (this.started) {
            throw new Error("PluginEngine.start() has already been called");
        }
        this.started = true;

        await Promise.all(this.modules.map((plugin) => plugin.load()));
    }

    /**
     * Calls {@link Module.onLoggedIn} on every started module that implements it.
     * A failure in one module is logged and does not prevent the others from being called.
     */
    public async onLoggedIn(): Promise<void> {
        await this.callLifecycleHook("onLoggedIn");
    }

    /**
     * Calls {@link Module.onLoggedOut} on every started module that implements it.
     * A failure in one module is logged and does not prevent the others from being called.
     */
    public async onLoggedOut(): Promise<void> {
        await this.callLifecycleHook("onLoggedOut");
    }

    private async callLifecycleHook(hook: "onLoggedIn" | "onLoggedOut"): Promise<void> {
        // Modules which have not been loaded yet should not receive lifecycle events.
        if (!this.started) return;

        const results = await Promise.allSettled(this.modules.map(async (module) => module[hook]?.()));
        for (const result of results) {
            if (result.status === "rejected") {
                console.error(`Module ${hook} hook failed`, result.reason);
            }
        }
    }
}
