/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IdTokenClaims } from "oidc-client-ts";
import { decodeIdToken } from "matrix-js-sdk/src/matrix";

const clientIdStorageKey = "mx_oidc_client_id";
const tokenIssuerStorageKey = "mx_oidc_token_issuer";
const idTokenStorageKey = "mx_oidc_id_token";
/**
 * @deprecated in favour of using idTokenStorageKey
 */
const idTokenClaimsStorageKey = "mx_oidc_id_token_claims";

/**
 * Persists oidc clientId and issuer in local storage
 * Only set after successful authentication
 * @param clientId
 * @param issuer
 * @param idToken
 * @param idTokenClaims
 */
export const persistOidcAuthenticatedSettings = (clientId: string, issuer: string, idToken: string): void => {
    localStorage.setItem(clientIdStorageKey, clientId);
    localStorage.setItem(tokenIssuerStorageKey, issuer);
    localStorage.setItem(idTokenStorageKey, idToken);
};

/**
 * Retrieve stored oidc issuer from local storage
 * When user has token from OIDC issuer, this will be set
 * @returns issuer or undefined
 */
export const getStoredOidcTokenIssuer = (): string | undefined => {
    return localStorage.getItem(tokenIssuerStorageKey) ?? undefined;
};

/**
 * Retrieves stored oidc client id from local storage
 * @returns clientId
 * @throws when clientId is not found in local storage
 */
export const getStoredOidcClientId = (): string => {
    const clientId = localStorage.getItem(clientIdStorageKey);
    if (!clientId) {
        throw new Error("Oidc client id not found in storage");
    }
    return clientId;
};

/**
 * Retrieve stored id token claims from stored id token or local storage
 * @returns idTokenClaims or undefined
 */
export const getStoredOidcIdTokenClaims = (): IdTokenClaims | undefined => {
    const idToken = getStoredOidcIdToken();
    if (idToken) {
        return decodeIdToken(idToken);
    }

    const idTokenClaims = localStorage.getItem(idTokenClaimsStorageKey);
    if (!idTokenClaims) {
        return;
    }
    return JSON.parse(idTokenClaims) as IdTokenClaims;
};

/**
 * Retrieve stored id token from local storage
 * @returns idToken or undefined
 */
export const getStoredOidcIdToken = (): string | undefined => {
    return localStorage.getItem(idTokenStorageKey) ?? undefined;
};
