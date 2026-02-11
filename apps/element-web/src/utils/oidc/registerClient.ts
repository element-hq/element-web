/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { registerOidcClient, type OidcClientConfig } from "matrix-js-sdk/src/matrix";

import { type IConfigOptions } from "../../IConfigOptions";
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
    const staticClientId = getStaticOidcClientId(delegatedAuthConfig.issuer, staticOidcClients);
    if (staticClientId) {
        logger.debug(`Using static clientId for issuer ${delegatedAuthConfig.issuer}`);
        return staticClientId;
    }
    return await registerOidcClient(delegatedAuthConfig, await PlatformPeg.get()!.getOidcClientMetadata());
};
