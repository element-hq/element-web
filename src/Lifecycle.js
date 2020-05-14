/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import Matrix from 'matrix-js-sdk';

import {MatrixClientPeg} from './MatrixClientPeg';
import EventIndexPeg from './indexing/EventIndexPeg';
import createMatrixClient from './utils/createMatrixClient';
import Analytics from './Analytics';
import Notifier from './Notifier';
import UserActivity from './UserActivity';
import Presence from './Presence';
import dis from './dispatcher/dispatcher';
import DMRoomMap from './utils/DMRoomMap';
import Modal from './Modal';
import * as sdk from './index';
import ActiveWidgetStore from './stores/ActiveWidgetStore';
import PlatformPeg from "./PlatformPeg";
import { sendLoginRequest } from "./Login";
import * as StorageManager from './utils/StorageManager';
import SettingsStore from "./settings/SettingsStore";
import TypingStore from "./stores/TypingStore";
import ToastStore from "./stores/ToastStore";
import {IntegrationManagers} from "./integrations/IntegrationManagers";
import {Mjolnir} from "./mjolnir/Mjolnir";
import DeviceListener from "./DeviceListener";
import {Jitsi} from "./widgets/Jitsi";

/**
 * Called at startup, to attempt to build a logged-in Matrix session. It tries
 * a number of things:
 *
 *
 * 1. if we have a guest access token in the fragment query params, it uses
 *    that.
 *
 * 2. if an access token is stored in local storage (from a previous session),
 *    it uses that.
 *
 * 3. it attempts to auto-register as a guest user.
 *
 * If any of steps 1-4 are successful, it will call {_doSetLoggedIn}, which in
 * turn will raise on_logged_in and will_start_client events.
 *
 * @param {object} opts
 *
 * @param {object} opts.fragmentQueryParams: string->string map of the
 *     query-parameters extracted from the #-fragment of the starting URI.
 *
 * @param {boolean} opts.enableGuest: set to true to enable guest access tokens
 *     and auto-guest registrations.
 *
 * @params {string} opts.guestHsUrl: homeserver URL. Only used if enableGuest is
 *     true; defines the HS to register against.
 *
 * @params {string} opts.guestIsUrl: homeserver URL. Only used if enableGuest is
 *     true; defines the IS to use.
 *
 * @params {bool} opts.ignoreGuest: If the stored session is a guest account, ignore
 *     it and don't load it.
 *
 * @returns {Promise} a promise which resolves when the above process completes.
 *     Resolves to `true` if we ended up starting a session, or `false` if we
 *     failed.
 */
export async function loadSession(opts) {
    try {
        let enableGuest = opts.enableGuest || false;
        const guestHsUrl = opts.guestHsUrl;
        const guestIsUrl = opts.guestIsUrl;
        const fragmentQueryParams = opts.fragmentQueryParams || {};
        const defaultDeviceDisplayName = opts.defaultDeviceDisplayName;

        if (enableGuest && !guestHsUrl) {
            console.warn("Cannot enable guest access: can't determine HS URL to use");
            enableGuest = false;
        }

        if (enableGuest &&
            fragmentQueryParams.guest_user_id &&
            fragmentQueryParams.guest_access_token
           ) {
            console.log("Using guest access credentials");
            return _doSetLoggedIn({
                userId: fragmentQueryParams.guest_user_id,
                accessToken: fragmentQueryParams.guest_access_token,
                homeserverUrl: guestHsUrl,
                identityServerUrl: guestIsUrl,
                guest: true,
            }, true).then(() => true);
        }
        const success = await _restoreFromLocalStorage({
            ignoreGuest: Boolean(opts.ignoreGuest),
        });
        if (success) {
            return true;
        }

        if (enableGuest) {
            return _registerAsGuest(guestHsUrl, guestIsUrl, defaultDeviceDisplayName);
        }

        // fall back to welcome screen
        return false;
    } catch (e) {
        if (e instanceof AbortLoginAndRebuildStorage) {
            // If we're aborting login because of a storage inconsistency, we don't
            // need to show the general failure dialog. Instead, just go back to welcome.
            return false;
        }
        return _handleLoadSessionFailure(e);
    }
}

/**
 * Gets the user ID of the persisted session, if one exists. This does not validate
 * that the user's credentials still work, just that they exist and that a user ID
 * is associated with them. The session is not loaded.
 * @returns {String} The persisted session's owner, if an owner exists. Null otherwise.
 */
