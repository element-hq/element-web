/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { OAuth2, type ValidatedAuthMetadata } from "matrix-js-sdk/src/matrix";

import { type IConfigOptions } from "../../IConfigOptions";
import PlatformPeg from "../../PlatformPeg";

/**
 * Get the statically configured clientId for the issuer
 * @param issuer delegated auth OAuth2 issuer
 * @param staticOAuthClients static client config from config.json
 * @returns clientId if found, otherwise undefined
 */
const getStaticOAuthClientId = (
    issuer: string,
    staticOAuthClients?: IConfigOptions["oidc_static_clients"],
): string | undefined => {
    // static_oidc_clients are configured with a trailing slash
    const issuerWithTrailingSlash = issuer.endsWith("/") ? issuer : issuer + "/";
    return staticOAuthClients?.[issuerWithTrailingSlash]?.client_id;
};

/**
 * Get the clientId for an OAuth2 OP
 * Checks statically configured clientIds first
 * Then attempts dynamic registration with the OP
 * @param delegatedAuthConfig Auth config from ValidatedServerConfig
 * @param staticOAuthClients static client config from config.json
 * @returns Promise<string> resolves with clientId
 * @throws if no clientId is found
 */
export const getOAuthClientId = async (
    delegatedAuthConfig: ValidatedAuthMetadata,
    staticOAuthClients?: IConfigOptions["oidc_static_clients"],
): Promise<string> => {
    const staticClientId = getStaticOAuthClientId(delegatedAuthConfig.issuer, staticOAuthClients);
    if (staticClientId) {
        logger.debug(`Using static clientId for issuer ${delegatedAuthConfig.issuer}`);
        return staticClientId;
    }
    return await OAuth2.registerClient(delegatedAuthConfig, await PlatformPeg.get()!.getOAuthClientMetadata());
};
