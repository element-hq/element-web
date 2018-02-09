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
const request = require('browser-request');

const SdkConfig = require('./SdkConfig');
const MatrixClientPeg = require('./MatrixClientPeg');

class ScalarAuthClient {

    constructor() {
        this.scalarToken = null;
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
        const tok = window.localStorage.getItem("mx_scalar_token");
        if (tok) return Promise.resolve(tok);

        // No saved token, so do the dance to get one. First, we
        // need an openid bearer token from the HS.
        return MatrixClientPeg.get().getOpenIdToken().then((token_object) => {
            // Now we can send that to scalar and exchange it for a scalar token
            return this.exchangeForScalarToken(token_object);
        }).then((token_object) => {
            window.localStorage.setItem("mx_scalar_token", token_object);
            return token_object;
        });
    }

    exchangeForScalarToken(openid_token_object) {
        const defer = Promise.defer();

        const scalar_rest_url = SdkConfig.get().integrations_rest_url;
        request({
            method: 'POST',
            uri: scalar_rest_url+'/register',
            body: openid_token_object,
            json: true,
        }, (err, response, body) => {
            if (err) {
                defer.reject(err);
            } else if (response.statusCode / 100 !== 2) {
                defer.reject({statusCode: response.statusCode});
            } else if (!body || !body.scalar_token) {
                defer.reject(new Error("Missing scalar_token in response"));
            } else {
                defer.resolve(body.scalar_token);
            }
        });

        return defer.promise;
    }

    getScalarPageTitle(url) {
        const defer = Promise.defer();

        let scalarPageLookupUrl = SdkConfig.get().integrations_rest_url + '/widgets/title_lookup';
        scalarPageLookupUrl = this.getStarterLink(scalarPageLookupUrl);
        scalarPageLookupUrl += '&curl=' + encodeURIComponent(url);
        request({
            method: 'GET',
            uri: scalarPageLookupUrl,
            json: true,
        }, (err, response, body) => {
            if (err) {
                defer.reject(err);
            } else if (response.statusCode / 100 !== 2) {
                defer.reject({statusCode: response.statusCode});
            } else if (!body) {
                defer.reject(new Error("Missing page title in response"));
            } else {
                let title = "";
                if (body.page_title_cache_item && body.page_title_cache_item.cached_title) {
                    title = body.page_title_cache_item.cached_title;
                }
                defer.resolve(title);
            }
        });

        return defer.promise;
    }

    getScalarInterfaceUrlForRoom(room, screen, id) {
        const roomId = room.roomId;
        const roomName = room.name;
        let url = SdkConfig.get().integrations_ui_url;
        url += "?scalar_token=" + encodeURIComponent(this.scalarToken);
        url += "&room_id=" + encodeURIComponent(roomId);
        url += "&room_name=" + encodeURIComponent(roomName);
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
