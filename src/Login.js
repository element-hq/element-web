/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import Matrix from "matrix-js-sdk";

import url from 'url';

export default class Login {
    constructor(hsUrl, isUrl, fallbackHsUrl, opts) {
        this._hsUrl = hsUrl;
        this._isUrl = isUrl;
        this._fallbackHsUrl = fallbackHsUrl;
        this._currentFlowIndex = 0;
        this._flows = [];
        this._defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
    }

    getHomeserverUrl() {
        return this._hsUrl;
    }

    getIdentityServerUrl() {
        return this._isUrl;
    }

    setHomeserverUrl(hsUrl) {
        this._hsUrl = hsUrl;
    }

    setIdentityServerUrl(isUrl) {
        this._isUrl = isUrl;
    }

    /**
     * Get a temporary MatrixClient, which can be used for login or register
     * requests.
     * @returns {MatrixClient}
     */
    _createTemporaryClient() {
        return Matrix.createClient({
            baseUrl: this._hsUrl,
            idBaseUrl: this._isUrl,
        });
    }

    getFlows() {
        const self = this;
        const client = this._createTemporaryClient();
        return client.loginFlows().then(function(result) {
            self._flows = result.flows;
            self._currentFlowIndex = 0;
            // technically the UI should display options for all flows for the
            // user to then choose one, so return all the flows here.
            return self._flows;
        });
    }

    chooseFlow(flowIndex) {
        this._currentFlowIndex = flowIndex;
    }

    getCurrentFlowStep() {
        // technically the flow can have multiple steps, but no one does this
        // for login so we can ignore it.
        const flowStep = this._flows[this._currentFlowIndex];
        return flowStep ? flowStep.type : null;
    }

    loginViaPassword(username, phoneCountry, phoneNumber, pass) {
        const self = this;

        const isEmail = username.indexOf("@") > 0;

        let identifier;
        if (phoneCountry && phoneNumber) {
            identifier = {
                type: 'm.id.phone',
                country: phoneCountry,
                number: phoneNumber,
            };
        } else if (isEmail) {
            identifier = {
                type: 'm.id.thirdparty',
                medium: 'email',
                address: username,
            };
        } else {
            identifier = {
                type: 'm.id.user',
                user: username,
            };
        }

        const loginParams = {
            password: pass,
            identifier: identifier,
            initial_device_display_name: this._defaultDeviceDisplayName,
        };

        const tryFallbackHs = (originalError) => {
            return sendLoginRequest(
                self._fallbackHsUrl, this._isUrl, 'm.login.password', loginParams,
            ).catch((fallbackError) => {
                console.log("fallback HS login failed", fallbackError);
                // throw the original error
                throw originalError;
            });
        };

        let originalLoginError = null;
        return sendLoginRequest(
            self._hsUrl, self._isUrl, 'm.login.password', loginParams,
        ).catch((error) => {
            originalLoginError = error;
            if (error.httpStatus === 403) {
                if (self._fallbackHsUrl) {
                    return tryFallbackHs(originalLoginError);
                }
            }
            throw originalLoginError;
        }).catch((error) => {
            console.log("Login failed", error);
            throw error;
        });
    }

    getSsoLoginUrl(loginType) {
      const client = this._createTemporaryClient();
      const parsedUrl = url.parse(window.location.href, true);

      // XXX: at this point, the fragment will always be #/login, which is no
      // use to anyone. Ideally, we would get the intended fragment from
      // MatrixChat.screenAfterLogin so that you could follow #/room links etc
      // through an SSO login.
      parsedUrl.hash = "";

      parsedUrl.query["homeserver"] = client.getHomeserverUrl();
      parsedUrl.query["identityServer"] = client.getIdentityServerUrl();
      return client.getSsoLoginUrl(url.format(parsedUrl), loginType);
    }
}


/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} hsUrl   the base url of the Homeserver used to log in.
 * @param {string} isUrl   the base url of the default identity server
 * @param {string} loginType the type of login to do
 * @param {object} loginParams the parameters for the login
 *
 * @returns {MatrixClientCreds}
 */
export async function sendLoginRequest(hsUrl, isUrl, loginType, loginParams) {
    const client = Matrix.createClient({
        baseUrl: hsUrl,
        idBaseUrl: isUrl,
    });

    const data = await client.login(loginType, loginParams);

    const wellknown = data.well_known;
    if (wellknown) {
        if (wellknown["m.homeserver"] && wellknown["m.homeserver"]["base_url"]) {
            hsUrl = wellknown["m.homeserver"]["base_url"];
            console.log(`Overrode homeserver setting with ${hsUrl} from login response`);
        }
        if (wellknown["m.identity_server"] && wellknown["m.identity_server"]["base_url"]) {
            // TODO: should we prompt here?
            isUrl = wellknown["m.identity_server"]["base_url"];
            console.log(`Overrode IS setting with ${isUrl} from login response`);
        }
    }

    return {
        homeserverUrl: hsUrl,
        identityServerUrl: isUrl,
        userId: data.user_id,
        deviceId: data.device_id,
        accessToken: data.access_token,
    };
}
