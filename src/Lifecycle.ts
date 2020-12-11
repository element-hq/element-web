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

// @ts-ignore - XXX: tsc doesn't like this: our js-sdk imports are complex so this isn't surprising
import Matrix from 'matrix-js-sdk';
import { InvalidStoreError } from "matrix-js-sdk/src/errors";
import { MatrixClient } from "matrix-js-sdk/src/client";
import {decryptAES, encryptAES} from "matrix-js-sdk/src/crypto/aes";

import {IMatrixClientCreds, MatrixClientPeg} from './MatrixClientPeg';
import SecurityCustomisations from "./customisations/Security";
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
import {SSO_HOMESERVER_URL_KEY, SSO_ID_SERVER_URL_KEY} from "./BasePlatform";
import ThreepidInviteStore from "./stores/ThreepidInviteStore";
import CountlyAnalytics from "./CountlyAnalytics";
import CallHandler from './CallHandler';
import LifecycleCustomisations from "./customisations/Lifecycle";

const HOMESERVER_URL_KEY = "mx_hs_url";
const ID_SERVER_URL_KEY = "mx_is_url";

interface ILoadSessionOpts {
    enableGuest?: boolean;
    guestHsUrl?: string;
    guestIsUrl?: string;
    ignoreGuest?: boolean;
    defaultDeviceDisplayName?: string;
    fragmentQueryParams?: Record<string, string>;
}

/**
 * Called at startup, to attempt to build a logged-in Matrix session. It tries
 * a number of things:
 *
 * 1. if we have a guest access token in the fragment query params, it uses
 *    that.
 * 2. if an access token is stored in local storage (from a previous session),
 *    it uses that.
 * 3. it attempts to auto-register as a guest user.
 *
 * If any of steps 1-4 are successful, it will call {_doSetLoggedIn}, which in
 * turn will raise on_logged_in and will_start_client events.
 *
 * @param {object} [opts]
 * @param {object} [opts.fragmentQueryParams]: string->string map of the
 *     query-parameters extracted from the #-fragment of the starting URI.
 * @param {boolean} [opts.enableGuest]: set to true to enable guest access
 *     tokens and auto-guest registrations.
 * @param {string} [opts.guestHsUrl]: homeserver URL. Only used if enableGuest
 *     is true; defines the HS to register against.
 * @param {string} [opts.guestIsUrl]: homeserver URL. Only used if enableGuest
 *     is true; defines the IS to use.
 * @param {bool} [opts.ignoreGuest]: If the stored session is a guest account,
 *     ignore it and don't load it.
 * @param {string} [opts.defaultDeviceDisplayName]: Default display name to use
 *     when registering as a guest.
 * @returns {Promise} a promise which resolves when the above process completes.
 *     Resolves to `true` if we ended up starting a session, or `false` if we
 *     failed.
 */
export async function loadSession(opts: ILoadSessionOpts = {}): Promise<boolean> {
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

        if (
            enableGuest &&
            fragmentQueryParams.guest_user_id &&
            fragmentQueryParams.guest_access_token
        ) {
            console.log("Using guest access credentials");
            return doSetLoggedIn({
                userId: fragmentQueryParams.guest_user_id,
                accessToken: fragmentQueryParams.guest_access_token,
                homeserverUrl: guestHsUrl,
                identityServerUrl: guestIsUrl,
                guest: true,
            }, true).then(() => true);
        }
        const success = await restoreFromLocalStorage({
            ignoreGuest: Boolean(opts.ignoreGuest),
        });
        if (success) {
            return true;
        }

        if (enableGuest) {
            return registerAsGuest(guestHsUrl, guestIsUrl, defaultDeviceDisplayName);
        }

        // fall back to welcome screen
        return false;
    } catch (e) {
        if (e instanceof AbortLoginAndRebuildStorage) {
            // If we're aborting login because of a storage inconsistency, we don't
            // need to show the general failure dialog. Instead, just go back to welcome.
            return false;
        }
        return handleLoadSessionFailure(e);
    }
}

/**
 * Gets the user ID of the persisted session, if one exists. This does not validate
 * that the user's credentials still work, just that they exist and that a user ID
 * is associated with them. The session is not loaded.
 * @returns {[String, bool]} The persisted session's owner and whether the stored
 *     session is for a guest user, if an owner exists. If there is no stored session,
 *     return [null, null].
 */
