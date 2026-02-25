/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type OidcClientConfig } from "matrix-js-sdk/src/matrix";

export interface ValidatedServerConfig {
    hsUrl: string;
    hsName: string;
    hsNameIsDifferent: boolean;

    isUrl: string;

    isDefault: boolean;
    // when the server config is based on static URLs the hsName is not resolvable and things may wish to use hsUrl
    isNameResolvable: boolean;

    warning: string | Error;

    /**
     * Config related to delegated authentication
     * Included when delegated auth is configured and valid, otherwise undefined.
     * From issuer's .well-known/openid-configuration.
     * Used for OIDC native flow authentication.
     */
    delegatedAuthentication?: OidcClientConfig;
}
