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

import {
    AuthorizationParams,
    generateAuthorizationParams,
    generateAuthorizationUrl,
} from "matrix-js-sdk/src/oidc/authorize";

import { ValidatedDelegatedAuthConfig } from "../ValidatedServerConfig";

/**
 * Store authorization params for retrieval when returning from OIDC OP
 * @param authorizationParams from `generateAuthorizationParams`
 * @param delegatedAuthConfig used for future interactions with OP
 * @param clientId this client's id as registered with configured issuer
 * @param homeserver target homeserver
 */
const storeAuthorizationParams = (
    { redirectUri, state, nonce, codeVerifier }: AuthorizationParams,
    { issuer }: ValidatedDelegatedAuthConfig,
    clientId: string,
    homeserver: string,
): void => {
    window.sessionStorage.setItem(`oidc_${state}_nonce`, nonce);
    window.sessionStorage.setItem(`oidc_${state}_redirectUri`, redirectUri);
    window.sessionStorage.setItem(`oidc_${state}_codeVerifier`, codeVerifier);
    window.sessionStorage.setItem(`oidc_${state}_clientId`, clientId);
    window.sessionStorage.setItem(`oidc_${state}_issuer`, issuer);
    window.sessionStorage.setItem(`oidc_${state}_homeserver`, homeserver);
};

/**
 * Start OIDC authorization code flow
 * Generates auth params, stores them in session storage and
 * Navigates to configured authorization endpoint
 * @param delegatedAuthConfig from discovery
 * @param clientId this client's id as registered with configured issuer
 * @param homeserver target homeserver
 * @returns Promise that resolves after we have navigated to auth endpoint
 */
export const startOidcLogin = async (
    delegatedAuthConfig: ValidatedDelegatedAuthConfig,
    clientId: string,
    homeserver: string,
): Promise<void> => {
    // TODO(kerrya) afterloginfragment https://github.com/vector-im/element-web/issues/25656
    const redirectUri = window.location.origin;
    const authParams = generateAuthorizationParams({ redirectUri });

    storeAuthorizationParams(authParams, delegatedAuthConfig, clientId, homeserver);

    const authorizationUrl = await generateAuthorizationUrl(
        delegatedAuthConfig.authorizationEndpoint,
        clientId,
        authParams,
    );

    window.location.href = authorizationUrl;
};
