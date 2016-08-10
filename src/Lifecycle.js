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

import q from 'q';

import MatrixClientPeg from './MatrixClientPeg';
import Notifier from './Notifier'
import UserActivity from './UserActivity';
import Presence from './Presence';
import dis from './dispatcher';

/**
 * Called at startup, to attempt to build a logged-in Matrix session. It tries
 * a number of things:
 *
 * 0. if it looks like we are in the middle of a registration process, it does
 *    nothing.
 *
 * 1. if we have a guest access token in the query params, it uses that.
 *
 * 2. if an access token is stored in local storage (from a previous session),
 *    it uses that.
 *
 * 3. it attempts to auto-register as a guest user.
 *
 * If any of steps 1-3 are successful, it will call {setLoggedIn}, which in
 * turn will raise on_logged_in and will_start_client events.
 *
 * It returns a promise which resolves when the above process completes.
 *
 * @param {object} opts.queryParams: string->string map of the query-parameters
 *     extracted from the #-fragment of the starting URI.
 *
 * @param {boolean} opts.enableGuest: set to true to enable guest access tokens
 *     and auto-guest registrations.
 *
 * @params {string} opts.hsUrl: homeserver URL. Only used if enableGuest is
 *     true; defines the HS to register against.
 *
 * @params {string} opts.isUrl: homeserver URL. Only used if enableGuest is
 *     true; defines the IS to use.
 *
 */
export function loadSession(opts) {
    const queryParams = opts.queryParams || {};
    let enableGuest = opts.enableGuest || false;
    const hsUrl = opts.hsUrl;
    const isUrl = opts.isUrl;

    if (queryParams.client_secret && queryParams.sid) {
        // this happens during email validation: the email contains a link to the
        // IS, which in turn redirects back to vector. We let MatrixChat create a
        // Registration component which completes the next stage of registration.
        console.log("Not registering as guest: registration already in progress.");
        return q();
    }

    if (!hsUrl) {
        console.warn("Cannot enable guest access: can't determine HS URL to use");
        enableGuest = false;
    }

    if (enableGuest &&
        queryParams.guest_user_id &&
        queryParams.guest_access_token
       ) {
        console.log("Using guest access credentials");
        setLoggedIn({
            userId: queryParams.guest_user_id,
            accessToken: queryParams.guest_access_token,
            homeserverUrl: hsUrl,
            identityServerUrl: isUrl,
            guest: true,
        });
        return q();
    }

    if (_restoreFromLocalStorage()) {
        return q();
    }

    if (enableGuest) {
        return _registerAsGuest(hsUrl, isUrl);
    }

    // fall back to login screen
    return q();
}

function _registerAsGuest(hsUrl, isUrl) {
    console.log("Doing guest login on %s", hsUrl);

    MatrixClientPeg.replaceUsingUrls(hsUrl, isUrl);
    return MatrixClientPeg.get().registerGuest().then((creds) => {
        console.log("Registered as guest: %s", creds.user_id);
        setLoggedIn({
            userId: creds.user_id,
            accessToken: creds.access_token,
            homeserverUrl: hsUrl,
            identityServerUrl: isUrl,
            guest: true,
        });
    }, (err) => {
        console.error("Failed to register as guest: " + err + " " + err.data);
    });
}

// returns true if a session is found in localstorage
function _restoreFromLocalStorage() {
    if (!localStorage) {
        return false;
    }
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
        setLoggedIn({
            userId: user_id,
            accessToken: access_token,
            homeserverUrl: hs_url,
            identityServerUrl: is_url,
            guest: is_guest,
        });
        return true;
    } else {
        console.log("No previous session found.");
        return false;
    }
}

/**
 * Transitions to a logged-in state using the given credentials
 * @param {MatrixClientCreds} credentials The credentials to use
 */
export function setLoggedIn(credentials) {
    credentials.guest = Boolean(credentials.guest);
    console.log("setLoggedIn => %s (guest=%s) hs=%s",
                credentials.userId, credentials.guest,
                credentials.homeserverUrl);

    // persist the session
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

    MatrixClientPeg.replaceUsingCreds(credentials);

    dis.dispatch({action: 'on_logged_in'});

    startMatrixClient();
}

/**
 * Logs the current session out and transitions to the logged-out state
 */
export function logout() {
    if (MatrixClientPeg.get().isGuest()) {
        // logout doesn't work for guest sessions
        // Also we sometimes want to re-log in a guest session
        // if we abort the login
        onLoggedOut();
        return;
    }

    return MatrixClientPeg.get().logout().then(onLoggedOut,
        (err) => {
            // Just throwing an error here is going to be very unhelpful
            // if you're trying to log out because your server's down and
            // you want to log into a different server, so just forget the
            // access token. It's annoying that this will leave the access
            // token still valid, but we should fix this by having access
            // tokens expire (and if you really think you've been compromised,
            // change your password).
            console.log("Failed to call logout API: token will not be invalidated");
            onLoggedOut();
        }
    );
}

/**
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 */
export function startMatrixClient() {
    // dispatch this before starting the matrix client: it's used
    // to add listeners for the 'sync' event so otherwise we'd have
    // a race condition (and we need to dispatch synchronously for this
    // to work).
    dis.dispatch({action: 'will_start_client'}, true);

    Notifier.start();
    UserActivity.start();
    Presence.start();

    MatrixClientPeg.start();
}

/*
 * Stops a running client and all related services, used after
 * a session has been logged out / ended.
 */
export function onLoggedOut() {
    if (window.localStorage) {
        const hsUrl = window.localStorage.getItem("mx_hs_url");
        const isUrl = window.localStorage.getItem("mx_is_url");
        window.localStorage.clear();
        // preserve our HS & IS URLs for convenience
        // N.B. we cache them in hsUrl/isUrl and can't really inline them
        // as getCurrentHsUrl() may call through to localStorage.
        // NB. We do clear the device ID (as well as all the settings)
        if (hsUrl) window.localStorage.setItem("mx_hs_url", hsUrl);
        if (isUrl) window.localStorage.setItem("mx_is_url", isUrl);
    }
    _stopMatrixClient();

    dis.dispatch({action: 'on_logged_out'});
}

/**
 * Stop all the background processes related to the current client
 */
function _stopMatrixClient() {
    Notifier.stop();
    UserActivity.stop();
    Presence.stop();
    MatrixClientPeg.get().stopClient();
    MatrixClientPeg.get().removeAllListeners();
    MatrixClientPeg.unset();
}
