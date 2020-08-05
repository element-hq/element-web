/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { createClient, SERVICE_TYPES } from 'matrix-js-sdk';

import {MatrixClientPeg} from './MatrixClientPeg';
import Modal from './Modal';
import * as sdk from './index';
import { _t } from './languageHandler';
import { Service, startTermsFlow, TermsNotSignedError } from './Terms';
import {
    doesAccountDataHaveIdentityServer,
    doesIdentityServerHaveTerms,
    useDefaultIdentityServer,
} from './utils/IdentityServerUtils';
import { abbreviateUrl } from './utils/UrlUtils';

export class AbortedIdentityActionError extends Error {}

export default class IdentityAuthClient {
    /**
     * Creates a new identity auth client
     * @param {string} identityUrl The URL to contact the identity server with.
     * When provided, this class will operate solely within memory, refusing to
     * persist any information such as tokens. Default null (not provided).
     */
    constructor(identityUrl = null) {
        this.accessToken = null;
        this.authEnabled = true;

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
        } else {
            // Indicates that we're using the real client, not some workaround.
            this.tempClient = null;
        }
    }

    get _matrixClient() {
        return this.tempClient ? this.tempClient : MatrixClientPeg.get();
    }

    _writeToken() {
        if (this.tempClient) return; // temporary client: ignore
        window.localStorage.setItem("mx_is_access_token", this.accessToken);
    }

    _readToken() {
        if (this.tempClient) return null; // temporary client: ignore
        return window.localStorage.getItem("mx_is_access_token");
    }

    hasCredentials() {
        return this.accessToken != null; // undef or null
    }

    // Returns a promise that resolves to the access_token string from the IS
    async getAccessToken({ check = true } = {}) {
        if (!this.authEnabled) {
            // The current IS doesn't support authentication
            return null;
        }

        let token = this.accessToken;
        if (!token) {
            token = this._readToken();
        }

        if (!token) {
            token = await this.registerForToken(check);
            if (token) {
                this.accessToken = token;
                this._writeToken();
            }
            return token;
        }

        if (check) {
            try {
                await this._checkToken(token);
            } catch (e) {
                if (
                    e instanceof TermsNotSignedError ||
                    e instanceof AbortedIdentityActionError
                ) {
                    // Retrying won't help this
                    throw e;
                }
                // Retry in case token expired
                token = await this.registerForToken();
                if (token) {
                    this.accessToken = token;
                    this._writeToken();
                }
            }
        }

        return token;
    }

    async _checkToken(token) {
        const identityServerUrl = this._matrixClient.getIdentityServerUrl();

        try {
            await this._matrixClient.getIdentityAccount(token);
        } catch (e) {
            if (e.errcode === "M_TERMS_NOT_SIGNED") {
                console.log("Identity Server requires new terms to be agreed to");
                await startTermsFlow([new Service(
                    SERVICE_TYPES.IS,
                    identityServerUrl,
                    token,
                )]);
                return;
            }
            throw e;
        }

        if (
            !this.tempClient &&
            !doesAccountDataHaveIdentityServer() &&
            !await doesIdentityServerHaveTerms(identityServerUrl)
        ) {
            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            const { finished } = Modal.createTrackedDialog('Default identity server terms warning', '',
                QuestionDialog, {
                title: _t("Identity server has no terms of service"),
                description: (
                    <div>
                        <p>{_t(
                            "This action requires accessing the default identity server " +
                            "<server /> to validate an email address or phone number, " +
                            "but the server does not have any terms of service.", {},
                            {
                                server: () => <b>{abbreviateUrl(identityServerUrl)}</b>,
                            },
                        )}</p>
                        <p>{_t(
                            "Only continue if you trust the owner of the server.",
                        )}</p>
                    </div>
                ),
                button: _t("Trust"),
            });
            const [confirmed] = await finished;
            if (confirmed) {
                useDefaultIdentityServer();
            } else {
                throw new AbortedIdentityActionError(
                    "User aborted identity server action without terms",
                );
            }
        }

        // We should ensure the token in `localStorage` is cleared
        // appropriately. We already clear storage on sign out, but we'll need
        // additional clearing when changing ISes in settings as part of future
        // privacy work.
        // See also https://github.com/vector-im/element-web/issues/10455.
    }

    async registerForToken(check=true) {
        const hsOpenIdToken = await MatrixClientPeg.get().getOpenIdToken();
        // XXX: The spec is `token`, but we used `access_token` for a Sydent release.
        const { access_token: accessToken, token } =
            await this._matrixClient.registerWithIdentityServer(hsOpenIdToken);
        const identityAccessToken = token ? token : accessToken;
        if (check) await this._checkToken(identityAccessToken);
        return identityAccessToken;
    }
}
