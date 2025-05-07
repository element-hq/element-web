/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, discoverAndValidateOIDCIssuerWellKnown } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { OidcClient } from "oidc-client-ts";

import {
    getStoredOidcTokenIssuer,
    getStoredOidcClientId,
    getStoredOidcIdToken,
} from "../../utils/oidc/persistOidcSettings";
import PlatformPeg from "../../PlatformPeg";

/**
 * @experimental
 * Stores information about configured OIDC provider
 *
 * In OIDC Native mode the client is registered with OIDC directly and maintains an OIDC token.
 *
 * In OIDC Aware mode, the client is aware that the Server is using OIDC, but is using the standard Matrix APIs for most things.
 * (Notable exceptions are account management, where a link to the account management endpoint will be provided instead.)
 *
 * Otherwise, the store is not operating. Auth is then in Legacy mode and everything uses normal Matrix APIs.
 */
export class OidcClientStore {
    private oidcClient?: OidcClient;
    private initialisingOidcClientPromise: Promise<void> | undefined;
    private authenticatedIssuer?: string; // set only in OIDC-native mode
    private _accountManagementEndpoint?: string;
    /**
     * Promise which resolves once this store is read to use, which may mean there is no OIDC client if we're in legacy mode,
     * or we just have the account management endpoint if running in OIDC-aware mode.
     */
    public readonly readyPromise: Promise<void>;

    public constructor(private readonly matrixClient: MatrixClient) {
        this.readyPromise = this.init();
    }

    private async init(): Promise<void> {
        this.authenticatedIssuer = getStoredOidcTokenIssuer();
        if (this.authenticatedIssuer) {
            await this.getOidcClient();
        } else {
            // We are not in OIDC Native mode, as we have no locally stored issuer. Check if the server delegates auth to OIDC.
            try {
                const authMetadata = await this.matrixClient.getAuthMetadata();
                this.setAccountManagementEndpoint(authMetadata.account_management_uri, authMetadata.issuer);
            } catch (e) {
                console.log("Auth issuer not found", e);
            }
        }
    }

    /**
     * True when the active user is authenticated via OIDC
     */
    public get isUserAuthenticatedWithOidc(): boolean {
        return !!this.authenticatedIssuer;
    }

    private setAccountManagementEndpoint(endpoint: string | undefined, issuer: string): void {
        // if no account endpoint is configured default to the issuer
        const url = new URL(endpoint ?? issuer);
        const idToken = getStoredOidcIdToken();
        if (idToken) {
            url.searchParams.set("id_token_hint", idToken);
        }
        this._accountManagementEndpoint = url.toString();
    }

    public get accountManagementEndpoint(): string | undefined {
        return this._accountManagementEndpoint;
    }

    /**
     * Revokes provided access and refresh tokens with the configured OIDC provider
     * @param accessToken
     * @param refreshToken
     * @returns Promise that resolves when tokens have been revoked
     * @throws when OidcClient cannot be initialised, or revoking either token fails
     */
    public async revokeTokens(accessToken?: string, refreshToken?: string): Promise<void> {
        const client = await this.getOidcClient();

        if (!client) {
            throw new Error("No OIDC client");
        }

        const results = await Promise.all([
            this.tryRevokeToken(client, accessToken, "access_token"),
            this.tryRevokeToken(client, refreshToken, "refresh_token"),
        ]);

        if (results.some((success) => !success)) {
            throw new Error("Failed to revoke tokens");
        }
    }

    /**
     * Try to revoke a given token
     * @param oidcClient
     * @param token
     * @param tokenType passed to revocation endpoint as token type hint
     * @returns Promise that resolved with boolean whether the token revocation succeeded or not
     */
    private async tryRevokeToken(
        oidcClient: OidcClient,
        token: string | undefined,
        tokenType: "access_token" | "refresh_token",
    ): Promise<boolean> {
        try {
            if (!token) {
                return false;
            }
            await oidcClient.revokeToken(token, tokenType);
            return true;
        } catch (error) {
            logger.error(`Failed to revoke ${tokenType}`, error);
            return false;
        }
    }

    private async getOidcClient(): Promise<OidcClient | undefined> {
        if (!this.oidcClient && !this.initialisingOidcClientPromise) {
            this.initialisingOidcClientPromise = this.initOidcClient();
        }
        await this.initialisingOidcClientPromise;
        this.initialisingOidcClientPromise = undefined;
        return this.oidcClient;
    }

    /**
     * Tries to initialise an OidcClient using stored clientId and OIDC discovery.
     * Assigns this.oidcClient and accountManagement endpoint.
     * Logs errors and does not throw when oidc client cannot be initialised.
     * @returns promise that resolves when initialising OidcClient succeeds or fails
     */
    private async initOidcClient(): Promise<void> {
        if (!this.authenticatedIssuer) {
            logger.error("Cannot initialise OIDC client without issuer.");
            return;
        }

        try {
            const clientId = getStoredOidcClientId();
            const authMetadata = await discoverAndValidateOIDCIssuerWellKnown(this.authenticatedIssuer);
            this.setAccountManagementEndpoint(authMetadata.account_management_uri, authMetadata.issuer);
            this.oidcClient = new OidcClient({
                authority: authMetadata.issuer,
                signingKeys: authMetadata.signingKeys ?? undefined,
                redirect_uri: PlatformPeg.get()!.getOidcCallbackUrl().href,
                client_id: clientId,
            });
        } catch (error) {
            logger.error("Failed to initialise OidcClientStore", error);
        }
    }
}
