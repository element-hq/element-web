/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 , 2023 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import {
    createClient,
    type MatrixClient,
    SSOAction,
    type OidcTokenRefresher,
    decodeBase64,
} from "matrix-js-sdk/src/matrix";
import { type AESEncryptedSecretStoragePayload } from "matrix-js-sdk/src/types";
import { type QueryDict } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";

import { type IMatrixClientCreds, MatrixClientPeg, type MatrixClientPegAssignOpts } from "./MatrixClientPeg";
import { ModuleRunner } from "./modules/ModuleRunner";
import EventIndexPeg from "./indexing/EventIndexPeg";
import createMatrixClient from "./utils/createMatrixClient";
import Notifier from "./Notifier";
import UserActivity from "./UserActivity";
import Presence from "./Presence";
import dis from "./dispatcher/dispatcher";
import DMRoomMap from "./utils/DMRoomMap";
import Modal from "./Modal";
import ActiveWidgetStore from "./stores/ActiveWidgetStore";
import PlatformPeg from "./PlatformPeg";
import { sendLoginRequest } from "./Login";
import * as StorageManager from "./utils/StorageManager";
import * as StorageAccess from "./utils/StorageAccess";
import SettingsStore from "./settings/SettingsStore";
import { SettingLevel } from "./settings/SettingLevel";
import ToastStore from "./stores/ToastStore";
import { IntegrationManagers } from "./integrations/IntegrationManagers";
import { Mjolnir } from "./mjolnir/Mjolnir";
import DeviceListener from "./DeviceListener";
import { Jitsi } from "./widgets/Jitsi";
import { SSO_HOMESERVER_URL_KEY, SSO_ID_SERVER_URL_KEY, SSO_IDP_ID_KEY } from "./BasePlatform";
import ThreepidInviteStore from "./stores/ThreepidInviteStore";
import { PosthogAnalytics } from "./PosthogAnalytics";
import LegacyCallHandler from "./LegacyCallHandler";
import LifecycleCustomisations from "./customisations/Lifecycle";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import { _t } from "./languageHandler";
import SessionRestoreErrorDialog from "./components/views/dialogs/SessionRestoreErrorDialog";
import StorageEvictedDialog from "./components/views/dialogs/StorageEvictedDialog";
import { setSentryUser } from "./sentry";
import SdkConfig from "./SdkConfig";
import { DialogOpener } from "./utils/DialogOpener";
import { Action } from "./dispatcher/actions";
import { type OverwriteLoginPayload } from "./dispatcher/payloads/OverwriteLoginPayload";
import { SdkContextClass } from "./contexts/SDKContext";
import { messageForLoginError } from "./utils/ErrorUtils";
import { completeOidcLogin } from "./utils/oidc/authorize";
import { getOidcErrorMessage } from "./utils/oidc/error";
import { type OidcClientStore } from "./stores/oidc/OidcClientStore";
import {
    getStoredOidcClientId,
    getStoredOidcIdTokenClaims,
    getStoredOidcTokenIssuer,
    persistOidcAuthenticatedSettings,
} from "./utils/oidc/persistOidcSettings";
import {
    ACCESS_TOKEN_IV,
    ACCESS_TOKEN_STORAGE_KEY,
    HAS_ACCESS_TOKEN_STORAGE_KEY,
    HAS_REFRESH_TOKEN_STORAGE_KEY,
    persistAccessTokenInStorage,
    persistRefreshTokenInStorage,
    REFRESH_TOKEN_IV,
    REFRESH_TOKEN_STORAGE_KEY,
    tryDecryptToken,
} from "./utils/tokens/tokens";
import { TokenRefresher } from "./utils/oidc/TokenRefresher";
import { checkBrowserSupport } from "./SupportedBrowser";

const HOMESERVER_URL_KEY = "mx_hs_url";
const ID_SERVER_URL_KEY = "mx_is_url";

dis.register((payload) => {
    if (payload.action === Action.TriggerLogout) {
        // noinspection JSIgnoredPromiseFromCall - we don't care if it fails
        onLoggedOut();
    } else if (payload.action === Action.OverwriteLogin) {
        const typed = <OverwriteLoginPayload>payload;
        // Stop the current client before overwriting the login.
        // If not done it might be impossible to clear the storage, as the
        // rust crypto backend might be holding an open connection to the indexeddb store.
        // We also use the `unsetClient` flag to false, because at this point we are
        // already in the logged in flows of the `MatrixChat` component, and it will
        // always expect to have a client (calls to `MatrixClientPeg.safeGet()`).
        // If we unset the client and the component is updated,  the render will fail and unmount everything.
        // (The module dialog closes and fires a `aria_unhide_main_app` that will trigger a re-render)
        stopMatrixClient(false);
        doSetLoggedIn(typed.credentials, true, true).catch((e) => {
            // XXX we might want to fire a new event here to let the app know that the login failed ?
            // The module api could use it to display a message to the user.
            logger.warn("Failed to overwrite login", e);
        });
    }
});