export function getStoredSessionOwner() {
    const {hsUrl, userId, accessToken} = getLocalStorageSessionVars();
    return hsUrl && userId && accessToken ? userId : null;
}

/**
 * @returns {bool} True if the stored session is for a guest user or false if it is
 *     for a real user. If there is no stored session, return null.
 */
export function getStoredSessionIsGuest() {
    const sessVars = getLocalStorageSessionVars();
    return sessVars.hsUrl && sessVars.userId && sessVars.accessToken ? sessVars.isGuest : null;
}

/**
 * @param {Object} queryParams    string->string map of the
 *     query-parameters extracted from the real query-string of the starting
 *     URI.
 *
 * @param {String} defaultDeviceDisplayName
 *
 * @returns {Promise} promise which resolves to true if we completed the token
 *    login, else false
 */
export function attemptTokenLogin(queryParams, defaultDeviceDisplayName) {
    if (!queryParams.loginToken) {
        return Promise.resolve(false);
    }

    if (!queryParams.homeserver) {
        console.warn("Cannot log in with token: can't determine HS URL to use");
        return Promise.resolve(false);
    }

    return sendLoginRequest(
        queryParams.homeserver,
        queryParams.identityServer,
        "m.login.token", {
            token: queryParams.loginToken,
            initial_device_display_name: defaultDeviceDisplayName,
        },
    ).then(function(creds) {
        console.log("Logged in with token");
        return _clearStorage().then(() => {
            _persistCredentialsToLocalStorage(creds);
            return true;
        });
    }).catch((err) => {
        console.error("Failed to log in with login token: " + err + " " +
                      err.data);
        return false;
    });
}

export function handleInvalidStoreError(e) {
    if (e.reason === Matrix.InvalidStoreError.TOGGLED_LAZY_LOADING) {
        return Promise.resolve().then(() => {
            const lazyLoadEnabled = e.value;
            if (lazyLoadEnabled) {
                const LazyLoadingResyncDialog =
                    sdk.getComponent("views.dialogs.LazyLoadingResyncDialog");
                return new Promise((resolve) => {
                    Modal.createDialog(LazyLoadingResyncDialog, {
                        onFinished: resolve,
                    });
                });
            } else {
                // show warning about simultaneous use
                // between LL/non-LL version on same host.
                // as disabling LL when previously enabled
                // is a strong indicator of this (/develop & /app)
                const LazyLoadingDisabledDialog =
                    sdk.getComponent("views.dialogs.LazyLoadingDisabledDialog");
                return new Promise((resolve) => {
                    Modal.createDialog(LazyLoadingDisabledDialog, {
                        onFinished: resolve,
                        host: window.location.host,
                    });
                });
            }
        }).then(() => {
            return MatrixClientPeg.get().store.deleteAllData();
        }).then(() => {
            PlatformPeg.get().reload();
        });
    }
}

function _registerAsGuest(hsUrl, isUrl, defaultDeviceDisplayName) {
    console.log(`Doing guest login on ${hsUrl}`);

    // create a temporary MatrixClient to do the login
    const client = Matrix.createClient({
        baseUrl: hsUrl,
    });

    return client.registerGuest({
        body: {
            initial_device_display_name: defaultDeviceDisplayName,
        },
    }).then((creds) => {
        console.log(`Registered as guest: ${creds.user_id}`);
        return _doSetLoggedIn({
            userId: creds.user_id,
            deviceId: creds.device_id,
            accessToken: creds.access_token,
            homeserverUrl: hsUrl,
            identityServerUrl: isUrl,
            guest: true,
        }, true).then(() => true);
    }, (err) => {
        console.error("Failed to register as guest", err);
        return false;
    });
}

/**
 * Retrieves information about the stored session in localstorage. The session
 * may not be valid, as it is not tested for consistency here.
 * @returns {Object} Information about the session - see implementation for variables.
 */
export function getLocalStorageSessionVars() {
    const hsUrl = localStorage.getItem("mx_hs_url");
    const isUrl = localStorage.getItem("mx_is_url");
    const accessToken = localStorage.getItem("mx_access_token");
    const userId = localStorage.getItem("mx_user_id");
    const deviceId = localStorage.getItem("mx_device_id");

    let isGuest;
    if (localStorage.getItem("mx_is_guest") !== null) {
        isGuest = localStorage.getItem("mx_is_guest") === "true";
    } else {
        // legacy key name
        isGuest = localStorage.getItem("matrix-is-guest") === "true";
    }

    return {hsUrl, isUrl, accessToken, userId, deviceId, isGuest};
}

