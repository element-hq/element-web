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
import GuestAccess from './GuestAccess';

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

// A thing that holds your Matrix Client
// Also magically works across sessions through the power of localstorage
class MatrixClientPeg {
    constructor(guestAccess) {
        this.matrixClient = null;
        this.guestAccess = guestAccess;
    }

    get(): MatrixClient {
        return this.matrixClient;
    }

    unset() {
        this.matrixClient = null;
    }

    replaceUsingUrls(hs_url, is_url) {
        this.replaceClient(hs_url, is_url);
    }

    replaceUsingAccessToken(hs_url, is_url, user_id, access_token, isGuest) {
        this.replaceClient(hs_url, is_url, user_id, access_token, isGuest);
    }

    replaceClient(hs_url, is_url, user_id, access_token, isGuest) {
        if (localStorage) {
            try {
                localStorage.clear();
            } catch (e) {
                console.warn("Error clearing local storage", e);
            }
        }
        this.guestAccess.markAsGuest(Boolean(isGuest));
        this._createClient(hs_url, is_url, user_id, access_token);
        if (localStorage) {
            try {
                localStorage.setItem("mx_hs_url", hs_url);
                localStorage.setItem("mx_is_url", is_url);
                localStorage.setItem("mx_user_id", user_id);
                localStorage.setItem("mx_access_token", access_token);
                console.log("Session persisted for %s", user_id);
            } catch (e) {
                console.warn("Error using local storage: can't persist session!", e);
            }
        } else {
            console.warn("No local storage available: can't persist session!");
        }
    }

    getCredentials() {
        return [
            this.matrixClient.baseUrl,
            this.matrixClient.idBaseUrl,
            this.matrixClient.credentials.userId,
            this.matrixClient.getAccessToken(),
            this.guestAccess.isGuest(),
        ];
    }

    tryRestore() {
        if (localStorage) {
            const hs_url = localStorage.getItem("mx_hs_url");
            const is_url = localStorage.getItem("mx_is_url") || 'https://matrix.org';
            const access_token = localStorage.getItem("mx_access_token");
            const user_id = localStorage.getItem("mx_user_id");
            const guestAccess = new GuestAccess(localStorage);
            if (access_token && user_id && hs_url) {
                console.log("Restoring session for %s", user_id);
                this._createClient(hs_url, is_url, user_id, access_token, guestAccess);
            } else {
                console.log("Session not found.");
            }
        }
    }

    _createClient(hs_url, is_url, user_id, access_token) {
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

        if (this.guestAccess) {
            console.log("Guest: %s", this.guestAccess.isGuest());
            this.matrixClient.setGuest(this.guestAccess.isGuest());
            var peekedRoomId = this.guestAccess.getPeekedRoom();
            if (peekedRoomId) {
                console.log("Peeking in room %s", peekedRoomId);
                this.matrixClient.peekInRoom(peekedRoomId);
            }
        }
    }
}

if (!global.mxMatrixClientPeg) {
    global.mxMatrixClientPeg = new MatrixClientPeg(new GuestAccess(localStorage));
    global.mxMatrixClientPeg.tryRestore();
}
module.exports = global.mxMatrixClientPeg;