/**
 * This is set to true by {@link #onSessionLockStolen}.
 *
 * It is used in various of the async functions to prevent races where we initialise a client after the lock is stolen.
 */
let sessionLockStolen = false;

// this is exposed solely for unit tests.
export function setSessionLockNotStolen(): void {
    sessionLockStolen = false;
}

/**
 * Handle the session lock being stolen. Stops any active Matrix Client, and aborts any ongoing client initialisation.
 */
export async function onSessionLockStolen(): Promise<void> {
    sessionLockStolen = true;
    stopMatrixClient();
}

/**
 * Check if we still hold the session lock.
 *
 * If not, raises a {@link SessionLockStolenError}.
 */
function checkSessionLock(): void {
    if (sessionLockStolen) {
        throw new SessionLockStolenError("session lock has been released");
    }
}

/** Error type raised by various functions in the Lifecycle workflow if session lock is stolen during execution */
class SessionLockStolenError extends Error {}

interface ILoadSessionOpts {
    enableGuest?: boolean;
    guestHsUrl?: string;
    guestIsUrl?: string;
    ignoreGuest?: boolean;
    defaultDeviceDisplayName?: string;
    fragmentQueryParams?: QueryDict;
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
            logger.warn("Cannot enable guest access: can't determine HS URL to use");
            enableGuest = false;
        }

        if (enableGuest && guestHsUrl && fragmentQueryParams.guest_user_id && fragmentQueryParams.guest_access_token) {
            logger.log("Using guest access credentials");
            return doSetLoggedIn(
                {
                    userId: fragmentQueryParams.guest_user_id as string,
                    accessToken: fragmentQueryParams.guest_access_token as string,
                    homeserverUrl: guestHsUrl,
                    identityServerUrl: guestIsUrl,
                    guest: true,
                },
                true,
                false,
            ).then(() => true);
        }
        const success = await restoreSessionFromStorage({
            ignoreGuest: Boolean(opts.ignoreGuest),
        });
        if (success) {
            return true;
        }
        if (sessionLockStolen) {
            return false;
        }

        if (enableGuest && guestHsUrl) {
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

        // likewise, if the session lock has been stolen while we've been trying to start
        if (sessionLockStolen) {
            return false;
        }

        return handleLoadSessionFailure(e);
    }
}

/**
 * Gets the user ID of the persisted session, if one exists. This does not validate
 * that the user's credentials still work, just that they exist and that a user ID
 * is associated with them. The session is not loaded.
 * @returns {[string, boolean]} The persisted session's owner and whether the stored
 *     session is for a guest user, if an owner exists. If there is no stored session,
 *     return [null, null].
 */
export async function getStoredSessionOwner(): Promise<[string, boolean] | [null, null]> {
    const { hsUrl, userId, hasAccessToken, isGuest } = await getStoredSessionVars();
    return hsUrl && userId && hasAccessToken ? [userId, !!isGuest] : [null, null];
}

/**
 * If query string includes OIDC authorization code flow parameters attempt to login using oidc flow
 * Else, we may be returning from SSO - attempt token login
 *
 * @param {Object} queryParams    string->string map of the
 *     query-parameters extracted from the real query-string of the starting
 *     URI.
 *
 * @param {string} defaultDeviceDisplayName
 * @param {string} fragmentAfterLogin path to go to after a successful login, only used for "Try again"
 *
 * @returns {Promise} promise which resolves to true if we completed the delegated auth login
 *      else false
 */
export async function attemptDelegatedAuthLogin(
    queryParams: QueryDict,
    defaultDeviceDisplayName?: string,
    fragmentAfterLogin?: string,
): Promise<boolean> {
    if (queryParams.code && queryParams.state) {
        console.log("We have OIDC params - attempting OIDC login");
        return attemptOidcNativeLogin(queryParams);
    }

    return attemptTokenLogin(queryParams, defaultDeviceDisplayName, fragmentAfterLogin);
}

/**
 * Attempt to login by completing OIDC authorization code flow
 * @param queryParams string->string map of the query-parameters extracted from the real query-string of the starting URI.
 * @returns Promise that resolves to true when login succceeded, else false
 */