// returns a promise which resolves to true if a session is found in
// localstorage
//
// N.B. Lifecycle.js should not maintain any further localStorage state, we
//      are moving towards using SessionStore to keep track of state related
//      to the current session (which is typically backed by localStorage).
//
//      The plan is to gradually move the localStorage access done here into
//      SessionStore to avoid bugs where the view becomes out-of-sync with
//      localStorage (e.g. isGuest etc.)
async function _restoreFromLocalStorage(opts) {
    const ignoreGuest = opts.ignoreGuest;

    if (!localStorage) {
        return false;
    }

    const {hsUrl, isUrl, accessToken, userId, deviceId, isGuest} = getLocalStorageSessionVars();

    if (accessToken && userId && hsUrl) {
        if (ignoreGuest && isGuest) {
            console.log("Ignoring stored guest account: " + userId);
            return false;
        }

        console.log(`Restoring session for ${userId}`);
        await _doSetLoggedIn({
            userId: userId,
            deviceId: deviceId,
            accessToken: accessToken,
            homeserverUrl: hsUrl,
            identityServerUrl: isUrl,
            guest: isGuest,
        }, false);
        return true;
    } else {
        console.log("No previous session found.");
        return false;
    }
}

async function _handleLoadSessionFailure(e) {
    console.error("Unable to load session", e);

    const SessionRestoreErrorDialog =
          sdk.getComponent('views.dialogs.SessionRestoreErrorDialog');

    const modal = Modal.createTrackedDialog('Session Restore Error', '', SessionRestoreErrorDialog, {
        error: e.message,
    });

    const [success] = await modal.finished;
    if (success) {
        // user clicked continue.
        await _clearStorage();
        return false;
    }

    // try, try again
    return loadSession();
}

/**
 * Transitions to a logged-in state using the given credentials.
 *
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 *
 * Also stops the old MatrixClient and clears old credentials/etc out of
 * storage before starting the new client.
 *
 * @param {MatrixClientCreds} credentials The credentials to use
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
export function setLoggedIn(credentials) {
    stopMatrixClient();
    return _doSetLoggedIn(credentials, true);
}

/**
 * Hydrates an existing session by using the credentials provided. This will
 * not clear any local storage, unlike setLoggedIn().
 *
 * Stops the existing Matrix client (without clearing its data) and starts a
 * new one in its place. This additionally starts all other react-sdk services
 * which use the new Matrix client.
 *
 * If the credentials belong to a different user from the session already stored,
 * the old session will be cleared automatically.
 *
 * @param {MatrixClientCreds} credentials The credentials to use
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
export function hydrateSession(credentials) {
    const oldUserId = MatrixClientPeg.get().getUserId();
    const oldDeviceId = MatrixClientPeg.get().getDeviceId();

    stopMatrixClient(); // unsets MatrixClientPeg.get()
    localStorage.removeItem("mx_soft_logout");
    _isLoggingOut = false;

    const overwrite = credentials.userId !== oldUserId || credentials.deviceId !== oldDeviceId;
    if (overwrite) {
        console.warn("Clearing all data: Old session belongs to a different user/session");
    }

    return _doSetLoggedIn(credentials, overwrite);
}

/**
 * fires on_logging_in, optionally clears localstorage, persists new credentials
 * to localstorage, starts the new client.
 *
 * @param {MatrixClientCreds} credentials
 * @param {Boolean} clearStorage
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
async function _doSetLoggedIn(credentials, clearStorage) {
    credentials.guest = Boolean(credentials.guest);

    const softLogout = isSoftLogout();

    console.log(
        "setLoggedIn: mxid: " + credentials.userId +
        " deviceId: " + credentials.deviceId +
        " guest: " + credentials.guest +
        " hs: " + credentials.homeserverUrl +
        " softLogout: " + softLogout,
    );

    // This is dispatched to indicate that the user is still in the process of logging in
    // because async code may take some time to resolve, breaking the assumption that
    // `setLoggedIn` takes an "instant" to complete, and dispatch `on_logged_in` a few ms
    // later than MatrixChat might assume.
    //
    // we fire it *synchronously* to make sure it fires before on_logged_in.
    // (dis.dispatch uses `setTimeout`, which does not guarantee ordering.)
    dis.dispatch({action: 'on_logging_in'}, true);

    if (clearStorage) {
        await _clearStorage();
    }

    const results = await StorageManager.checkConsistency();
    // If there's an inconsistency between account data in local storage and the
    // crypto store, we'll be generally confused when handling encrypted data.
    // Show a modal recommending a full reset of storage.
    if (results.dataInLocalStorage && results.cryptoInited && !results.dataInCryptoStore) {
        const signOut = await _showStorageEvictedDialog();
        if (signOut) {
            await _clearStorage();
            // This error feels a bit clunky, but we want to make sure we don't go any
            // further and instead head back to sign in.
            throw new AbortLoginAndRebuildStorage(
                "Aborting login in progress because of storage inconsistency",
            );
        }
    }

    Analytics.setLoggedIn(credentials.guest, credentials.homeserverUrl);

    if (localStorage) {
        try {
            _persistCredentialsToLocalStorage(credentials);

            // The user registered as a PWLU (PassWord-Less User), the generated password
            // is cached here such that the user can change it at a later time.
            if (credentials.password) {
                // Update SessionStore
                dis.dispatch({
                    action: 'cached_password',
                    cachedPassword: credentials.password,
                });
            }
        } catch (e) {
            console.warn("Error using local storage: can't persist session!", e);
        }
    } else {
        console.warn("No local storage available: can't persist session!");
    }

    MatrixClientPeg.replaceUsingCreds(credentials);

    dis.dispatch({ action: 'on_logged_in' });

    await startMatrixClient(/*startSyncing=*/!softLogout);
    return MatrixClientPeg.get();
}

