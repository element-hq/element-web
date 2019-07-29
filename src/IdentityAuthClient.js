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
    }

    hasCredentials() {
        return this.accessToken != null; // undef or null
    }

    // Returns a promise that resolves to the access_token string from the IS
    async getAccessToken() {
        let token = this.accessToken;
        if (!token) {
            token = window.localStorage.getItem("mx_is_access_token");
        }

        if (!token) {
            return this.registerForToken();
        }

        try {
            return await this._checkToken(token);
        } catch (e) {
            return await this.registerForToken();
        }
    }

    _checkToken(token) {
        // TODO: Test current API token via /account endpoint
        return token;
    }

    async registerForToken() {
        const hsOpenIdToken = await MatrixClientPeg.get().getOpenIdToken();
        const { access_token: isAccessToken } =
            await MatrixClientPeg.get().registerWithIdentityServer(hsOpenIdToken);
        await this._checkToken(isAccessToken);
        this.accessToken = isAccessToken;
        window.localStorage.setItem("mx_is_access_token", isAccessToken);
        return isAccessToken;
    }
}