async function attemptOidcNativeLogin(queryParams: QueryDict): Promise<boolean> {
    try {
        const { accessToken, refreshToken, homeserverUrl, identityServerUrl, idToken, clientId, issuer } =
            await completeOidcLogin(queryParams);

        const {
            user_id: userId,
            device_id: deviceId,
            is_guest: isGuest,
        } = await getUserIdFromAccessToken(accessToken, homeserverUrl, identityServerUrl);

        const credentials = {
            accessToken,
            refreshToken,
            homeserverUrl,
            identityServerUrl,
            deviceId,
            userId,
            isGuest,
        };

        logger.debug("Logged in via OIDC native flow");
        await onSuccessfulDelegatedAuthLogin(credentials);
        // this needs to happen after success handler which clears storages
        persistOidcAuthenticatedSettings(clientId, issuer, idToken);
        return true;
    } catch (error) {
        logger.error("Failed to login via OIDC", error);

        await onFailedDelegatedAuthLogin(getOidcErrorMessage(error as Error));
        return false;
    }
}

/**
 * Gets information about the owner of a given access token.
 * @param accessToken
 * @param homeserverUrl
 * @param identityServerUrl
 * @returns Promise that resolves with whoami response
 * @throws when whoami request fails
 */
async function getUserIdFromAccessToken(
    accessToken: string,
    homeserverUrl: string,
    identityServerUrl?: string,
): Promise<ReturnType<MatrixClient["whoami"]>> {
    try {
        const client = createClient({
            baseUrl: homeserverUrl,
            accessToken: accessToken,
            idBaseUrl: identityServerUrl,
        });

        return await client.whoami();
    } catch (error) {
        logger.error("Failed to retrieve userId using accessToken", error);
        throw new Error("Failed to retrieve userId using accessToken");
    }
}

/**
 * @param {QueryDict} queryParams    string->string map of the
 *     query-parameters extracted from the real query-string of the starting
 *     URI.
 *
 * @param {string} defaultDeviceDisplayName
 * @param {string} fragmentAfterLogin path to go to after a successful login, only used for "Try again"
 *
 * @returns {Promise} promise which resolves to true if we completed the token
 *    login, else false
 */
export function attemptTokenLogin(
    queryParams: QueryDict,
    defaultDeviceDisplayName?: string,
    fragmentAfterLogin?: string,
): Promise<boolean> {
    if (!queryParams.loginToken) {
        return Promise.resolve(false);
    }

    console.log("We have token login params - attempting token login");

    const homeserver = localStorage.getItem(SSO_HOMESERVER_URL_KEY);
    const identityServer = localStorage.getItem(SSO_ID_SERVER_URL_KEY) ?? undefined;
    if (!homeserver) {
        logger.warn("Cannot log in with token: can't determine HS URL to use");
        onFailedDelegatedAuthLogin(_t("auth|sso_failed_missing_storage"));
        return Promise.resolve(false);
    }

    return sendLoginRequest(homeserver, identityServer, "m.login.token", {
        token: queryParams.loginToken as string,
        initial_device_display_name: defaultDeviceDisplayName,
    })
        .then(async function (creds) {
            logger.log("Logged in with token");
            await onSuccessfulDelegatedAuthLogin(creds);
            return true;
        })
        .catch((error) => {
            const tryAgainCallback: TryAgainFunction = () => {
                const cli = createClient({
                    baseUrl: homeserver,
                    idBaseUrl: identityServer,
                });
                const idpId = localStorage.getItem(SSO_IDP_ID_KEY) || undefined;
                PlatformPeg.get()?.startSingleSignOn(cli, "sso", fragmentAfterLogin, idpId, SSOAction.LOGIN);
            };
            onFailedDelegatedAuthLogin(
                messageForLoginError(error, {
                    hsUrl: homeserver,
                    hsName: homeserver,
                }),
                tryAgainCallback,
            );
            logger.error("Failed to log in with login token:", error);
            return false;
        });
}

/**
 * Called after a successful token login or OIDC authorization.
 * Clear storage then save new credentials in storage
 * @param credentials as returned from login
 */
async function onSuccessfulDelegatedAuthLogin(credentials: IMatrixClientCreds): Promise<void> {
    await clearStorage();
    await persistCredentials(credentials);

    // remember that we just logged in
    sessionStorage.setItem("mx_fresh_login", String(true));
}

type TryAgainFunction = () => void;

/**
 * Display a friendly error to the user when token login or OIDC authorization fails
 * @param description error description
 * @param tryAgain OPTIONAL function to call on try again button from error dialog
 */
