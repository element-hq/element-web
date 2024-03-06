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

import { logger } from "matrix-js-sdk/src/logger";
import { registerOidcClient, OidcClientConfig } from "matrix-js-sdk/src/matrix";

import { IConfigOptions } from "../../IConfigOptions";
import PlatformPeg from "../../PlatformPeg";

/**
 * Get the statically configured clientId for the issuer
 * @param issuer delegated auth OIDC issuer
 * @param staticOidcClients static client config from config.json
 * @returns clientId if found, otherwise undefined
 */
const getStaticOidcClientId = (
    issuer: string,
    staticOidcClients?: IConfigOptions["oidc_static_clients"],
): string | undefined => {
    // static_oidc_clients are configured with a trailing slash
    const issuerWithTrailingSlash = issuer.endsWith("/") ? issuer : issuer + "/";
    return staticOidcClients?.[issuerWithTrailingSlash]?.client_id;
};

/**
 * Get the clientId for an OIDC OP
 * Checks statically configured clientIds first
 * Then attempts dynamic registration with the OP
 * @param delegatedAuthConfig Auth config from ValidatedServerConfig
 * @param staticOidcClients static client config from config.json
 * @returns Promise<string> resolves with clientId
 * @throws if no clientId is found
 */
export const getOidcClientId = async (
    delegatedAuthConfig: OidcClientConfig,
    staticOidcClients?: IConfigOptions["oidc_static_clients"],
): Promise<string> => {
    const staticClientId = getStaticOidcClientId(delegatedAuthConfig.metadata.issuer, staticOidcClients);
    if (staticClientId) {
        logger.debug(`Using static clientId for issuer ${delegatedAuthConfig.metadata.issuer}`);
        return staticClientId;
    }
    return await registerOidcClient(delegatedAuthConfig, await PlatformPeg.get()!.getOidcClientMetadata());
};
