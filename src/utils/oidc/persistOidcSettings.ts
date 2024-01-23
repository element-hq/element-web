/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { IdTokenClaims } from "oidc-client-ts";

const clientIdStorageKey = "mx_oidc_client_id";
const tokenIssuerStorageKey = "mx_oidc_token_issuer";
const idTokenClaimsStorageKey = "mx_oidc_id_token_claims";

/**
 * Persists oidc clientId and issuer in local storage
 * Only set after successful authentication
 * @param clientId
 * @param issuer
 */
export const persistOidcAuthenticatedSettings = (
    clientId: string,
    issuer: string,
    idTokenClaims: IdTokenClaims,
): void => {
    localStorage.setItem(clientIdStorageKey, clientId);
    localStorage.setItem(tokenIssuerStorageKey, issuer);
    localStorage.setItem(idTokenClaimsStorageKey, JSON.stringify(idTokenClaims));
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
 * Retrieve stored id token claims from local storage
 * @returns idtokenclaims or undefined
 */
export const getStoredOidcIdTokenClaims = (): IdTokenClaims | undefined => {
    const idTokenClaims = localStorage.getItem(idTokenClaimsStorageKey);
    if (!idTokenClaims) {
        return;
    }
    return JSON.parse(idTokenClaims) as IdTokenClaims;
};