async function onFailedDelegatedAuthLogin(description: string | ReactNode, tryAgain?: TryAgainFunction): Promise<void> {
    Modal.createDialog(ErrorDialog, {
        title: _t("auth|oidc|error_title"),
        description,
        button: _t("action|try_again"),
        // if we have a tryAgain callback, call it the primary 'try again' button was clicked in the dialog
        onFinished: tryAgain ? (shouldTryAgain?: boolean) => shouldTryAgain && tryAgain() : undefined,
    });
}

function registerAsGuest(hsUrl: string, isUrl?: string, defaultDeviceDisplayName?: string): Promise<boolean> {
    logger.log(`Doing guest login on ${hsUrl}`);

    // create a temporary MatrixClient to do the login
    const client = createClient({
        baseUrl: hsUrl,
    });

    return client
        .registerGuest({
            body: {
                initial_device_display_name: defaultDeviceDisplayName,
            },
        })
        .then(
            (creds) => {
                logger.log(`Registered as guest: ${creds.user_id}`);
                return doSetLoggedIn(
                    {
                        userId: creds.user_id,
                        deviceId: creds.device_id,
                        accessToken: creds.access_token!,
                        homeserverUrl: hsUrl,
                        identityServerUrl: isUrl,
                        guest: true,
                    },
                    true,
                    true,
                ).then(() => true);
            },
            (err) => {
                logger.error("Failed to register as guest", err);
                return false;
            },
        );
}

export interface IStoredSession {
    hsUrl: string;
    isUrl: string;
    hasAccessToken: boolean;
    accessToken: string | AESEncryptedSecretStoragePayload;
    hasRefreshToken: boolean;
    refreshToken?: string | AESEncryptedSecretStoragePayload;
    userId: string;
    deviceId: string;
    isGuest: boolean;
}

/**
 * Retrieve a token, as stored by `persistCredentials`
 * Attempts to migrate token from localStorage to idb
 * @param storageKey key used to store the token, eg ACCESS_TOKEN_STORAGE_KEY
 * @returns Promise that resolves to token or undefined
 */
async function getStoredToken(storageKey: string): Promise<string | undefined> {
    let token: string | undefined;
    try {
        token = await StorageAccess.idbLoad("account", storageKey);
    } catch (e) {
        logger.error(`StorageManager.idbLoad failed for account:${storageKey}`, e);
    }
    if (!token) {
        token = localStorage.getItem(storageKey) ?? undefined;
        if (token) {
            try {
                // try to migrate access token to IndexedDB if we can
                await StorageAccess.idbSave("account", storageKey, token);
                localStorage.removeItem(storageKey);
            } catch (e) {
                logger.error(`migration of token ${storageKey} to IndexedDB failed`, e);
            }
        }
    }
    return token;
}

/**
 * Retrieves information about the stored session from the browser's storage. The session
 * may not be valid, as it is not tested for consistency here.
 * @returns {Object} Information about the session - see implementation for variables.
 */
export async function getStoredSessionVars(): Promise<Partial<IStoredSession>> {
    const hsUrl = localStorage.getItem(HOMESERVER_URL_KEY) ?? undefined;
    const isUrl = localStorage.getItem(ID_SERVER_URL_KEY) ?? undefined;

    const accessToken = await getStoredToken(ACCESS_TOKEN_STORAGE_KEY);
    const refreshToken = await getStoredToken(REFRESH_TOKEN_STORAGE_KEY);

    // if we pre-date storing "mx_has_access_token", but we retrieved an access
    // token, then we should say we have an access token
    const hasAccessToken = localStorage.getItem(HAS_ACCESS_TOKEN_STORAGE_KEY) === "true" || !!accessToken;
    const hasRefreshToken = localStorage.getItem(HAS_REFRESH_TOKEN_STORAGE_KEY) === "true" || !!refreshToken;
    const userId = localStorage.getItem("mx_user_id") ?? undefined;
    const deviceId = localStorage.getItem("mx_device_id") ?? undefined;

    let isGuest: boolean;
    if (localStorage.getItem("mx_is_guest") !== null) {
        isGuest = localStorage.getItem("mx_is_guest") === "true";
    } else {
        // legacy key name
        isGuest = localStorage.getItem("matrix-is-guest") === "true";
    }

    return { hsUrl, isUrl, hasAccessToken, accessToken, refreshToken, hasRefreshToken, userId, deviceId, isGuest };
}

