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

import { IDelegatedAuthConfig, MatrixClient, M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";
import { discoverAndValidateAuthenticationConfig } from "matrix-js-sdk/src/oidc/discovery";
import { logger } from "matrix-js-sdk/src/logger";
import { OidcClient } from "oidc-client-ts";

import { getStoredOidcTokenIssuer, getStoredOidcClientId } from "../../utils/oidc/persistOidcSettings";

/**
 * @experimental
 * Stores information about configured OIDC provider
 */
export class OidcClientStore {
    private oidcClient?: OidcClient;
    private initialisingOidcClientPromise: Promise<void> | undefined;
    private authenticatedIssuer?: string;
    private _accountManagementEndpoint?: string;

    public constructor(private readonly matrixClient: MatrixClient) {
        this.authenticatedIssuer = getStoredOidcTokenIssuer();
        // don't bother initialising store when we didnt authenticate via oidc
        if (this.authenticatedIssuer) {
            this.getOidcClient();
        }
    }

    /**
     * True when the active user is authenticated via OIDC
     */
    public get isUserAuthenticatedWithOidc(): boolean {
        return !!this.authenticatedIssuer;
    }

    public get accountManagementEndpoint(): string | undefined {
        return this._accountManagementEndpoint;
    }

    private async getOidcClient(): Promise<OidcClient | undefined> {
        if (!this.oidcClient && !this.initialisingOidcClientPromise) {
            this.initialisingOidcClientPromise = this.initOidcClient();
        }
        await this.initialisingOidcClientPromise;
        this.initialisingOidcClientPromise = undefined;
        return this.oidcClient;
    }

    private async initOidcClient(): Promise<void> {
        const wellKnown = this.matrixClient.getClientWellKnown();
        if (!wellKnown) {
            logger.error("Cannot initialise OidcClientStore: client well known required.");
            return;
        }

        const delegatedAuthConfig = M_AUTHENTICATION.findIn<IDelegatedAuthConfig>(wellKnown) ?? undefined;
        try {
            const clientId = getStoredOidcClientId();
            const { account, metadata, signingKeys } = await discoverAndValidateAuthenticationConfig(
                delegatedAuthConfig,
            );
            // if no account endpoint is configured default to the issuer
            this._accountManagementEndpoint = account ?? metadata.issuer;
            this.oidcClient = new OidcClient({
                ...metadata,
                authority: metadata.issuer,
                signingKeys,
                redirect_uri: window.location.origin,
                client_id: clientId,
            });
        } catch (error) {
            logger.error("Failed to initialise OidcClientStore", error);
        }
    }
}
