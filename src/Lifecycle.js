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

import MatrixClientPeg from './MatrixClientPeg';
import Notifier from './Notifier'
import UserActivity from './UserActivity';
import Presence from './Presence';
import dis from './dispatcher';

function login(credentials, options) {
    credentials.guest = Boolean(credentials.guest);
    console.log("onLoggedIn => %s (guest=%s)", credentials.userId, credentials.guest);
    MatrixClientPeg.replaceUsingAccessToken(
        credentials.homeserverUrl, credentials.identityServerUrl,
        credentials.userId, credentials.accessToken, credentials.guest
    );

    dis.dispatch({action: 'on_logged_in'});

    startMatrixClient(options);
}

function logout() {
    if (MatrixClientPeg.get().isGuest()) {
        // logout doesn't work for guest sessions
        // Also we sometimes want to re-log in a guest session
        // if we abort the login
        _onLoggedOut();
        return;
    }

    return MatrixClientPeg.get().logout().then(_onLoggedOut,
        // Just throwing an error here is going to be very unhelpful
        // if you're trying to log out because your server's down and
        // you want to log into a different server, so just forget the
        // access token. It's annoying that this will leave the access
        // token still valid, but we should fix this by having access
        // tokens expire (and if you really think you've been compromised,
        // change your password).
        _onLoggedOut
    );
}

function startMatrixClient(options) {
    // dispatch this before starting the matrix client: it's used
    // to add listeners for the 'sync' event so otherwise we'd have
    // a race condition (and we need to dispatch synchronously for this
    // to work).
    dis.dispatch({action: 'will_start_client'}, true);

    Notifier.start();
    UserActivity.start();
    Presence.start();
    MatrixClientPeg.get().startClient(MatrixClientPeg.opts);
}

function _onLoggedOut() {
    if (window.localStorage) {
        const hsUrl = window.localStorage.getItem("mx_hs_url");
        const isUrl = window.localStorage.getItem("mx_is_url");
        window.localStorage.clear();
        // preserve our HS & IS URLs for convenience
        // N.B. we cache them in hsUrl/isUrl and can't really inline them
        // as getCurrentHsUrl() may call through to localStorage.
        if (hsUrl) window.localStorage.setItem("mx_hs_url", hsUrl);
        if (isUrl) window.localStorage.setItem("mx_is_url", isUrl);
    }
    _stopMatrixClient();

    dis.dispatch({action: 'on_logged_out'});
}

// stop all the background processes related to the current client
function _stopMatrixClient() {
    Notifier.stop();
    UserActivity.stop();
    Presence.stop();
    MatrixClientPeg.get().stopClient();
    MatrixClientPeg.get().removeAllListeners();
    MatrixClientPeg.unset();
}

module.exports = {
    login, logout, startMatrixClient
};