async function abortLogin(): Promise<void> {
    const signOut = await showStorageEvictedDialog();
    if (signOut) {
        await clearStorage();
        // This error feels a bit clunky, but we want to make sure we don't go any
        // further and instead head back to sign in.
        throw new AbortLoginAndRebuildStorage("Aborting login in progress because of storage inconsistency");
    }
}

/** Attempt to restore the session from localStorage or indexeddb.
 *
 * @returns true if a session was found; false if no existing session was found.
 *
 * N.B. Lifecycle.js should not maintain any further localStorage state, we
 *      are moving towards using SessionStore to keep track of state related
 *      to the current session (which is typically backed by localStorage).
 *
 *      The plan is to gradually move the localStorage access done here into
 *      SessionStore to avoid bugs where the view becomes out-of-sync with
 *      localStorage (e.g. isGuest etc.)
 */
export async function restoreSessionFromStorage(opts?: { ignoreGuest?: boolean }): Promise<boolean> {
    const ignoreGuest = opts?.ignoreGuest;

    if (!localStorage) {
        return false;
    }

    const { hsUrl, isUrl, hasAccessToken, accessToken, refreshToken, userId, deviceId, isGuest } =
        await getStoredSessionVars();

    if (hasAccessToken && !accessToken) {
        await abortLogin();
    }

    if (accessToken && userId && hsUrl) {
        if (ignoreGuest && isGuest) {
            logger.log("Ignoring stored guest account: " + userId);
            return false;
        }

        const pickleKey = (await PlatformPeg.get()?.getPickleKey(userId, deviceId ?? "")) ?? undefined;
        if (pickleKey) {
            logger.log(`Got pickle key for ${userId}|${deviceId}`);
        } else {
            logger.log(`No pickle key available for ${userId}|${deviceId}`);
        }
        const decryptedAccessToken = await tryDecryptToken(pickleKey, accessToken, ACCESS_TOKEN_IV);
        const decryptedRefreshToken =
            refreshToken && (await tryDecryptToken(pickleKey, refreshToken, REFRESH_TOKEN_IV));

        const freshLogin = sessionStorage.getItem("mx_fresh_login") === "true";
        sessionStorage.removeItem("mx_fresh_login");

        logger.log(`Restoring session for ${userId}`);
        await doSetLoggedIn(
            {
                userId: userId,
                deviceId: deviceId,
                accessToken: decryptedAccessToken,
                refreshToken: decryptedRefreshToken,
                homeserverUrl: hsUrl,
                identityServerUrl: isUrl,
                guest: isGuest,
                pickleKey: pickleKey ?? undefined,
                freshLogin: freshLogin,
            },
            false,
            false,
        );
        return true;
    } else {
        logger.log("No previous session found.");
        return false;
    }
}

