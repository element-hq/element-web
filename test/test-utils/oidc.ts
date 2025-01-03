/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { OidcClientConfig } from "matrix-js-sdk/src/matrix";
import { ValidatedIssuerMetadata } from "matrix-js-sdk/src/oidc/validate";

/**
 * Makes a valid OidcClientConfig with minimum valid values
 * @param issuer used as the base for all other urls
 * @returns OidcClientConfig
 */
export const makeDelegatedAuthConfig = (issuer = "https://auth.org/"): OidcClientConfig => {
    const metadata = mockOpenIdConfiguration(issuer);

    return {
        accountManagementEndpoint: issuer + "account",
        registrationEndpoint: metadata.registration_endpoint,
        authorizationEndpoint: metadata.authorization_endpoint,
        tokenEndpoint: metadata.token_endpoint,
        metadata,
    };
};

/**
 * Useful for mocking <issuer>/.well-known/openid-configuration
 * @param issuer used as the base for all other urls
 * @returns ValidatedIssuerMetadata
 */
export const mockOpenIdConfiguration = (issuer = "https://auth.org/"): ValidatedIssuerMetadata => ({
    issuer,
    revocation_endpoint: issuer + "revoke",
    token_endpoint: issuer + "token",
    authorization_endpoint: issuer + "auth",
    registration_endpoint: issuer + "registration",
    device_authorization_endpoint: issuer + "device",
    jwks_uri: issuer + "jwks",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    account_management_uri: issuer + "account",
});
