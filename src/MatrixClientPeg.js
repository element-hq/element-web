/*
Copyright 2015, 2016 OpenMarket Ltd

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

'use strict';

// A thing that holds your Matrix Client
var Matrix = require("matrix-js-sdk");

var matrixClient = null;

var localStorage = window.localStorage;

function deviceId() {
    var id = Math.floor(Math.random()*16777215).toString(16);
    id = "W" + "000000".substring(id.length) + id;
    if (localStorage) {
        id = localStorage.getItem("mx_device_id") || id;
        localStorage.setItem("mx_device_id", id);
    }
    return id;
}

function createClient(hs_url, is_url, user_id, access_token) {
    var opts = {
        baseUrl: hs_url,
        idBaseUrl: is_url,
        accessToken: access_token,
        userId: user_id
    };

    if (localStorage) {
        opts.sessionStore = new Matrix.WebStorageSessionStore(localStorage);
        opts.deviceId = deviceId();
    }

    matrixClient = Matrix.createClient(opts);
}

if (localStorage) {
    var hs_url = localStorage.getItem("mx_hs_url");
    var is_url = localStorage.getItem("mx_is_url") || 'https://matrix.org';
    var access_token = localStorage.getItem("mx_access_token");
    var user_id = localStorage.getItem("mx_user_id");
    if (access_token && user_id && hs_url) {
        createClient(hs_url, is_url, user_id, access_token);
    }
}

class MatrixClient {
    get() {
        return matrixClient;
    }

    unset() {
        matrixClient = null;
    }

    // FIXME, XXX: this all seems very convoluted :(
    //   
    // if we replace the singleton using URLs we bypass our createClient()
    // global helper function... but if we replace it using
    // an access_token we don't?
    //
    // Why do we have this peg wrapper rather than just MatrixClient.get()?
    // Why do we name MatrixClient as MatrixClientPeg when we export it?
    //
    // -matthew

    replaceUsingUrls(hs_url, is_url) {
        matrixClient = Matrix.createClient({
            baseUrl: hs_url,
            idBaseUrl: is_url
        });
        // XXX: factor this out with the localStorage setting in replaceUsingAccessToken
        if (localStorage) {
            try {
                localStorage.setItem("mx_hs_url", hs_url);
                localStorage.setItem("mx_is_url", is_url);
            } catch (e) {
                console.warn("Error using local storage: can't persist HS/IS URLs!");
            }
        } else {
            console.warn("No local storage available: can't persist HS/IS URLs!");
        }
    }

    replaceUsingAccessToken(hs_url, is_url, user_id, access_token) {
        if (localStorage) {
            try {
                localStorage.clear();
            } catch (e) {
                console.warn("Error using local storage");
            }
        }
        createClient(hs_url, is_url, user_id, access_token);
        if (localStorage) {
            try {
                localStorage.setItem("mx_hs_url", hs_url);
                localStorage.setItem("mx_is_url", is_url);
                localStorage.setItem("mx_user_id", user_id);
                localStorage.setItem("mx_access_token", access_token);
            } catch (e) {
                console.warn("Error using local storage: can't persist session!");
            }
        } else {
            console.warn("No local storage available: can't persist session!");
        }
    }
}

if (!global.mxMatrixClient) {
    global.mxMatrixClient = new MatrixClient();
}
module.exports = global.mxMatrixClient;