async function handleLoadSessionFailure(e: unknown): Promise<boolean> {
    logger.error("Unable to load session", e);

    const modal = Modal.createDialog(SessionRestoreErrorDialog, {
        error: e,
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
 * @param {IMatrixClientCreds} credentials The credentials to use
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
export async function setLoggedIn(credentials: IMatrixClientCreds): Promise<MatrixClient> {
    credentials.freshLogin = true;
    stopMatrixClient();
    const pickleKey =
        credentials.userId && credentials.deviceId
            ? await PlatformPeg.get()?.createPickleKey(credentials.userId, credentials.deviceId)
            : null;

    if (pickleKey) {
        logger.log(`Created pickle key for ${credentials.userId}|${credentials.deviceId}`);
    } else {
        logger.log("Pickle key not created");
    }

    return doSetLoggedIn({ ...credentials, pickleKey: pickleKey ?? undefined }, true, true);
}

/**
 * When we have a authenticated via OIDC-native flow and have a refresh token
 * try to create a token refresher.
 * @param credentials from current session
 * @returns Promise that resolves to a TokenRefresher, or undefined
 */
async function createOidcTokenRefresher(credentials: IMatrixClientCreds): Promise<OidcTokenRefresher | undefined> {
    if (!credentials.refreshToken) {
        return;
    }
    // stored token issuer indicates we authenticated via OIDC-native flow
    const tokenIssuer = getStoredOidcTokenIssuer();
    if (!tokenIssuer) {
        return;
    }
    try {
        const clientId = getStoredOidcClientId();
        const idTokenClaims = getStoredOidcIdTokenClaims();
        const redirectUri = PlatformPeg.get()!.getOidcCallbackUrl().href;
        const deviceId = credentials.deviceId;
        if (!deviceId) {
            throw new Error("Expected deviceId in user credentials.");
        }
        const tokenRefresher = new TokenRefresher(
            tokenIssuer,
            clientId,
            redirectUri,
            deviceId,
            idTokenClaims!,
            credentials.userId,
        );
        // wait for the OIDC client to initialise
        await tokenRefresher.oidcClientReady;
        return tokenRefresher;
    } catch (error) {
        logger.error("Failed to initialise OIDC token refresher", error);
    }
}

/**
 * optionally clears localstorage, persists new credentials
 * to localstorage, starts the new client.
 *
 * @param {IMatrixClientCreds} credentials The credentials to use
 * @param {Boolean} clearStorageEnabled True to clear storage before starting the new client
 * @param {Boolean} isFreshLogin True if this is a fresh login, false if it is previous session being restored
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
async function doSetLoggedIn(
    credentials: IMatrixClientCreds,
    clearStorageEnabled: boolean,
    isFreshLogin: boolean,
): Promise<MatrixClient> {
    checkSessionLock();
    credentials.guest = Boolean(credentials.guest);

    const softLogout = isSoftLogout();

    logger.log(
        "setLoggedIn: mxid: " +
            credentials.userId +
            " deviceId: " +
            credentials.deviceId +
            " guest: " +
            credentials.guest +
            " hs: " +
            credentials.homeserverUrl +
            " softLogout: " +
            softLogout,
        " freshLogin: " + credentials.freshLogin,
    );

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

    const tokenRefresher = await createOidcTokenRefresher(credentials);

    // check the session lock just before creating the new client
    checkSessionLock();
    MatrixClientPeg.replaceUsingCreds(credentials, tokenRefresher?.doRefreshAccessToken.bind(tokenRefresher));
    const client = MatrixClientPeg.safeGet();

    setSentryUser(credentials.userId);

    if (PosthogAnalytics.instance.isEnabled()) {
        PosthogAnalytics.instance.startListeningToSettingsChanges(client);
    }

    if (localStorage) {
        try {
            await persistCredentials(credentials);
            // make sure we don't think that it's a fresh login any more
            sessionStorage.removeItem("mx_fresh_login");
        } catch (e) {
            logger.warn("Error using local storage: can't persist session!", e);
        }
    } else {
        logger.warn("No local storage available: can't persist session!");
    }
    checkSessionLock();

    // We are now logged in, so fire this. We have yet to start the client but the
    // client_started dispatch is for that.
    dis.fire(Action.OnLoggedIn);

    const clientPegOpts: MatrixClientPegAssignOpts = {};
    if (credentials.pickleKey) {
        // The pickleKey, if provided, is probably a base64-encoded 256-bit key, so can be used for the crypto store.
        if (credentials.pickleKey.length === 43) {
            clientPegOpts.rustCryptoStoreKey = decodeBase64(credentials.pickleKey);
        } else {
            // We have some legacy pickle key. Continue using it as a password.
            clientPegOpts.rustCryptoStorePassword = credentials.pickleKey;
        }
    }

    try {
        await startMatrixClient(client, /*startSyncing=*/ !softLogout, clientPegOpts);
    } finally {
        clientPegOpts.rustCryptoStoreKey?.fill(0);
    }

    // Run the migrations after the MatrixClientPeg has been assigned
    SettingsStore.runMigrations(isFreshLogin);

    if (isFreshLogin && !credentials.guest) {
        // For newly registered users, set a flag so that we force them to verify,
        // (we don't want to force users with existing sessions to verify though)
        localStorage.setItem("must_verify_device", "true");
    }

    return client;
}

async function showStorageEvictedDialog(): Promise<boolean> {
    const { finished } = Modal.createDialog(StorageEvictedDialog);
    const [ok] = await finished;
    return !!ok;
}

// Note: Babel 6 requires the `transform-builtin-extend` plugin for this to satisfy
// `instanceof`. Babel 7 supports this natively in their class handling.
class AbortLoginAndRebuildStorage extends Error {}

