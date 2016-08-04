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

import Matrix from 'matrix-js-sdk';
import utils from 'matrix-js-sdk/lib/utils';

const localStorage = window.localStorage;

function deviceId() {
    // XXX: is Math.random()'s deterministicity a problem here?
    var id = Math.floor(Math.random()*16777215).toString(16);
    id = "W" + "000000".substring(id.length) + id;
    if (localStorage) {
        id = localStorage.getItem("mx_device_id") || id;
        localStorage.setItem("mx_device_id", id);
    }
    return id;
}

interface MatrixClientCreds {
    homeserverUrl: string,
    identityServerUrl: string,
    userId: string,
    accessToken: string,
    guest: boolean,
}

/**
 * Wrapper object for handling the js-sdk Matrix Client object in the react-sdk
 * Handles the creation/initialisation of client objects.
 * This module provides a singleton instance of this class so the 'current'
 * Matrix Client object is available easily.
 */
class MatrixClientPeg {
    constructor() {
        this.matrixClient = null;

        // These are the default options used when when the
        // client is started in 'start'. These can be altered
        // at any time up to after the 'will_start_client'
        // event is finished processing.
        this.opts = {
            initialSyncLimit: 20,
        };
    }

    get(): MatrixClient {
        return this.matrixClient;
    }

    unset() {
        this.matrixClient = null;
    }

    /**
     * Replace this MatrixClientPeg's client with a client instance that has
     * Home Server / Identity Server URLs but no credentials
     */
    replaceUsingUrls(hs_url, is_url) {
        this._replaceClient(hs_url, is_url);
    }

    /**
     * Replace this MatrixClientPeg's client with a client instance that has
     * Home Server / Identity Server URLs and active credentials
     */
    replaceUsingCreds(creds: MatrixClientCreds) {
        this._replaceClient(
            creds.homeserverUrl,
            creds.identityServerUrl,
            creds.userId,
            creds.accessToken,
            creds.guest,
        );
    }

    start() {
        const opts = utils.deepCopy(this.opts);
        // the react sdk doesn't work without this, so don't allow
        opts.pendingEventOrdering = "detached";
        this.get().startClient(opts);
    }

    _replaceClient(hs_url, is_url, user_id, access_token, isGuest) {
        if (localStorage) {
            try {
                localStorage.clear();
            } catch (e) {
                console.warn("Error clearing local storage", e);
            }
        }
        this._createClient(hs_url, is_url, user_id, access_token, isGuest);

        if (localStorage) {
            try {
                localStorage.setItem("mx_hs_url", hs_url);
                localStorage.setItem("mx_is_url", is_url);

                if (user_id !== undefined && access_token !== undefined) {
                    localStorage.setItem("mx_user_id", user_id);
                    localStorage.setItem("mx_access_token", access_token);
                    localStorage.setItem("mx_is_guest", JSON.stringify(isGuest));
                    console.log("Session persisted for %s", user_id);
                }
            } catch (e) {
                console.warn("Error using local storage: can't persist session!", e);
            }
        } else {
            console.warn("No local storage available: can't persist session!");
        }
    }

    getCredentials(): MatrixClientCreds {
        return {
            homeserverUrl: this.matrixClient.baseUrl,
            identityServerUrl: this.matrixClient.idBaseUrl,
            userId: this.matrixClient.credentials.userId,
            accessToken: this.matrixClient.getAccessToken(),
            guest: this.matrixClient.isGuest(),
        };
    }

    tryRestore() {
        if (localStorage) {
            const hs_url = localStorage.getItem("mx_hs_url");
            const is_url = localStorage.getItem("mx_is_url") || 'https://matrix.org';
            const access_token = localStorage.getItem("mx_access_token");
            const user_id = localStorage.getItem("mx_user_id");

            let is_guest;
            if (localStorage.getItem("mx_is_guest") !== null) {
                is_guest = localStorage.getItem("mx_is_guest") === "true";
            } else {
                // legacy key name
                is_guest = localStorage.getItem("matrix-is-guest") === "true";
            }

            if (access_token && user_id && hs_url) {
                console.log("Restoring session for %s", user_id);
                this._createClient(hs_url, is_url, user_id, access_token);
                this.matrixClient.setGuest(is_guest);
            } else {
                console.log("Session not found.");
            }
        }
    }

    _createClient(hs_url, is_url, user_id, access_token, isGuest) {
        var opts = {
            baseUrl: hs_url,
            idBaseUrl: is_url,
            accessToken: access_token,
            userId: user_id,
            timelineSupport: true,
        };

        if (localStorage) {
            opts.sessionStore = new Matrix.WebStorageSessionStore(localStorage);
            opts.deviceId = deviceId();
        }

        this.matrixClient = Matrix.createClient(opts);

        // we're going to add eventlisteners for each matrix event tile, so the
        // potential number of event listeners is quite high.
        this.matrixClient.setMaxListeners(500);

        this.matrixClient.setGuest(Boolean(isGuest));
    }
}

if (!global.mxMatrixClientPeg) {
    global.mxMatrixClientPeg = new MatrixClientPeg();
    global.mxMatrixClientPeg.tryRestore();
}
module.exports = global.mxMatrixClientPeg;
