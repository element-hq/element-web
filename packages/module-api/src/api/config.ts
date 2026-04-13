/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

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