async function persistCredentials(credentials: IMatrixClientCreds): Promise<void> {
    localStorage.setItem(HOMESERVER_URL_KEY, credentials.homeserverUrl);
    if (credentials.identityServerUrl) {
        localStorage.setItem(ID_SERVER_URL_KEY, credentials.identityServerUrl);
    }
    localStorage.setItem("mx_user_id", credentials.userId);
    localStorage.setItem("mx_is_guest", JSON.stringify(credentials.guest));

    await persistAccessTokenInStorage(credentials.accessToken, credentials.pickleKey);
    await persistRefreshTokenInStorage(credentials.refreshToken, credentials.pickleKey);

    if (credentials.pickleKey) {
        localStorage.setItem("mx_has_pickle_key", String(true));
    } else {
        if (localStorage.getItem("mx_has_pickle_key") === "true") {
            logger.error("Expected a pickle key, but none provided.  Encryption may not work.");
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

    ModuleRunner.instance.extensions.cryptoSetup?.persistCredentials(credentials);

    logger.log(`Session persisted for ${credentials.userId}`);
}

let _isLoggingOut = false;

/**
 * Logs out the current session.
 * When user has authenticated using OIDC native flow revoke tokens with OIDC provider.
 * Otherwise, call /logout on the homeserver.
 * @param client
 * @param oidcClientStore
 */
async function doLogout(client: MatrixClient, oidcClientStore?: OidcClientStore): Promise<void> {
    if (oidcClientStore?.isUserAuthenticatedWithOidc) {
        const accessToken = client.getAccessToken() ?? undefined;
        const refreshToken = client.getRefreshToken() ?? undefined;

        await oidcClientStore.revokeTokens(accessToken, refreshToken);
    } else {
        await client.logout(true);
    }
}

/**
 * Logs the current session out and transitions to the logged-out state
 * @param oidcClientStore store instance from SDKContext
 */
export function logout(oidcClientStore?: OidcClientStore): void {
    const client = MatrixClientPeg.get();
    if (!client) return;

    PosthogAnalytics.instance.logout();

    if (client.isGuest()) {
        // logout doesn't work for guest sessions
        // Also we sometimes want to re-log in a guest session if we abort the login.
        // defer until next tick because it calls a synchronous dispatch, and we are likely here from a dispatch.
        setTimeout(onLoggedOut, 0);
        return;
    }

    _isLoggingOut = true;
    PlatformPeg.get()?.destroyPickleKey(client.getSafeUserId(), client.getDeviceId() ?? "");

    doLogout(client, oidcClientStore).then(onLoggedOut, (err) => {
        // Just throwing an error here is going to be very unhelpful
        // if you're trying to log out because your server's down and
        // you want to log into a different server, so just forget the
        // access token. It's annoying that this will leave the access
        // token still valid, but we should fix this by having access
        // tokens expire (and if you really think you've been compromised,
        // change your password).
        logger.warn("Failed to call logout API: token will not be invalidated", err);
        onLoggedOut();
    });
}

export function softLogout(): void {
    if (!MatrixClientPeg.get()) return;

    // Track that we've detected and trapped a soft logout. This helps prevent other
    // parts of the app from starting if there's no point (ie: don't sync if we've
    // been soft logged out, despite having credentials and data for a MatrixClient).
    localStorage.setItem("mx_soft_logout", "true");

    // Dev note: please keep this log line around. It can be useful for track down
    // random clients stopping in the middle of the logs.
    logger.log("Soft logout initiated");
    _isLoggingOut = true; // to avoid repeated flags
    // Ensure that we dispatch a view change **before** stopping the client so
    // so that React components unmount first. This avoids React soft crashes
    // that can occur when components try to use a null client.
    dis.dispatch({ action: "on_client_not_viable" }); // generic version of on_logged_out
    stopMatrixClient(/*unsetClient=*/ false);

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
 *
 * @param client the matrix client to start
 * @param startSyncing - `true` to actually start syncing the client.
 * @param clientPegOpts - Options to pass through to {@link MatrixClientPeg.start}.
 */
async function startMatrixClient(
    client: MatrixClient,
    startSyncing: boolean,
    clientPegOpts: MatrixClientPegAssignOpts,
): Promise<void> {
    logger.log(`Lifecycle: Starting MatrixClient`);

    // dispatch this before starting the matrix client: it's used
    // to add listeners for the 'sync' event so otherwise we'd have
    // a race condition (and we need to dispatch synchronously for this
    // to work).
    dis.dispatch({ action: "will_start_client" }, true);

    // reset things first just in case
    SdkContextClass.instance.typingStore.reset();
    ToastStore.sharedInstance().reset();

    DialogOpener.instance.prepare(client);
    Notifier.start();
    UserActivity.sharedInstance().start();
    DMRoomMap.makeShared(client).start();
    IntegrationManagers.sharedInstance().startWatching();
    ActiveWidgetStore.instance.start();
    LegacyCallHandler.instance.start();
    checkBrowserSupport();

    // Start Mjolnir even though we haven't checked the feature flag yet. Starting
    // the thing just wastes CPU cycles, but should result in no actual functionality
    // being exposed to the user.
    Mjolnir.sharedInstance().start();

    if (startSyncing) {
        // The client might want to populate some views with events from the
        // index (e.g. the FilePanel), therefore initialize the event index
        // before the client.
        await EventIndexPeg.init();
        await MatrixClientPeg.start(clientPegOpts);
    } else {
        logger.warn("Caller requested only auxiliary services be started");
        await MatrixClientPeg.assign(clientPegOpts);
    }

    checkSessionLock();

    // This needs to be started after crypto is set up
    DeviceListener.sharedInstance().start(client);
    // Similarly, don't start sending presence updates until we've started
    // the client
    if (!SettingsStore.getValue("lowBandwidth")) {
        Presence.start();
    }

    // Now that we have a MatrixClientPeg, update the Jitsi info
    Jitsi.getInstance().start();

    // dispatch that we finished starting up to wire up any other bits
    // of the matrix client that cannot be set prior to starting up.
    dis.dispatch({ action: "client_started" });

    if (isSoftLogout()) {
        softLogout();
    }
}

/*
 * Stops a running client and all related services, and clears persistent
 * storage. Used after a session has been logged out.
 */
export async function onLoggedOut(): Promise<void> {
    // Ensure that we dispatch a view change **before** stopping the client,
    // that React components unmount first. This avoids React soft crashes
    // that can occur when components try to use a null client.
    dis.fire(Action.OnLoggedOut, true);
    stopMatrixClient();
    await clearStorage({ deleteEverything: true });
    LifecycleCustomisations.onLoggedOutAndStorageCleared?.();
    await PlatformPeg.get()?.clearStorage();
    SettingsStore.reset();

    // Do this last, so we can make sure all storage has been cleared and all
    // customisations got the memo.
    if (SdkConfig.get().logout_redirect_url) {
        logger.log("Redirecting to external provider to finish logout");
        // XXX: Defer this so that it doesn't race with MatrixChat unmounting the world by going to /#/login
        window.setTimeout(() => {
            window.location.href = SdkConfig.get().logout_redirect_url!;
        }, 100);
    }
    // Do this last to prevent racing `stopMatrixClient` and `on_logged_out` with MatrixChat handling Session.logged_out
    _isLoggingOut = false;
}

/**
 * @param {object} opts Options for how to clear storage.
 * @returns {Promise} promise which resolves once the stores have been cleared
 */
async function clearStorage(opts?: { deleteEverything?: boolean }): Promise<void> {
    if (window.localStorage) {
        // get the currently defined device language, if set, so we can restore it later
        const language = SettingsStore.getValueAt(SettingLevel.DEVICE, "language", null, true, true);

        // try to save any 3pid invites from being obliterated and registration time
        const pendingInvites = ThreepidInviteStore.instance.getWireInvites();
        const registrationTime = window.localStorage.getItem("mx_registration_time");

        window.localStorage.clear();

        try {
            await StorageAccess.idbClear("account");
        } catch (e) {
            logger.error("idbClear failed for account", e);
        }

        // now restore those invites, registration time and previously set device language
        if (!opts?.deleteEverything) {
            if (language) {
                await SettingsStore.setValue("language", null, SettingLevel.DEVICE, language);
            }

            pendingInvites.forEach(({ roomId, ...invite }) => {
                ThreepidInviteStore.instance.storeInvite(roomId, invite);
            });

            if (registrationTime) {
                window.localStorage.setItem("mx_registration_time", registrationTime);
            }
        }
    }

    window.sessionStorage?.clear();

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
    LegacyCallHandler.instance.stop();
    UserActivity.sharedInstance().stop();
    SdkContextClass.instance.typingStore.reset();
    Presence.stop();
    ActiveWidgetStore.instance.stop();
    IntegrationManagers.sharedInstance().stopWatching();
    Mjolnir.sharedInstance().stop();
    DeviceListener.sharedInstance().stop();
    DMRoomMap.shared()?.stop();
    EventIndexPeg.stop();
    const cli = MatrixClientPeg.get();
    if (cli) {
        cli.stopClient();
        cli.removeAllListeners();

        if (unsetClient) {
            MatrixClientPeg.unset();
            EventIndexPeg.unset();
            cli.store.destroy();
        }
    }
}

// Utility method to perform a login with an existing access_token
window.mxLoginWithAccessToken = async (hsUrl: string, accessToken: string): Promise<void> => {
    const tempClient = createClient({
        baseUrl: hsUrl,
        accessToken,
    });
    const { user_id: userId } = await tempClient.whoami();
    await doSetLoggedIn(
        {
            homeserverUrl: hsUrl,
            accessToken,
            userId,
        },
        true,
        false,
    );
};
