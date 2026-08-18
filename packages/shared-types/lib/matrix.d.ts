/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JsonDocument } from "./json";

/**
 * As specified by https://spec.matrix.org/latest/client-server-api/#getwell-knownmatrixclient
 */
export type ClientWellKnown = {
    /**
     * Used by clients to discover homeserver information.
     */
    "m.homeserver": {
        /**
         * The base URL for the homeserver for client-server connections.
         */
        base_url: string;
        /**
         * This field is not part of the spec but supported by Element Web's config.json
         * @deprecated - we should figure out whether we want to keep this or not.
         */
        server_name?: string;
    };
    /**
     * Used by clients to discover identity server information.
     */
    "m.identity_server"?: {
        /**
         * The base URL for the identity server for client-server connections.
         */
        base_url: string;
    };
} & {
    /**
     * Other properties
     * Application-dependent keys using Java package naming convention.
     */
    [key: string]: JsonDocument;
};