function _showStorageEvictedDialog() {
    const StorageEvictedDialog = sdk.getComponent('views.dialogs.StorageEvictedDialog');
    return new Promise(resolve => {
        Modal.createTrackedDialog('Storage evicted', '', StorageEvictedDialog, {
            onFinished: resolve,
        });
    });
}

// Note: Babel 6 requires the `transform-builtin-extend` plugin for this to satisfy
// `instanceof`. Babel 7 supports this natively in their class handling.
class AbortLoginAndRebuildStorage extends Error { }

function _persistCredentialsToLocalStorage(credentials) {
    localStorage.setItem("mx_hs_url", credentials.homeserverUrl);
    if (credentials.identityServerUrl) {
        localStorage.setItem("mx_is_url", credentials.identityServerUrl);
    }
    localStorage.setItem("mx_user_id", credentials.userId);
    localStorage.setItem("mx_access_token", credentials.accessToken);
    localStorage.setItem("mx_is_guest", JSON.stringify(credentials.guest));

    // if we didn't get a deviceId from the login, leave mx_device_id unset,
    // rather than setting it to "undefined".
    //
    // (in this case MatrixClient doesn't bother with the crypto stuff
    // - that's fine for us).
    if (credentials.deviceId) {
        localStorage.setItem("mx_device_id", credentials.deviceId);
    }

    console.log(`Session persisted for ${credentials.userId}`);
}

let _isLoggingOut = false;

/**
 * Logs the current session out and transitions to the logged-out state
 */
export function logout() {
    if (!MatrixClientPeg.get()) return;

    if (MatrixClientPeg.get().isGuest()) {
        // logout doesn't work for guest sessions
        // Also we sometimes want to re-log in a guest session
        // if we abort the login
        onLoggedOut();
        return;
    }

    _isLoggingOut = true;
    MatrixClientPeg.get().logout().then(onLoggedOut,
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
        },
    );
}

export function softLogout() {
    if (!MatrixClientPeg.get()) return;

    // Track that we've detected and trapped a soft logout. This helps prevent other
    // parts of the app from starting if there's no point (ie: don't sync if we've
    // been soft logged out, despite having credentials and data for a MatrixClient).
    localStorage.setItem("mx_soft_logout", "true");

    // Dev note: please keep this log line around. It can be useful for track down
    // random clients stopping in the middle of the logs.
    console.log("Soft logout initiated");
    _isLoggingOut = true; // to avoid repeated flags
    // Ensure that we dispatch a view change **before** stopping the client so
    // so that React components unmount first. This avoids React soft crashes
    // that can occur when components try to use a null client.
    dis.dispatch({action: 'on_client_not_viable'}); // generic version of on_logged_out
    stopMatrixClient(/*unsetClient=*/false);

    // DO NOT CALL LOGOUT. A soft logout preserves data, logout does not.
}

