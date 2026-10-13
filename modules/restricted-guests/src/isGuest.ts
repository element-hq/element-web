/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api } from "@element-hq/element-web-module-api";

import type { ModuleConfig } from "./config";

/**
 * Whether the current user is a guest: a Matrix guest, or a user registered by this module.
 *
 * @param api - Module API
 * @param config - Module configuration
 */
export function isGuest(api: Api, config: ModuleConfig): boolean {
    const profile = api.profile.value;
    return Boolean(profile.isGuest || profile.userId?.startsWith(config.guest_user_prefix));
}
