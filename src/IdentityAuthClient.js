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

import MatrixClientPeg from './MatrixClientPeg';

export default class IdentityAuthClient {
    constructor() {
        this.accessToken = null;
        this.authEnabled = true;
    }

    hasCredentials() {
        return this.accessToken != null; // undef or null
    }

    // Returns a promise that resolves to the access_token string from the IS
    async getAccessToken() {
        if (!this.authEnabled) {
            // The current IS doesn't support authentication
            return null;
        }

        let token = this.accessToken;
        if (!token) {
            token = window.localStorage.getItem("mx_is_access_token");
        }

        if (!token) {
            token = await this.registerForToken();
            this.accessToken = token;
            window.localStorage.setItem("mx_is_access_token", token);
        }

        try {
            await this._checkToken(token);
        } catch (e) {
            // Retry in case token expired
            token = await this.registerForToken();
            this.accessToken = token;
            window.localStorage.setItem("mx_is_access_token", token);
        }

        return token;
    }

    _checkToken(token) {
        // TODO: Test current API token via /account endpoint
    }

    async registerForToken() {
        try {
            const hsOpenIdToken = await MatrixClientPeg.get().getOpenIdToken();
            const { access_token: isAccessToken } =
                await MatrixClientPeg.get().registerWithIdentityServer(hsOpenIdToken);
            await this._checkToken(isAccessToken);
            return isAccessToken;
        } catch (err) {
            if (err.cors === "rejected" || err.httpStatus === 404) {
                // Assume IS only supports deprecated v1 API for now
                // TODO: Remove this path once v2 is only supported version
                console.warn("IS doesn't support v2 auth");
                this.authEnabled = false;
            }
        }
    }
}