export function isSoftLogout() {
    return localStorage.getItem("mx_soft_logout") === "true";
}

export function isLoggingOut() {
    return _isLoggingOut;
}

/**
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 * @param {boolean} startSyncing True (default) to actually start
 * syncing the client.
 */
async function startMatrixClient(startSyncing=true) {
    console.log(`Lifecycle: Starting MatrixClient`);

    // dispatch this before starting the matrix client: it's used
    // to add listeners for the 'sync' event so otherwise we'd have
    // a race condition (and we need to dispatch synchronously for this
    // to work).
    dis.dispatch({action: 'will_start_client'}, true);

    Notifier.start();
    UserActivity.sharedInstance().start();
    TypingStore.sharedInstance().reset(); // just in case
    ToastStore.sharedInstance().reset();
    DMRoomMap.makeShared().start();
    IntegrationManagers.sharedInstance().startWatching();
    ActiveWidgetStore.start();

    // Start Mjolnir even though we haven't checked the feature flag yet. Starting
    // the thing just wastes CPU cycles, but should result in no actual functionality
    // being exposed to the user.
    Mjolnir.sharedInstance().start();

    if (startSyncing) {
        // The client might want to populate some views with events from the
        // index (e.g. the FilePanel), therefore initialize the event index
        // before the client.
        await EventIndexPeg.init();
        await MatrixClientPeg.start();
    } else {
        console.warn("Caller requested only auxiliary services be started");
        await MatrixClientPeg.assign();
    }

    // This needs to be started after crypto is set up
    DeviceListener.sharedInstance().start();
    // Similarly, don't start sending presence updates until we've started
    // the client
    if (!SettingsStore.getValue("lowBandwidth")) {
        Presence.start();
    }

    // Now that we have a MatrixClientPeg, update the Jitsi info
    await Jitsi.getInstance().update();

    // dispatch that we finished starting up to wire up any other bits
    // of the matrix client that cannot be set prior to starting up.
    dis.dispatch({action: 'client_started'});

    if (isSoftLogout()) {
        softLogout();
    }
}

/*
 * Stops a running client and all related services, and clears persistent
 * storage. Used after a session has been logged out.
 */
export async function onLoggedOut() {
    _isLoggingOut = false;
    // Ensure that we dispatch a view change **before** stopping the client so
    // so that React components unmount first. This avoids React soft crashes
    // that can occur when components try to use a null client.
    dis.dispatch({action: 'on_logged_out'}, true);
    stopMatrixClient();
    await _clearStorage();
}

/**
 * @returns {Promise} promise which resolves once the stores have been cleared
 */
async function _clearStorage() {
    Analytics.disable();

    if (window.localStorage) {
        window.localStorage.clear();
    }

    if (window.sessionStorage) {
        window.sessionStorage.clear();
    }

    // create a temporary client to clear out the persistent stores.
    const cli = createMatrixClient({
        // we'll never make any requests, so can pass a bogus HS URL
        baseUrl: "",
    });

    await EventIndexPeg.deleteEventIndex();
    await cli.clearStores();
}

/**
 * Stop all the background processes related to the current client.
 * @param {boolean} unsetClient True (default) to abandon the client
 * on MatrixClientPeg after stopping.
 */
export function stopMatrixClient(unsetClient=true) {
    Notifier.stop();
    UserActivity.sharedInstance().stop();
    TypingStore.sharedInstance().reset();
    Presence.stop();
    ActiveWidgetStore.stop();
    IntegrationManagers.sharedInstance().stopWatching();
    Mjolnir.sharedInstance().stop();
    DeviceListener.sharedInstance().stop();
    if (DMRoomMap.shared()) DMRoomMap.shared().stop();
    EventIndexPeg.stop();
    const cli = MatrixClientPeg.get();
    if (cli) {
        cli.stopClient();
        cli.removeAllListeners();

        if (unsetClient) {
            MatrixClientPeg.unset();
            EventIndexPeg.unset();
        }
    }
}
