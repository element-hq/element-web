/*
Copyright 2016 OpenMarket Ltd
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

import url from 'url';
import SettingsStore from "./settings/SettingsStore";
import { Service, startTermsFlow, TermsNotSignedError } from './Terms';
import {MatrixClientPeg} from "./MatrixClientPeg";
import request from "browser-request";

import * as Matrix from 'matrix-js-sdk';
import SdkConfig from "./SdkConfig";
import {WidgetType} from "./widgets/WidgetType";

// The version of the integration manager API we're intending to work with
const imApiVersion = "1.1";

// TODO: Generify the name of this class and all components within - it's not just for Scalar.

export default class ScalarAuthClient {
    constructor(apiUrl, uiUrl) {
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;
        this.scalarToken = null;
        // `undefined` to allow `startTermsFlow` to fallback to a default
        // callback if this is unset.
        this.termsInteractionCallback = undefined;

        // We try and store the token on a per-manager basis, but need a fallback
        // for the default manager.
        const configApiUrl = SdkConfig.get()['integrations_rest_url'];
        const configUiUrl = SdkConfig.get()['integrations_ui_url'];
        this.isDefaultManager = apiUrl === configApiUrl && configUiUrl === uiUrl;
    }

    _writeTokenToStore() {
        window.localStorage.setItem("mx_scalar_token_at_" + this.apiUrl, this.scalarToken);
        if (this.isDefaultManager) {
            // We remove the old token from storage to migrate upwards. This is safe
            // to do because even if the user switches to /app when this is on /develop
            // they'll at worst register for a new token.
            window.localStorage.removeItem("mx_scalar_token"); // no-op when not present
        }
    }

    _readTokenFromStore() {
        let token = window.localStorage.getItem("mx_scalar_token_at_" + this.apiUrl);
        if (!token && this.isDefaultManager) {
            token = window.localStorage.getItem("mx_scalar_token");
        }
        return token;
    }

    _readToken() {
        if (this.scalarToken) return this.scalarToken;
        return this._readTokenFromStore();
    }

    setTermsInteractionCallback(callback) {
        this.termsInteractionCallback = callback;
    }

    connect() {
        return this.getScalarToken().then((tok) => {
            this.scalarToken = tok;
        });
    }

    hasCredentials() {
        return this.scalarToken != null; // undef or null
    }

    // Returns a promise that resolves to a scalar_token string
    getScalarToken() {
        const token = this._readToken();

        if (!token) {
            return this.registerForToken();
        } else {
            return this._checkToken(token).catch((e) => {
                if (e instanceof TermsNotSignedError) {
                    // retrying won't help this
                    throw e;
                }
                return this.registerForToken();
            });
        }
    }

    _getAccountName(token) {
        const url = this.apiUrl + "/account";

        return new Promise(function(resolve, reject) {
            request({
                method: "GET",
                uri: url,
                qs: {scalar_token: token, v: imApiVersion},
                json: true,
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (body && body.errcode === 'M_TERMS_NOT_SIGNED') {
                    reject(new TermsNotSignedError());
                } else if (response.statusCode / 100 !== 2) {
                    reject(body);
                } else if (!body || !body.user_id) {
                    reject(new Error("Missing user_id in response"));
                } else {
                    resolve(body.user_id);
                }
            });
        });
    }

    _checkToken(token) {
        return this._getAccountName(token).then(userId => {
            const me = MatrixClientPeg.get().getUserId();
            if (userId !== me) {
                throw new Error("Scalar token is owned by someone else: " + me);
            }
            return token;
        }).catch((e) => {
            if (e instanceof TermsNotSignedError) {
                console.log("Integration manager requires new terms to be agreed to");
                // The terms endpoints are new and so live on standard _matrix prefixes,
                // but IM rest urls are currently configured with paths, so remove the
                // path from the base URL before passing it to the js-sdk

                // We continue to use the full URL for the calls done by
                // matrix-react-sdk, but the standard terms API called
                // by the js-sdk lives on the standard _matrix path. This means we
                // don't support running IMs on a non-root path, but it's the only
                // realistic way of transitioning to _matrix paths since configs in
                // the wild contain bits of the API path.

                // Once we've fully transitioned to _matrix URLs, we can give people
                // a grace period to update their configs, then use the rest url as
                // a regular base url.
                const parsedImRestUrl = url.parse(this.apiUrl);
                parsedImRestUrl.path = '';
                parsedImRestUrl.pathname = '';
                return startTermsFlow([new Service(
                    Matrix.SERVICE_TYPES.IM,
                    parsedImRestUrl.format(),
                    token,
                )], this.termsInteractionCallback).then(() => {
                    return token;
                });
            } else {
                throw e;
            }
        });
    }

    registerForToken() {
        // Get openid bearer token from the HS as the first part of our dance
        return MatrixClientPeg.get().getOpenIdToken().then((tokenObject) => {
            // Now we can send that to scalar and exchange it for a scalar token
            return this.exchangeForScalarToken(tokenObject);
        }).then((token) => {
            // Validate it (this mostly checks to see if the IM needs us to agree to some terms)
            return this._checkToken(token);
        }).then((token) => {
            this.scalarToken = token;
            this._writeTokenToStore();
            return token;
        });
    }

    exchangeForScalarToken(openidTokenObject) {
        const scalarRestUrl = this.apiUrl;

        return new Promise(function(resolve, reject) {
            request({
                method: 'POST',
                uri: scalarRestUrl + '/register',
                qs: {v: imApiVersion},
                body: openidTokenObject,
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
        let scalarPageLookupUrl = this.apiUrl + '/widgets/title_lookup';
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
     * @param  {WidgetType} widgetType The Widget Type to disable assets for
     * @param  {string} widgetId   The widget ID to disable assets for
     * @return {Promise}           Resolves on completion
     */
    disableWidgetAssets(widgetType: WidgetType, widgetId) {
        let url = this.apiUrl + '/widgets/set_assets_state';
        url = this.getStarterLink(url);
        return new Promise((resolve, reject) => {
            request({
                method: 'GET', // XXX: Actions shouldn't be GET requests
                uri: url,
                json: true,
                qs: {
                    'widget_type': widgetType.preferred,
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
        let url = this.uiUrl;
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
