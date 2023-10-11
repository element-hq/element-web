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

import { completeAuthorizationCodeGrant, generateOidcAuthorizationUrl } from "matrix-js-sdk/src/oidc/authorize";
import { QueryDict } from "matrix-js-sdk/src/utils";
import { OidcClientConfig } from "matrix-js-sdk/src/matrix";
import { randomString } from "matrix-js-sdk/src/randomstring";
import { IdTokenClaims } from "oidc-client-ts";

/**
 * Start OIDC authorization code flow
 * Generates auth params, stores them in session storage and
 * Navigates to configured authorization endpoint
 * @param delegatedAuthConfig from discovery
 * @param clientId this client's id as registered with configured issuer
 * @param homeserverUrl target homeserver
 * @param identityServerUrl OPTIONAL target identity server
 * @returns Promise that resolves after we have navigated to auth endpoint
 */
export const startOidcLogin = async (
    delegatedAuthConfig: OidcClientConfig,
    clientId: string,
    homeserverUrl: string,
    identityServerUrl?: string,
    isRegistration?: boolean,
): Promise<void> => {
    const redirectUri = window.location.origin;

    const nonce = randomString(10);

    const prompt = isRegistration ? "create" : undefined;

    const authorizationUrl = await generateOidcAuthorizationUrl({
        metadata: delegatedAuthConfig.metadata,
        redirectUri,
        clientId,
        homeserverUrl,
        identityServerUrl,
        nonce,
        prompt,
    });

    window.location.href = authorizationUrl;
};

/**
 * Gets `code` and `state` query params
 *
 * @param queryParams
 * @returns code and state
 * @throws when code and state are not valid strings
 */
const getCodeAndStateFromQueryParams = (queryParams: QueryDict): { code: string; state: string } => {
    const code = queryParams["code"];
    const state = queryParams["state"];

    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
        throw new Error("Invalid query parameters for OIDC native login. `code` and `state` are required.");
    }
    return { code, state };
};

type CompleteOidcLoginResponse = {
    // url of the homeserver selected during login
    homeserverUrl: string;
    // identity server url as discovered during login
    identityServerUrl?: string;
    // accessToken gained from OIDC token issuer
    accessToken: string;
    // refreshToken gained from OIDC token issuer, when falsy token cannot be refreshed
    refreshToken?: string;
    // this client's id as registered with the OIDC issuer
    clientId: string;
    // issuer used during authentication
    issuer: string;
    // claims of the given access token; used during token refresh to validate new tokens
    idTokenClaims: IdTokenClaims;
};
/**
 * Attempt to complete authorization code flow to get an access token
 * @param queryParams the query-parameters extracted from the real query-string of the starting URI.
 * @returns Promise that resolves with a CompleteOidcLoginResponse when login was successful
 * @throws When we failed to get a valid access token
 */
export const completeOidcLogin = async (queryParams: QueryDict): Promise<CompleteOidcLoginResponse> => {
    const { code, state } = getCodeAndStateFromQueryParams(queryParams);
    const { homeserverUrl, tokenResponse, idTokenClaims, identityServerUrl, oidcClientSettings } =
        await completeAuthorizationCodeGrant(code, state);

    return {
        homeserverUrl,
        identityServerUrl,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        clientId: oidcClientSettings.clientId,
        issuer: oidcClientSettings.issuer,
        idTokenClaims,
    };
};
