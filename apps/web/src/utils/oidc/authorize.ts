/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { completeAuthorizationCodeGrant, generateOidcAuthorizationUrl } from "matrix-js-sdk/src/oidc/authorize";
import { type OidcClientConfig } from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { type IdTokenClaims } from "oidc-client-ts";

import { OidcClientError } from "./error";
import PlatformPeg from "../../PlatformPeg";
import { type URLParams } from "../../vector/url_utils.ts";

/**
 * Start OIDC authorization code flow
 * Generates auth params, stores them in session storage and
 * Navigates to configured authorization endpoint
 * @param delegatedAuthConfig from discovery
 * @param clientId this client's id as registered with configured issuer
 * @param homeserverUrl target homeserver
 * @param identityServerUrl OPTIONAL target identity server
 * @param isRegistration if true will set the prompt to "create"
 * @returns Promise that resolves after we have navigated to auth endpoint
 */
export const startOidcLogin = async (
    delegatedAuthConfig: OidcClientConfig,
    clientId: string,
    homeserverUrl: string,
    identityServerUrl?: string,
    isRegistration?: boolean,
): Promise<void> => {
    const redirectUri = PlatformPeg.get()!.getOidcCallbackUrl().href;

    const nonce = secureRandomString(10);

    const prompt = isRegistration ? "create" : undefined;

    const authorizationUrl = await generateOidcAuthorizationUrl({
        metadata: delegatedAuthConfig,
        redirectUri,
        clientId,
        homeserverUrl,
        identityServerUrl,
        nonce,
        prompt,
        urlState: PlatformPeg.get()?.getOidcClientState(),
        responseMode: delegatedAuthConfig.response_modes_supported?.includes("fragment") ? "fragment" : "query",
    });

    window.location.href = authorizationUrl;
};

/**
 * Gets `code` and `state` response params
 *
 * @param urlParams - the parameters to read
 * @param responseMode - the response_mode used in the auth request
 * @returns code and state
 * @throws when code and state are not valid strings
 */
const getCodeAndStateFromParams = (
    { code, state }: NonNullable<URLParams["oidc_fragment"]>,
    responseMode: "fragment" | "query",
): { code: string; state: string } => {
    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
        if (responseMode === "fragment") {
            throw new Error(OidcClientError.InvalidFragmentParameters);
        } else {
            throw new Error(OidcClientError.InvalidQueryParameters);
        }
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
    // idToken gained from OIDC token issuer
    idToken: string;
    // this client's id as registered with the OIDC issuer
    clientId: string;
    // issuer used during authentication
    issuer: string;
    // claims of the given access token; used during token refresh to validate new tokens
    idTokenClaims: IdTokenClaims;
};
/**
 * Attempt to complete authorization code flow to get an access token
 * @param urlParams the parameters extracted from the app-load URI.
 * @param responseMode - the response_mode used in the auth request
 * @returns Promise that resolves with a CompleteOidcLoginResponse when login was successful
 * @throws When we failed to get a valid access token
 */
export const completeOidcLogin = async (
    urlParams: NonNullable<URLParams["oidc_fragment"]>,
    responseMode: "fragment" | "query",
): Promise<CompleteOidcLoginResponse> => {
    const { code, state } = getCodeAndStateFromParams(urlParams, responseMode);
    const { homeserverUrl, tokenResponse, idTokenClaims, identityServerUrl, oidcClientSettings } =
        await completeAuthorizationCodeGrant(code, state, responseMode);

    return {
        homeserverUrl,
        identityServerUrl,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        clientId: oidcClientSettings.clientId,
        issuer: oidcClientSettings.issuer,
        idTokenClaims,
    };
};
