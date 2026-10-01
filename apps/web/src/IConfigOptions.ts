/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ResolveDefaults, type WebConfigJson } from "shared-types";

import { type ValidatedServerConfig } from "./utils/ValidatedServerConfig";
import { type DEFAULTS } from "./SdkConfig.ts";

/**
 * Bug reports are enabled but must only be locally
 * downloadable.
 */
export const BugReportEndpointURLLocal = "local";

export interface ConfigOptions extends WebConfigJson {
    /**
     * This is not a real config field, we're just abusing the config structure to pass around a validated server config
     */
    validated_server_config?: ValidatedServerConfig;
}

/**
 * Type representing the effective config.json structure after DEFAULTS has been merged in
 */
export type IConfigOptions = ResolveDefaults<ConfigOptions, typeof DEFAULTS>;
