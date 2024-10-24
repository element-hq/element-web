/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { OidcClientConfig } from "matrix-js-sdk/src/matrix";

/**
 * Check the create prompt is supported by the OP, if so, we can do a registration flow
 * https://openid.net/specs/openid-connect-prompt-create-1_0.html
 * @param delegatedAuthConfig config as returned from discovery
 * @returns whether user registration is supported
 */
export const isUserRegistrationSupported = (delegatedAuthConfig: OidcClientConfig): boolean => {
    // The OidcMetadata type from oidc-client-ts does not include `prompt_values_supported`
    // even though it is part of the OIDC spec, so cheat TS here to access it
    const supportedPrompts = (delegatedAuthConfig.metadata as Record<string, unknown>)["prompt_values_supported"];
    return Array.isArray(supportedPrompts) && supportedPrompts?.includes("create");
};
