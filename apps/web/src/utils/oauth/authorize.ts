/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { OAuth2, OAuth2Error, type ValidatedAuthMetadata } from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { OAuthClientError } from "./error";
import PlatformPeg from "../../PlatformPeg";
import { type URLParams } from "../../vector/url_utils.ts";
import { getOAuthParams, loadAuthContext, storeAuthContext } from "./persistOAuthSettings.ts";

const RESPONSE_MODE = "fragment";

/**
 * Start OAuth2 authorization code flow
 * Generates auth params, stores them in session storage and
 * Navigates to configured authorization endpoint
 * @param authMetadata from {@link MatrixClient.getAuthMetdata}
 * @param clientId this client's id as registered with configured issuer
 * @param homeserverUrl target homeserver
 * @param identityServerUrl OPTIONAL target identity server
 * @param isRegistration if true will set the prompt to "create"
 * @returns Promise that resolves after we have navigated to auth endpoint
 */
export const startOAuthLogin = async (
    authMetadata: ValidatedAuthMetadata,
    clientId: string,
    homeserverUrl: string,
    identityServerUrl?: string,
    isRegistration?: boolean,
): Promise<void> => {
    const platform = PlatformPeg.get()!;
    const state = secureRandomString(32) + platform.getOAuthClientState();

    const auth = new OAuth2(authMetadata, getOAuthParams(clientId));
    storeAuthContext({
        authContext: auth.context,
        metadata: authMetadata,
        homeserverUrl,
        identityServerUrl,
        state,
    });

    const authorizationUrl = await auth.generateAuthorizationCodeGrantUrl(
        state,
        RESPONSE_MODE,
        isRegistration ? "create" : undefined,
    );

    window.location.href = authorizationUrl;
};

/**
 * Gets `code` and `state` response params
 *
 * @param urlParams - the parameters to read
 * @returns code and state
 * @throws when code and state are not valid strings
 */
const getCodeAndStateFromParams = ({
    code,
    state,
}: NonNullable<URLParams["oauth2"]>): { code: string; state: string } => {
    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
        throw new Error(OAuthClientError.InvalidFragmentParameters);
    }
    return { code, state };
};

/**
 * Return type for {@link completeOAuthLogin}
 * Contains all the credentials gathered from a successful OIDC login
 */
export type CompleteOAuthLoginResponse = {
    /**
     * URL of the homeserver selected during login
     */
    homeserverUrl: string;
    /**
     * Identity server URL as discovered during login
     */
    identityServerUrl?: string;
    /**
     * Access Token gained from OIDC token issuer
     */
    accessToken: string;
    /**
     * Refresh Token gained from OIDC token issuer, when falsy token cannot be refreshed
     */
    refreshToken?: string;
    /**
     * This client's ID as registered with the OIDC issuer
     */
    clientId: string;
};

/**
 * Attempt to complete authorization code flow to get an access token
 * @param urlParams the parameters extracted from the app-load URI.
 * @returns Promise that resolves with a CompleteOAuthLoginResponse when login was successful
 * @throws When we failed to get a valid access token
 */
export const completeOAuthLogin = async (
    urlParams: NonNullable<URLParams["oauth2"]>,
): Promise<CompleteOAuthLoginResponse> => {
    const { code, state } = getCodeAndStateFromParams(urlParams);

    const context = loadAuthContext();
    if (context?.state !== state) {
        throw new Error(OAuth2Error.MissingOrInvalidStoredState);
    }

    const bearerToken = await new OAuth2(context.metadata, context.authContext).completeAuthorizationCodeGrant(code);

    return {
        homeserverUrl: context.homeserverUrl,
        identityServerUrl: context.identityServerUrl,
        accessToken: bearerToken.access_token,
        refreshToken: bearerToken.refresh_token,
        clientId: context.authContext.clientId,
    };
};
