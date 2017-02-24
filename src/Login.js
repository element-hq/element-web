/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import q from 'q';
import url from 'url';

export default class Login {
    constructor(hsUrl, isUrl, fallbackHsUrl, opts) {
        this._hsUrl = hsUrl;
        this._isUrl = isUrl;
        this._fallbackHsUrl = fallbackHsUrl;
        this._currentFlowIndex = 0;
        this._flows = [];
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
     */
    _createTemporaryClient() {
        return Matrix.createClient({
            baseUrl: this._hsUrl,
            idBaseUrl: this._isUrl,
        });
    }

    getFlows() {
        var self = this;
        var client = this._createTemporaryClient();
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
        var flowStep = this._flows[this._currentFlowIndex];
        return flowStep ? flowStep.type : null;
    }

    loginAsGuest() {
        var client = this._createTemporaryClient();
        return client.registerGuest({
            body: {
                initial_device_display_name: this._defaultDeviceDisplayName,
            },
        }).then((creds) => {
            return {
                userId: creds.user_id,
                deviceId: creds.device_id,
                accessToken: creds.access_token,
                homeserverUrl: this._hsUrl,
                identityServerUrl: this._isUrl,
                guest: true
            };
        }, (error) => {
            if (error.httpStatus === 403) {
                error.friendlyText = "Guest access is disabled on this Home Server.";
            } else {
                error.friendlyText = "Failed to register as guest: " + error.data;
            }
            throw error;
        });
    }

    loginViaPassword(username, pass) {
        var self = this;
        var isEmail = username.indexOf("@") > 0;
        var loginParams = {
            password: pass,
            initial_device_display_name: this._defaultDeviceDisplayName,
        };
        if (isEmail) {
            loginParams.medium = 'email';
            loginParams.address = username;
        } else {
            loginParams.user = username;
        }

        var client = this._createTemporaryClient();
        return client.login('m.login.password', loginParams).then(function(data) {
            return q({
                homeserverUrl: self._hsUrl,
                identityServerUrl: self._isUrl,
                userId: data.user_id,
                deviceId: data.device_id,
                accessToken: data.access_token
            });
        }, function(error) {
            if (error.httpStatus == 400 && loginParams.medium) {
                error.friendlyText = (
                    'This Home Server does not support login using email address.'
                );
            }
            else if (error.httpStatus === 403) {
                error.friendlyText = (
                    'Incorrect username and/or password.'
                );
                if (self._fallbackHsUrl) {
                    var fbClient = Matrix.createClient({
                        baseUrl: self._fallbackHsUrl,
                        idBaseUrl: this._isUrl,
                    });

                    return fbClient.login('m.login.password', loginParams).then(function(data) {
                        return q({
                            homeserverUrl: self._fallbackHsUrl,
                            identityServerUrl: self._isUrl,
                            userId: data.user_id,
                            deviceId: data.device_id,
                            accessToken: data.access_token
                        });
                    }, function(fallback_error) {
                        // throw the original error
                        throw error;
                    });
                }
            }
            else {
                error.friendlyText = (
                    'There was a problem logging in. (HTTP ' + error.httpStatus + ")"
                );
            }
            throw error;
        });
    }

    redirectToCas() {
      var client = this._createTemporaryClient();
      var parsedUrl = url.parse(window.location.href, true);
      parsedUrl.query["homeserver"] = client.getHomeserverUrl();
      parsedUrl.query["identityServer"] = client.getIdentityServerUrl();
      var casUrl = client.getCasLoginUrl(url.format(parsedUrl));
      window.location.href = casUrl;
    }
}
