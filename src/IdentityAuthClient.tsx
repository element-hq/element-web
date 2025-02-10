/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { SERVICE_TYPES, createClient, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "./MatrixClientPeg";
import Modal from "./Modal";
import { _t } from "./languageHandler";
import { Service, startTermsFlow, TermsNotSignedError } from "./Terms";
import {
    doesAccountDataHaveIdentityServer,
    doesIdentityServerHaveTerms,
    setToDefaultIdentityServer,
} from "./utils/IdentityServerUtils";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import { abbreviateUrl } from "./utils/UrlUtils";

export class AbortedIdentityActionError extends Error {}

export default class IdentityAuthClient {
    private accessToken: string | null = null;
    private tempClient?: MatrixClient;
    private authEnabled = true;

    /**
     * Creates a new identity auth client
     * @param {string} identityUrl The URL to contact the identity server with.
     * When provided, this class will operate solely within memory, refusing to
     * persist any information such as tokens. Default null (not provided).
     */
    public constructor(identityUrl?: string) {
        if (identityUrl) {
            // XXX: We shouldn't have to create a whole new MatrixClient just to
            // do identity server auth. The functions don't take an identity URL
            // though, and making all of them take one could lead to developer
            // confusion about what the idBaseUrl does on a client. Therefore, we
            // just make a new client and live with it.
            this.tempClient = createClient({
                baseUrl: "", // invalid by design
                idBaseUrl: identityUrl,
            });
        }
    }

    // This client must not be used for general operations as it may not have a baseUrl or be running (tempClient).
    private get identityClient(): MatrixClient {
        return this.tempClient ?? this.matrixClient;
    }

    private get matrixClient(): MatrixClient {
        return MatrixClientPeg.safeGet();
    }

    private writeToken(): void {
        if (this.tempClient) return; // temporary client: ignore
        if (this.accessToken) {
            window.localStorage.setItem("mx_is_access_token", this.accessToken);
        } else {
            window.localStorage.removeItem("mx_is_access_token");
        }
    }

    private readToken(): string | null {
        if (this.tempClient) return null; // temporary client: ignore
        return window.localStorage.getItem("mx_is_access_token");
    }

    // Returns a promise that resolves to the access_token string from the IS
    public async getAccessToken({ check = true } = {}): Promise<string | null> {
        if (!this.authEnabled) {
            // The current IS doesn't support authentication
            return null;
        }

        let token: string | null = this.accessToken;
        if (!token) {
            token = this.readToken();
        }

        if (!token) {
            token = await this.registerForToken(check);
            if (token) {
                this.accessToken = token;
                this.writeToken();
            }
            return token;
        }

        if (check) {
            try {
                await this.checkToken(token);
            } catch (e) {
                if (e instanceof TermsNotSignedError || e instanceof AbortedIdentityActionError) {
                    // Retrying won't help this
                    throw e;
                }
                // Retry in case token expired
                token = await this.registerForToken();
                if (token) {
                    this.accessToken = token;
                    this.writeToken();
                }
            }
        }

        return token;
    }

    private async checkToken(token: string): Promise<void> {
        const identityServerUrl = this.identityClient.getIdentityServerUrl()!;

        try {
            await this.identityClient.getIdentityAccount(token);
        } catch (e) {
            if (e instanceof MatrixError && e.errcode === "M_TERMS_NOT_SIGNED") {
                logger.log("Identity server requires new terms to be agreed to");
                await startTermsFlow(this.matrixClient, [new Service(SERVICE_TYPES.IS, identityServerUrl, token)]);
                return;
            }
            throw e;
        }

        if (
            !this.tempClient &&
            !doesAccountDataHaveIdentityServer(this.matrixClient) &&
            !(await doesIdentityServerHaveTerms(this.matrixClient, identityServerUrl))
        ) {
            const { finished } = Modal.createDialog(QuestionDialog, {
                title: _t("terms|identity_server_no_terms_title"),
                description: (
                    <div>
                        <p>
                            {_t(
                                "terms|identity_server_no_terms_description_1",
                                {},
                                {
                                    server: () => <strong>{abbreviateUrl(identityServerUrl)}</strong>,
                                },
                            )}
                        </p>
                        <p>{_t("terms|identity_server_no_terms_description_2")}</p>
                    </div>
                ),
                button: _t("action|trust"),
            });
            const [confirmed] = await finished;
            if (confirmed) {
                setToDefaultIdentityServer(this.matrixClient);
            } else {
                throw new AbortedIdentityActionError("User aborted identity server action without terms");
            }
        }

        // We should ensure the token in `localStorage` is cleared
        // appropriately. We already clear storage on sign out, but we'll need
        // additional clearing when changing ISes in settings as part of future
        // privacy work.
        // See also https://github.com/vector-im/element-web/issues/10455.
    }

    public async registerForToken(check = true): Promise<string> {
        const hsOpenIdToken = await MatrixClientPeg.safeGet().getOpenIdToken();
        // XXX: The spec is `token`, but we used `access_token` for a Sydent release.
        const { access_token: accessToken, token } =
            await this.identityClient.registerWithIdentityServer(hsOpenIdToken);
        const identityAccessToken = token || accessToken;
        if (check) await this.checkToken(identityAccessToken);
        return identityAccessToken;
    }
}
