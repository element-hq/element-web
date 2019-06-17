/*
Copyright 2016 OpenMarket Ltd

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

import Promise from 'bluebird';
import SettingsStore from "./settings/SettingsStore";
const request = require('browser-request');

const SdkConfig = require('./SdkConfig');
const MatrixClientPeg = require('./MatrixClientPeg');

// The version of the integration manager API we're intending to work with
const imApiVersion = "1.1";

class ScalarAuthClient {
    constructor() {
        this.scalarToken = null;
    }

    /**
     * Determines if setting up a ScalarAuthClient is even possible
     * @returns {boolean} true if possible, false otherwise.
     */
    static isPossible() {
        return SdkConfig.get()['integrations_rest_url'] && SdkConfig.get()['integrations_ui_url'];
    }

    connect() {
        return this.getScalarToken().then((tok) => {
            this.scalarToken = tok;
        });
    }

    hasCredentials() {
        return this.scalarToken != null; // undef or null
    }

    // Returns a scalar_token string
    getScalarToken() {
        let token = this.scalarToken;
        if (!token) token = window.localStorage.getItem("mx_scalar_token");

        if (!token) {
            return this.registerForToken();
        } else {
            return this.validateToken(token).then(userId => {
                const me = MatrixClientPeg.get().getUserId();
                if (userId !== me) {
                    throw new Error("Scalar token is owned by someone else: " + me);
                }
                return token;
            }).catch(err => {
                console.error(err);

                // Something went wrong - try to get a new token.
                console.warn("Registering for new scalar token");
                return this.registerForToken();
            });
        }
    }

    validateToken(token) {
        const url = SdkConfig.get().integrations_rest_url + "/account";

        return new Promise(function(resolve, reject) {
            request({
                method: "GET",
                uri: url,
                qs: {scalar_token: token, v: imApiVersion},
                json: true,
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode / 100 !== 2) {
                    reject({statusCode: response.statusCode});
                } else if (!body || !body.user_id) {
                    reject(new Error("Missing user_id in response"));
                } else {
                    resolve(body.user_id);
                }
            });
        });
    }

    registerForToken() {
        // Get openid bearer token from the HS as the first part of our dance
        return MatrixClientPeg.get().getOpenIdToken().then((token_object) => {
            // Now we can send that to scalar and exchange it for a scalar token
            return this.exchangeForScalarToken(token_object);
        }).then((token_object) => {
            window.localStorage.setItem("mx_scalar_token", token_object);
            return token_object;
        });
    }

    exchangeForScalarToken(openid_token_object) {
        const scalar_rest_url = SdkConfig.get().integrations_rest_url;

        return new Promise(function(resolve, reject) {
            request({
                method: 'POST',
                uri: scalar_rest_url+'/register',
                qs: {v: imApiVersion},
                body: openid_token_object,
                json: true,
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode / 100 !== 2) {
                    reject({statusCode: response.statusCode});
                } else if (!body || !body.scalar_token) {
                    reject(new Error("Missing scalar_token in response"));
                } else {
                    resolve(body.scalar_token);
                }
            });
        });
    }

    getScalarPageTitle(url) {
        let scalarPageLookupUrl = SdkConfig.get().integrations_rest_url + '/widgets/title_lookup';
        scalarPageLookupUrl = this.getStarterLink(scalarPageLookupUrl);
        scalarPageLookupUrl += '&curl=' + encodeURIComponent(url);

        return new Promise(function(resolve, reject) {
            request({
                method: 'GET',
                uri: scalarPageLookupUrl,
                json: true,
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode / 100 !== 2) {
                    reject({statusCode: response.statusCode});
                } else if (!body) {
                    reject(new Error("Missing page title in response"));
                } else {
                    let title = "";
                    if (body.page_title_cache_item && body.page_title_cache_item.cached_title) {
                        title = body.page_title_cache_item.cached_title;
                    }
                    resolve(title);
                }
            });
        });
    }

    /**
     * Mark all assets associated with the specified widget as "disabled" in the
     * integration manager database.
     * This can be useful to temporarily prevent purchased assets from being displayed.
     * @param  {string} widgetType [description]
     * @param  {string} widgetId   [description]
     * @return {Promise}           Resolves on completion
     */
    disableWidgetAssets(widgetType, widgetId) {
        let url = SdkConfig.get().integrations_rest_url + '/widgets/set_assets_state';
        url = this.getStarterLink(url);
        return new Promise((resolve, reject) => {
            request({
                method: 'GET',
                uri: url,
                json: true,
                qs: {
                    'widget_type': widgetType,
                    'widget_id': widgetId,
                    'state': 'disable',
                },
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode / 100 !== 2) {
                    reject({statusCode: response.statusCode});
                } else if (!body) {
                    reject(new Error("Failed to set widget assets state"));
                } else {
                    resolve();
                }
            });
        });
    }

    getScalarInterfaceUrlForRoom(room, screen, id) {
        const roomId = room.roomId;
        const roomName = room.name;
        let url = SdkConfig.get().integrations_ui_url;
        url += "?scalar_token=" + encodeURIComponent(this.scalarToken);
        url += "&room_id=" + encodeURIComponent(roomId);
        url += "&room_name=" + encodeURIComponent(roomName);
        url += "&theme=" + encodeURIComponent(SettingsStore.getValue("theme"));
        if (id) {
            url += '&integ_id=' + encodeURIComponent(id);
        }
        if (screen) {
            url += '&screen=' + encodeURIComponent(screen);
        }
        return url;
    }

    getStarterLink(starterLinkUrl) {
        return starterLinkUrl + "?scalar_token=" + encodeURIComponent(this.scalarToken);
    }
}

module.exports = ScalarAuthClient;