export async function getStoredSessionOwner(): Promise<[string, boolean]> {
    const {hsUrl, userId, hasAccessToken, isGuest} = await getStoredSessionVars();
    return hsUrl && userId && hasAccessToken ? [userId, isGuest] : [null, null];
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
export function attemptTokenLogin(
    queryParams: Record<string, string>,
    defaultDeviceDisplayName?: string,
): Promise<boolean> {
    if (!queryParams.loginToken) {
        return Promise.resolve(false);
    }

    const homeserver = localStorage.getItem(SSO_HOMESERVER_URL_KEY);
    const identityServer = localStorage.getItem(SSO_ID_SERVER_URL_KEY);
    if (!homeserver) {
        console.warn("Cannot log in with token: can't determine HS URL to use");
        return Promise.resolve(false);
    }

    return sendLoginRequest(
        homeserver,
        identityServer,
        "m.login.token", {
            token: queryParams.loginToken,
            initial_device_display_name: defaultDeviceDisplayName,
        },
    ).then(function(creds) {
        console.log("Logged in with token");
        return clearStorage().then(async () => {
            await persistCredentials(creds);
            // remember that we just logged in
            sessionStorage.setItem("mx_fresh_login", String(true));
            return true;
        });
    }).catch((err) => {
        console.error("Failed to log in with login token: " + err + " " +
                      err.data);
        return false;
    });
}

export function handleInvalidStoreError(e: InvalidStoreError): Promise<void> {
    if (e.reason === InvalidStoreError.TOGGLED_LAZY_LOADING) {
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

function registerAsGuest(
    hsUrl: string,
    isUrl: string,
    defaultDeviceDisplayName: string,
): Promise<boolean> {
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
        return doSetLoggedIn({
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

export interface IStoredSession {
    hsUrl: string;
    isUrl: string;
    hasAccessToken: boolean;
    accessToken: string | object;
    userId: string;
    deviceId: string;
    isGuest: boolean;
}

/**
 * Retrieves information about the stored session from the browser's storage. The session
 * may not be valid, as it is not tested for consistency here.
 * @returns {Object} Information about the session - see implementation for variables.
 */
export async function getStoredSessionVars(): Promise<IStoredSession> {
    const hsUrl = localStorage.getItem(HOMESERVER_URL_KEY);
    const isUrl = localStorage.getItem(ID_SERVER_URL_KEY);
    let accessToken;
    try {
        accessToken = await StorageManager.idbLoad("account", "mx_access_token");
    } catch (e) {}
    if (!accessToken) {
        accessToken = localStorage.getItem("mx_access_token");
        if (accessToken) {
            try {
                // try to migrate access token to IndexedDB if we can
                await StorageManager.idbSave("account", "mx_access_token", accessToken);
                localStorage.removeItem("mx_access_token");
            } catch (e) {}
        }
    }
    // if we pre-date storing "mx_has_access_token", but we retrieved an access
    // token, then we should say we have an access token
    const hasAccessToken =
        (localStorage.getItem("mx_has_access_token") === "true") || !!accessToken;
    const userId = localStorage.getItem("mx_user_id");
    const deviceId = localStorage.getItem("mx_device_id");

    let isGuest;
    if (localStorage.getItem("mx_is_guest") !== null) {
        isGuest = localStorage.getItem("mx_is_guest") === "true";
    } else {
        // legacy key name
        isGuest = localStorage.getItem("matrix-is-guest") === "true";
    }

    return {hsUrl, isUrl, hasAccessToken, accessToken, userId, deviceId, isGuest};
}

// The pickle key is a string of unspecified length and format.  For AES, we
// need a 256-bit Uint8Array.  So we HKDF the pickle key to generate the AES
// key.  The AES key should be zeroed after it is used.
async function pickleKeyToAesKey(pickleKey: string): Promise<Uint8Array> {
    const pickleKeyBuffer = new Uint8Array(pickleKey.length);
    for (let i = 0; i < pickleKey.length; i++) {
        pickleKeyBuffer[i] = pickleKey.charCodeAt(i);
    }
    const hkdfKey = await window.crypto.subtle.importKey(
        "raw", pickleKeyBuffer, "HKDF", false, ["deriveBits"],
    );
    pickleKeyBuffer.fill(0);
    return new Uint8Array(await window.crypto.subtle.deriveBits(
        {
            name: "HKDF", hash: "SHA-256",
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/879
            salt: new Uint8Array(32), info: new Uint8Array(0),
        },
        hkdfKey,
        256,
    ));
}

async function abortLogin() {
    const signOut = await showStorageEvictedDialog();
    if (signOut) {
        await clearStorage();
        // This error feels a bit clunky, but we want to make sure we don't go any
        // further and instead head back to sign in.
        throw new AbortLoginAndRebuildStorage(
            "Aborting login in progress because of storage inconsistency",
        );
    }
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
async function restoreFromLocalStorage(opts?: { ignoreGuest?: boolean }): Promise<boolean> {
    const ignoreGuest = opts?.ignoreGuest;

    if (!localStorage) {
        return false;
    }

    const {hsUrl, isUrl, hasAccessToken, accessToken, userId, deviceId, isGuest} = await getStoredSessionVars();

    if (hasAccessToken && !accessToken) {
        abortLogin();
    }

    if (accessToken && userId && hsUrl) {
        if (ignoreGuest && isGuest) {
            console.log("Ignoring stored guest account: " + userId);
            return false;
        }

        let decryptedAccessToken = accessToken;
        const pickleKey = await PlatformPeg.get().getPickleKey(userId, deviceId);
        if (pickleKey) {
            console.log("Got pickle key");
            if (typeof accessToken !== "string") {
                const encrKey = await pickleKeyToAesKey(pickleKey);
                decryptedAccessToken = await decryptAES(accessToken, encrKey, "access_token");
                encrKey.fill(0);
            }
        } else {
            console.log("No pickle key available");
        }

        const freshLogin = sessionStorage.getItem("mx_fresh_login") === "true";
        sessionStorage.removeItem("mx_fresh_login");

        console.log(`Restoring session for ${userId}`);
        await doSetLoggedIn({
            userId: userId,
            deviceId: deviceId,
            accessToken: decryptedAccessToken as string,
            homeserverUrl: hsUrl,
            identityServerUrl: isUrl,
            guest: isGuest,
            pickleKey: pickleKey,
            freshLogin: freshLogin,
        }, false);
        return true;
    } else {
        console.log("No previous session found.");
        return false;
    }
}

async function handleLoadSessionFailure(e: Error): Promise<boolean> {
    console.error("Unable to load session", e);

    const SessionRestoreErrorDialog =
          sdk.getComponent('views.dialogs.SessionRestoreErrorDialog');

    const modal = Modal.createTrackedDialog('Session Restore Error', '', SessionRestoreErrorDialog, {
        error: e.message,
    });

    const [success] = await modal.finished;
    if (success) {
        // user clicked continue.
        await clearStorage();
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
export async function setLoggedIn(credentials: IMatrixClientCreds): Promise<MatrixClient> {
    credentials.freshLogin = true;
    stopMatrixClient();
    const pickleKey = credentials.userId && credentials.deviceId
        ? await PlatformPeg.get().createPickleKey(credentials.userId, credentials.deviceId)
        : null;

    if (pickleKey) {
        console.log("Created pickle key");
    } else {
        console.log("Pickle key not created");
    }

    return doSetLoggedIn(Object.assign({}, credentials, {pickleKey}), true);
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
export function hydrateSession(credentials: IMatrixClientCreds): Promise<MatrixClient> {
    const oldUserId = MatrixClientPeg.get().getUserId();
    const oldDeviceId = MatrixClientPeg.get().getDeviceId();

    stopMatrixClient(); // unsets MatrixClientPeg.get()
    localStorage.removeItem("mx_soft_logout");
    _isLoggingOut = false;

    const overwrite = credentials.userId !== oldUserId || credentials.deviceId !== oldDeviceId;
    if (overwrite) {
        console.warn("Clearing all data: Old session belongs to a different user/session");
    }

    return doSetLoggedIn(credentials, overwrite);
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
async function doSetLoggedIn(
    credentials: IMatrixClientCreds,
    clearStorageEnabled: boolean,
): Promise<MatrixClient> {
    credentials.guest = Boolean(credentials.guest);

    const softLogout = isSoftLogout();

    console.log(
        "setLoggedIn: mxid: " + credentials.userId +
        " deviceId: " + credentials.deviceId +
        " guest: " + credentials.guest +
        " hs: " + credentials.homeserverUrl +
        " softLogout: " + softLogout,
        " freshLogin: " + credentials.freshLogin,
    );

    // This is dispatched to indicate that the user is still in the process of logging in
    // because async code may take some time to resolve, breaking the assumption that
    // `setLoggedIn` takes an "instant" to complete, and dispatch `on_logged_in` a few ms
    // later than MatrixChat might assume.
    //
    // we fire it *synchronously* to make sure it fires before on_logged_in.
    // (dis.dispatch uses `setTimeout`, which does not guarantee ordering.)
    dis.dispatch({action: 'on_logging_in'}, true);

    if (clearStorageEnabled) {
        await clearStorage();
    }

    const results = await StorageManager.checkConsistency();
    // If there's an inconsistency between account data in local storage and the
    // crypto store, we'll be generally confused when handling encrypted data.
    // Show a modal recommending a full reset of storage.
    if (results.dataInLocalStorage && results.cryptoInited && !results.dataInCryptoStore) {
        await abortLogin();
    }

    Analytics.setLoggedIn(credentials.guest, credentials.homeserverUrl);

    MatrixClientPeg.replaceUsingCreds(credentials);
    const client = MatrixClientPeg.get();

    if (credentials.freshLogin && SettingsStore.getValue("feature_dehydration")) {
        // If we just logged in, try to rehydrate a device instead of using a
        // new device.  If it succeeds, we'll get a new device ID, so make sure
        // we persist that ID to localStorage
        const newDeviceId = await client.rehydrateDevice();
        if (newDeviceId) {
            credentials.deviceId = newDeviceId;
        }

        delete credentials.freshLogin;
    }

    if (localStorage) {
        try {
            await persistCredentials(credentials);
            // make sure we don't think that it's a fresh login any more
            sessionStorage.removeItem("mx_fresh_login");
        } catch (e) {
            console.warn("Error using local storage: can't persist session!", e);
        }
    } else {
        console.warn("No local storage available: can't persist session!");
    }

    dis.dispatch({ action: 'on_logged_in' });

    await startMatrixClient(/*startSyncing=*/!softLogout);
    return client;
}

function showStorageEvictedDialog(): Promise<boolean> {
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

async function persistCredentials(credentials: IMatrixClientCreds): Promise<void> {
    localStorage.setItem(HOMESERVER_URL_KEY, credentials.homeserverUrl);
    if (credentials.identityServerUrl) {
        localStorage.setItem(ID_SERVER_URL_KEY, credentials.identityServerUrl);
    }
    localStorage.setItem("mx_user_id", credentials.userId);
    localStorage.setItem("mx_is_guest", JSON.stringify(credentials.guest));

    // store whether we expect to find an access token, to detect the case
    // where IndexedDB is blown away
    if (credentials.accessToken) {
        localStorage.setItem("mx_has_access_token", "true");
    } else {
        localStorage.deleteItem("mx_has_access_token");
    }

    if (credentials.pickleKey) {
        let encryptedAccessToken;
        try {
            // try to encrypt the access token using the pickle key
            const encrKey = await pickleKeyToAesKey(credentials.pickleKey);
            encryptedAccessToken = await encryptAES(credentials.accessToken, encrKey, "access_token");
            encrKey.fill(0);
        } catch (e) {
            console.warn("Could not encrypt access token", e);
        }
        try {
            // save either the encrypted access token, or the plain access
            // token if we were unable to encrypt (e.g. if the browser doesn't
            // have WebCrypto).
            await StorageManager.idbSave(
                "account", "mx_access_token",
                encryptedAccessToken || credentials.accessToken,
            );
        } catch (e) {
            // if we couldn't save to indexedDB, fall back to localStorage.  We
            // store the access token unencrypted since localStorage only saves
            // strings.
            localStorage.setItem("mx_access_token", credentials.accessToken);
        }
        localStorage.setItem("mx_has_pickle_key", String(true));
    } else {
        try {
            await StorageManager.idbSave(
                "account", "mx_access_token", credentials.accessToken,
            );
        } catch (e) {
            localStorage.setItem("mx_access_token", credentials.accessToken);
        }
        if (localStorage.getItem("mx_has_pickle_key")) {
            console.error("Expected a pickle key, but none provided.  Encryption may not work.");
        }
    }

    // if we didn't get a deviceId from the login, leave mx_device_id unset,
    // rather than setting it to "undefined".
    //
    // (in this case MatrixClient doesn't bother with the crypto stuff
    // - that's fine for us).
    if (credentials.deviceId) {
        localStorage.setItem("mx_device_id", credentials.deviceId);
    }

    SecurityCustomisations.persistCredentials?.(credentials);

    console.log(`Session persisted for ${credentials.userId}`);
}

let _isLoggingOut = false;

/**
 * Logs the current session out and transitions to the logged-out state
 */
export function logout(): void {
    if (!MatrixClientPeg.get()) return;
    if (!CountlyAnalytics.instance.disabled) {
        // user has logged out, fall back to anonymous
        CountlyAnalytics.instance.enable(/* anonymous = */ true);
    }

    if (MatrixClientPeg.get().isGuest()) {
        // logout doesn't work for guest sessions
        // Also we sometimes want to re-log in a guest session if we abort the login.
        // defer until next tick because it calls a synchronous dispatch and we are likely here from a dispatch.
        setImmediate(() => onLoggedOut());
        return;
    }

    _isLoggingOut = true;
    const client = MatrixClientPeg.get();
    PlatformPeg.get().destroyPickleKey(client.getUserId(), client.getDeviceId());
    client.logout().then(onLoggedOut,
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

export function softLogout(): void {
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

export function isSoftLogout(): boolean {
    return localStorage.getItem("mx_soft_logout") === "true";
}

export function isLoggingOut(): boolean {
    return _isLoggingOut;
}

/**
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 * @param {boolean} startSyncing True (default) to actually start
 * syncing the client.
 */
async function startMatrixClient(startSyncing = true): Promise<void> {
    console.log(`Lifecycle: Starting MatrixClient`);

    // dispatch this before starting the matrix client: it's used
    // to add listeners for the 'sync' event so otherwise we'd have
    // a race condition (and we need to dispatch synchronously for this
    // to work).
    dis.dispatch({action: 'will_start_client'}, true);

    // reset things first just in case
    TypingStore.sharedInstance().reset();
    ToastStore.sharedInstance().reset();

    Notifier.start();
    UserActivity.sharedInstance().start();
    DMRoomMap.makeShared().start();
    IntegrationManagers.sharedInstance().startWatching();
    ActiveWidgetStore.start();
    CallHandler.sharedInstance().start();

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
    await Jitsi.getInstance().start();

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
export async function onLoggedOut(): Promise<void> {
    _isLoggingOut = false;
    // Ensure that we dispatch a view change **before** stopping the client so
    // so that React components unmount first. This avoids React soft crashes
    // that can occur when components try to use a null client.
    dis.dispatch({action: 'on_logged_out'}, true);
    stopMatrixClient();
    await clearStorage({deleteEverything: true});
    LifecycleCustomisations.onLoggedOutAndStorageCleared?.();
}

/**
 * @param {object} opts Options for how to clear storage.
 * @returns {Promise} promise which resolves once the stores have been cleared
 */
async function clearStorage(opts?: { deleteEverything?: boolean }): Promise<void> {
    Analytics.disable();

    if (window.localStorage) {
        // try to save any 3pid invites from being obliterated
        const pendingInvites = ThreepidInviteStore.instance.getWireInvites();

        window.localStorage.clear();

        try {
            await StorageManager.idbDelete("account", "mx_access_token");
        } catch (e) {}

        // now restore those invites
        if (!opts?.deleteEverything) {
            pendingInvites.forEach(i => {
                const roomId = i.roomId;
                delete i.roomId; // delete to avoid confusing the store
                ThreepidInviteStore.instance.storeInvite(roomId, i);
            });
        }
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
export function stopMatrixClient(unsetClient = true): void {
    Notifier.stop();
    CallHandler.sharedInstance().stop();
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
