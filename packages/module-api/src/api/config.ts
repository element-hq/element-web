/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type WebConfigJson } from "shared-types";

/**
 * The configuration for the application.
 * Should be extended via declaration merging.
 * @public
 */
export interface Config extends WebConfigJson {
    // The branding name of the application
    brand: string;
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
