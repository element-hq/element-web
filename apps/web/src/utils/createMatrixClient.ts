/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import {
    type MatrixClient,
    createClient,
    type ICreateClientOpts,
    MemoryCryptoStore,
    MemoryStore,
    IndexedDBCryptoStore,
    IndexedDBStore,
    LocalStorageCryptoStore,
    RoomNameType,
    type RoomNameState,
    EventTimelineSet,
    EventTimeline,
    type OAuth2,
    TokenRefresher,
} from "matrix-js-sdk/src/matrix";
import { VerificationMethod } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import indexeddbWorkerFactory from "../workers/indexeddbWorkerFactory";
import SettingsStore from "../settings/SettingsStore";
import { crossSigningCallbacks } from "../SecurityManager";
import IdentityAuthClient from "../IdentityAuthClient";
import { _t } from "../languageHandler";
import { formatList } from "./FormattingUtils";
import { persistTokens } from "./tokens/tokens.ts";

const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB: IDBFactory;
try {
    indexedDB = window.indexedDB;
} catch {}

/**
 * Credentials used to create a MatrixClient with `createClientWithCreds`.
 */
export interface IMatrixClientCreds {
    homeserverUrl: string;
    identityServerUrl?: string;
    userId: string;
    deviceId?: string;
    accessToken: string;
    refreshToken?: string;
    guest?: boolean;
    pickleKey?: string;
    freshLogin?: boolean;
}

function namesToRoomName(names: string[], count: number): string | undefined {
    const countWithoutMe = count - 1;
    if (!names.length) {
        return _t("empty_room");
    }
    if (names.length === 1 && countWithoutMe <= 1) {
        return names[0];
    }
}

function memberNamesToRoomName(names: string[], count: number): string {
    const name = namesToRoomName(names, count);
    if (name) return name;

    if (names.length === 2 && count === 2) {
        return formatList(names);
    }
    return formatList(names, 1);
}

function inviteeNamesToRoomName(names: string[], count: number): string {
    const name = namesToRoomName(names, count);
    if (name) return name;

    if (names.length === 2 && count === 2) {
        return _t("inviting_user1_and_user2", {
            user1: names[0],
            user2: names[1],
        });
    }
    return _t("inviting_user_and_n_others", {
        user: names[0],
        count: count - 1,
    });
}

function roomNameGenerator(_: string, state: RoomNameState): string | null {
    switch (state.type) {
        case RoomNameType.Generated:
            switch (state.subtype) {
                case "Inviting":
                    return inviteeNamesToRoomName(state.names, state.count);
                default:
                    return memberNamesToRoomName(state.names, state.count);
            }
        case RoomNameType.EmptyRoom:
            if (state.oldName) {
                return _t("empty_room_was_name", {
                    oldName: state.oldName,
                });
            } else {
                return _t("empty_room");
            }
        default:
            return null;
    }
}

/**
 * Create a new matrix client from credentials with all the options needed.
 *
 * @param creds The credentials to create the client with
 * @param oauth The OAuth2 instance for OAuth2-native sessions
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
export function createClientWithCreds(creds: IMatrixClientCreds, oauth?: OAuth2): MatrixClient {
    let tokenRefreshFunction: ICreateClientOpts["tokenRefreshFunction"];
    if (creds.refreshToken && oauth) {
        const tokenRefresher = new TokenRefresher(oauth, persistTokens.bind(null, creds.pickleKey));
        tokenRefreshFunction = tokenRefresher?.tokenRefreshFunction;
    } else {
        logger.debug("No refresh token was supplied: access token will not be refreshed");
    }

    const opts: ICreateClientOpts = {
        baseUrl: creds.homeserverUrl,
        idBaseUrl: creds.identityServerUrl,
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        tokenRefreshFunction,
        userId: creds.userId,
        deviceId: creds.deviceId,
        pickleKey: creds.pickleKey,
        timelineSupport: true,
        forceTURN: !SettingsStore.getValue("webRtcAllowPeerToPeer"),
        fallbackICEServerAllowed: !!SettingsStore.getValue("fallbackICEServerAllowed"),
        // Gather up to 20 ICE candidates when a call arrives: this should be more than we'd
        // ever normally need, so effectively this should make all the gathering happen when
        // the call arrives.
        iceCandidatePoolSize: 20,
        verificationMethods: [VerificationMethod.Sas, VerificationMethod.ShowQrCode, VerificationMethod.Reciprocate],
        identityServer: new IdentityAuthClient(),
        // These are always installed regardless of the labs flag so that cross-signing features
        // can toggle on without reloading and also be accessed immediately after login.
        cryptoCallbacks: { ...crossSigningCallbacks },
        enableEncryptedStateEvents: SettingsStore.getValue("feature_msc4362_encrypted_state_events"),
        unstableMSC1763Retention: SettingsStore.getValue("feature_retention"),
        roomNameGenerator,
    };

    const newCli = createMatrixClient(opts);
    newCli.setGuest(Boolean(creds.guest));

    const notifTimelineSet = new EventTimelineSet(undefined, {
        timelineSupport: true,
        pendingEvents: false,
    });
    // XXX: what is our initial pagination token?! it somehow needs to be synchronised with /sync.
    notifTimelineSet.getLiveTimeline().setPaginationToken("", EventTimeline.BACKWARDS);
    newCli.setNotifTimelineSet(notifTimelineSet);

    return newCli;
}

/**
 * Create a new matrix client, with the persistent stores set up appropriately
 * (using localstorage/indexeddb, etc)
 *
 * @param {Object} opts  options to pass to Matrix.createClient. This will be
 *    extended with `sessionStore` and `store` members.
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
export function createMatrixClient(opts: ICreateClientOpts): MatrixClient {
    const storeOpts: Partial<ICreateClientOpts> = {
        useAuthorizationHeader: true,
    };

    if (indexedDB && localStorage) {
        storeOpts.store = new IndexedDBStore({
            indexedDB: indexedDB,
            dbName: "riot-web-sync",
            localStorage,
            workerFactory: indexeddbWorkerFactory,
        });
    } else if (localStorage) {
        storeOpts.store = new MemoryStore({ localStorage });
    }

    if (indexedDB) {
        storeOpts.cryptoStore = new IndexedDBCryptoStore(indexedDB, "matrix-js-sdk:crypto");
    } else if (localStorage) {
        storeOpts.cryptoStore = new LocalStorageCryptoStore(localStorage);
    } else {
        storeOpts.cryptoStore = new MemoryCryptoStore();
    }

    return createClient({
        ...storeOpts,
        ...opts,
    });
}
