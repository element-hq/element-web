/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app, dialog } from "electron";
import path from "node:path";
import { type ResolveDefaults, type DesktopConfigJson, type JsonDocument } from "shared-types";

import { getAsarPath } from "./asar.js";
import { loadJsonFile } from "./utils.js";

export type ConfigOptions = ResolveDefaults<DesktopConfigJson, typeof DEFAULTS>;

const ConfigFilename = "config.json";

let config: ConfigOptions;

const homeserverProps = ["default_is_url", "default_hs_url", "default_server_name", "default_server_config"] as const;

function loadLocalConfigFile(location: string | undefined): JsonDocument {
    if (location) {
        console.log("Loading local config: " + location);
        return loadJsonFile(location);
    } else {
        const configDir = app.getPath("userData");
        console.log(`Loading local config: ${path.join(configDir, ConfigFilename)}`);
        return loadJsonFile(configDir, ConfigFilename);
    }
}

const DEFAULTS = {
    brand: "Element",
    help_url: "https://element.io/help",
    web_base_url: "https://app.element.io/",
} satisfies DesktopConfigJson;

function applyDefaults(conf: DesktopConfigJson): asserts conf is ConfigOptions {
    for (const k in DEFAULTS) {
        const key = k as keyof typeof DEFAULTS;
        conf[key] ||= DEFAULTS[key];
    }
}

let loadConfigPromise: Promise<ConfigOptions> | undefined;
// Loads the config from asar, and applies a config.json from userData atop if one exists
// Writes config to `global.vectorConfig`. Idempotent, returns the same promise on subsequent calls.
export function loadConfig(localConfigPath: string | undefined): Promise<ConfigOptions> {
    if (loadConfigPromise) return loadConfigPromise;

    async function actuallyLoadConfig(): Promise<ConfigOptions> {
        const asarPath = await getAsarPath();

        try {
            console.log(`Loading app config: ${path.join(asarPath, ConfigFilename)}`);
            // XXX: we trust that we built the package with a sane config, but should use something like zod here in future
            const loadedConfig = loadJsonFile(asarPath, ConfigFilename) as unknown as DesktopConfigJson;
            applyDefaults(loadedConfig);
            config = loadedConfig;
        } catch {
            // it would be nice to check the error code here and bail if the config
            // is unparsable, but we get MODULE_NOT_FOUND in the case of a missing
            // file or invalid json, so node is just very unhelpful.
            // Continue with the defaults (ie. an empty config)
            config = { ...DEFAULTS };
        }

        try {
            // Load local config and use it to override values from the one baked with the build
            const localConfig = loadLocalConfigFile(localConfigPath);

            // If the local config has a homeserver defined, don't use the homeserver from the build
            // config. This is to avoid a problem where Riot thinks there are multiple homeservers
            // defined, and panics as a result.
            if (Object.keys(localConfig).some((k) => homeserverProps.includes(<any>k))) {
                for (const key of homeserverProps) {
                    delete config[key];
                }
            }

            config = Object.assign(config, localConfig);
        } catch (e) {
            if (e instanceof SyntaxError) {
                await app.whenReady();
                void dialog.showMessageBox({
                    type: "error",
                    title: `Your ${config.brand} is misconfigured`,
                    message:
                        `Your custom ${config.brand} configuration contains invalid JSON. ` +
                        `Please correct the problem and reopen ${config.brand}.`,
                    detail: e.message || "",
                });
            }

            // Could not load local config, this is expected in most cases.
        }

        // Tweak modules paths as they assume the root is at the same level as webapp, but for `vector://vector/webapp` it is not.
        if (Array.isArray(config.modules)) {
            config.modules = config.modules.map((m) => {
                if (m.startsWith("/")) {
                    return "/webapp" + m;
                }
                return m;
            });
        }

        // Apply defaults again in case the local config had an explicit null/undefined value for required keys.
        applyDefaults(config);
        return config;
    }
    loadConfigPromise = actuallyLoadConfig();
    return loadConfigPromise;
}

export function getConfig(): ConfigOptions {
    return config;
}
