/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd.
Copyright 2017, 2018, 2019 New Vector Ltd
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

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

import { ICreateClientOpts, PendingEventOrdering, RoomNameState, RoomNameType } from "matrix-js-sdk/src/matrix";
import { IStartClientOpts, MatrixClient } from "matrix-js-sdk/src/client";
import { MemoryStore } from "matrix-js-sdk/src/store/memory";
import * as utils from "matrix-js-sdk/src/utils";
import { EventTimeline } from "matrix-js-sdk/src/models/event-timeline";
import { EventTimelineSet } from "matrix-js-sdk/src/models/event-timeline-set";
import { verificationMethods } from "matrix-js-sdk/src/crypto";
import { SHOW_QR_CODE_METHOD } from "matrix-js-sdk/src/crypto/verification/QRCode";
import { logger } from "matrix-js-sdk/src/logger";

import createMatrixClient from "./utils/createMatrixClient";
import SettingsStore from "./settings/SettingsStore";
import MatrixActionCreators from "./actions/MatrixActionCreators";
import Modal from "./Modal";
import MatrixClientBackedSettingsHandler from "./settings/handlers/MatrixClientBackedSettingsHandler";
import * as StorageManager from "./utils/StorageManager";
import IdentityAuthClient from "./IdentityAuthClient";
import { crossSigningCallbacks, tryToUnlockSecretStorageWithDehydrationKey } from "./SecurityManager";
import SecurityCustomisations from "./customisations/Security";
import { SlidingSyncManager } from "./SlidingSyncManager";
import CryptoStoreTooNewDialog from "./components/views/dialogs/CryptoStoreTooNewDialog";
import { _t, UserFriendlyError } from "./languageHandler";
import { SettingLevel } from "./settings/SettingLevel";
import MatrixClientBackedController from "./settings/controllers/MatrixClientBackedController";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import PlatformPeg from "./PlatformPeg";

export interface IMatrixClientCreds {
    homeserverUrl: string;
    identityServerUrl?: string;
    userId: string;
    deviceId?: string;
    accessToken?: string;
    guest?: boolean;
    pickleKey?: string;
    freshLogin?: boolean;
}

/**
 * Holds the current instance of the `MatrixClient` to use across the codebase.
 * Looking for an `MatrixClient`? Just look for the `MatrixClientPeg` on the peg
 * board. "Peg" is the literal meaning of something you hang something on. So
 * you'll find a `MatrixClient` hanging on the `MatrixClientPeg`.
 */
export interface IMatrixClientPeg {
    opts: IStartClientOpts;

    /**
     * Return the server name of the user's homeserver
     * Throws an error if unable to deduce the homeserver name
     * (eg. if the user is not logged in)
     *
     * @returns {string} The homeserver name, if present.
     */
    getHomeserverName(): string | null;

    get(): MatrixClient;
    safeGet(): MatrixClient;
    unset(): void;
    assign(): Promise<any>;
    start(): Promise<any>;

    getCredentials(): IMatrixClientCreds;

    /**
     * If we've registered a user ID we set this to the ID of the
     * user we've just registered. If they then go & log in, we
     * can send them to the welcome user (obviously this doesn't
     * guarantee they'll get a chat with the welcome user).
     *
     * @param {string} uid The user ID of the user we've just registered
     */
    setJustRegisteredUserId(uid: string | null): void;

    /**
     * Returns true if the current user has just been registered by this
     * client as determined by setJustRegisteredUserId()
     *
     * @returns {bool} True if user has just been registered
     */
    currentUserIsJustRegistered(): boolean;

    /**
     * If the current user has been registered by this device then this
     * returns a boolean of whether it was within the last N hours given.
     */
    userRegisteredWithinLastHours(hours: number): boolean;

    /**
     * If the current user has been registered by this device then this
     * returns a boolean of whether it was after a given timestamp.
     */
    userRegisteredAfter(date: Date): boolean;

    /**
     * Replace this MatrixClientPeg's client with a client instance that has
     * homeserver / identity server URLs and active credentials
     *
     * @param {IMatrixClientCreds} creds The new credentials to use.
     */
    replaceUsingCreds(creds: IMatrixClientCreds): void;
}

/**
 * Wrapper object for handling the js-sdk Matrix Client object in the react-sdk
 * Handles the creation/initialisation of client objects.
 * This module provides a singleton instance of this class so the 'current'
 * Matrix Client object is available easily.
 */
class MatrixClientPegClass implements IMatrixClientPeg {
    // These are the default options used when when the
    // client is started in 'start'. These can be altered
    // at any time up to after the 'will_start_client'
    // event is finished processing.
    public opts: IStartClientOpts = {
        initialSyncLimit: 20,
    };

    private matrixClient: MatrixClient | null = null;
    private justRegisteredUserId: string | null = null;

    // the credentials used to init the current client object.
    // used if we tear it down & recreate it with a different store
    private currentClientCreds: IMatrixClientCreds | null = null;

    public get(): MatrixClient {
        return this.matrixClient;
    }

    public safeGet(): MatrixClient {
        if (!this.matrixClient) {
            throw new UserFriendlyError("User is not logged in");
        }
        return this.matrixClient;
    }

    public unset(): void {
        this.matrixClient = null;

        MatrixActionCreators.stop();
    }

    public setJustRegisteredUserId(uid: string | null): void {
        this.justRegisteredUserId = uid;
        if (uid) {
            const registrationTime = Date.now().toString();
            window.localStorage.setItem("mx_registration_time", registrationTime);
        }
    }

    public currentUserIsJustRegistered(): boolean {
        return !!this.matrixClient && this.matrixClient.credentials.userId === this.justRegisteredUserId;
    }

    public userRegisteredWithinLastHours(hours: number): boolean {
        if (hours <= 0) {
            return false;
        }

        try {
            const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time")!, 10);
            const diff = Date.now() - registrationTime;
            return diff / 36e5 <= hours;
        } catch (e) {
            return false;
        }
    }

    public userRegisteredAfter(timestamp: Date): boolean {
        try {
            const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time")!, 10);
            return timestamp.getTime() <= registrationTime;
        } catch (e) {
            return false;
        }
    }

    public replaceUsingCreds(creds: IMatrixClientCreds): void {
        this.currentClientCreds = creds;
        this.createClient(creds);
    }

    private onUnexpectedStoreClose = async (): Promise<void> => {
        if (!this.matrixClient) return;
        this.matrixClient.stopClient(); // stop the client as the database has failed
        this.matrixClient.store.destroy();

        if (!this.matrixClient.isGuest()) {
            // If the user is not a guest then prompt them to reload rather than doing it for them
            // For guests this is likely to happen during e-mail verification as part of registration

            const { finished } = Modal.createDialog(ErrorDialog, {
                title: _t("Database unexpectedly closed"),
                description: _t(
                    "This may be caused by having the app open in multiple tabs or due to clearing browser data.",
                ),
                button: _t("Reload"),
            });
            const [reload] = await finished;
            if (!reload) return;
        }

        PlatformPeg.get()?.reload();
    };

    public async assign(): Promise<any> {
        if (!this.matrixClient) {
            throw new Error("createClient must be called first");
        }

        for (const dbType of ["indexeddb", "memory"]) {
            try {
                const promise = this.matrixClient.store.startup();
                logger.log("MatrixClientPeg: waiting for MatrixClient store to initialise");
                await promise;
                break;
            } catch (err) {
                if (dbType === "indexeddb") {
                    logger.error("Error starting matrixclient store - falling back to memory store", err);
                    this.matrixClient.store = new MemoryStore({
                        localStorage: localStorage,
                    });
                } else {
                    logger.error("Failed to start memory store!", err);
                    throw err;
                }
            }
        }
        this.matrixClient.store.on?.("closed", this.onUnexpectedStoreClose);

        // try to initialise e2e on the new client
        if (!SettingsStore.getValue("lowBandwidth")) {
            await this.initClientCrypto();
        }

        const opts = utils.deepCopy(this.opts);
        // the react sdk doesn't work without this, so don't allow
        opts.pendingEventOrdering = PendingEventOrdering.Detached;
        opts.lazyLoadMembers = true;
        opts.clientWellKnownPollPeriod = 2 * 60 * 60; // 2 hours
        opts.threadSupport = true;

        if (SettingsStore.getValue("feature_sliding_sync")) {
            const proxyUrl = SettingsStore.getValue("feature_sliding_sync_proxy_url");
            if (proxyUrl) {
                logger.log("Activating sliding sync using proxy at ", proxyUrl);
            } else {
                logger.log("Activating sliding sync");
            }
            opts.slidingSync = SlidingSyncManager.instance.configure(
                this.matrixClient,
                proxyUrl || this.matrixClient.baseUrl,
            );
            SlidingSyncManager.instance.startSpidering(100, 50); // 100 rooms at a time, 50ms apart
        }

        // Connect the matrix client to the dispatcher and setting handlers
        MatrixActionCreators.start(this.matrixClient);
        MatrixClientBackedSettingsHandler.matrixClient = this.matrixClient;
        MatrixClientBackedController.matrixClient = this.matrixClient;

        return opts;
    }

    /**
     * Attempt to initialize the crypto layer on a newly-created MatrixClient
     */
    private async initClientCrypto(): Promise<void> {
        if (!this.matrixClient) {
            throw new Error("createClient must be called first");
        }

        const useRustCrypto = SettingsStore.getValue("feature_rust_crypto");

        // we want to make sure that the same crypto implementation is used throughout the lifetime of a device,
        // so persist the setting at the device layer
        // (At some point, we'll allow the user to *enable* the setting via labs, which will migrate their existing
        // device to the rust-sdk implementation, but that won't change anything here).
        await SettingsStore.setValue("feature_rust_crypto", null, SettingLevel.DEVICE, useRustCrypto);

        // Now we can initialise the right crypto impl.
        if (useRustCrypto) {
            await this.matrixClient.initRustCrypto();

            // TODO: device dehydration and whathaveyou
            return;
        }

        // fall back to the libolm layer.
        try {
            // check that we have a version of the js-sdk which includes initCrypto
            if (this.matrixClient.initCrypto) {
                await this.matrixClient.initCrypto();
                this.matrixClient.setCryptoTrustCrossSignedDevices(
                    !SettingsStore.getValue("e2ee.manuallyVerifyAllSessions"),
                );
                await tryToUnlockSecretStorageWithDehydrationKey(this.matrixClient);
                StorageManager.setCryptoInitialised(true);
            }
        } catch (e) {
            if (e instanceof Error && e.name === "InvalidCryptoStoreError") {
                // The js-sdk found a crypto DB too new for it to use
                Modal.createDialog(CryptoStoreTooNewDialog);
            }
            // this can happen for a number of reasons, the most likely being
            // that the olm library was missing. It's not fatal.
            logger.warn("Unable to initialise e2e", e);
        }
    }

    public async start(): Promise<any> {
        const opts = await this.assign();

        logger.log(`MatrixClientPeg: really starting MatrixClient`);
        await this.matrixClient!.startClient(opts);
        logger.log(`MatrixClientPeg: MatrixClient started`);
    }

    public getCredentials(): IMatrixClientCreds {
        if (!this.matrixClient) {
            throw new Error("createClient must be called first");
        }

        let copiedCredentials: IMatrixClientCreds | null = this.currentClientCreds;
        if (this.currentClientCreds?.userId !== this.matrixClient?.credentials?.userId) {
            // cached credentials belong to a different user - don't use them
            copiedCredentials = null;
        }
        return {
            // Copy the cached credentials before overriding what we can.
            ...(copiedCredentials ?? {}),

            homeserverUrl: this.matrixClient.baseUrl,
            identityServerUrl: this.matrixClient.idBaseUrl,
            userId: this.matrixClient.getSafeUserId(),
            deviceId: this.matrixClient.getDeviceId() ?? undefined,
            accessToken: this.matrixClient.getAccessToken() ?? undefined,
            guest: this.matrixClient.isGuest(),
        };
    }

    public getHomeserverName(): string | null {
        if (!this.matrixClient) return null;

        const matches = /^@[^:]+:(.+)$/.exec(this.matrixClient.getSafeUserId());
        if (matches === null || matches.length < 1) {
            throw new Error("Failed to derive homeserver name from user ID!");
        }
        return matches[1];
    }

    private namesToRoomName(names: string[], count: number): string | undefined {
        const countWithoutMe = count - 1;
        if (!names.length) {
            return _t("Empty room");
        }
        if (names.length === 1 && countWithoutMe <= 1) {
            return names[0];
        }
    }

    private memberNamesToRoomName(names: string[], count: number): string {
        const name = this.namesToRoomName(names, count);
        if (name) return name;

        if (names.length === 2 && count === 2) {
            return _t("%(user1)s and %(user2)s", {
                user1: names[0],
                user2: names[1],
            });
        }
        return _t("%(user)s and %(count)s others", {
            user: names[0],
            count: count - 1,
        });
    }

    private inviteeNamesToRoomName(names: string[], count: number): string {
        const name = this.namesToRoomName(names, count);
        if (name) return name;

        if (names.length === 2 && count === 2) {
            return _t("Inviting %(user1)s and %(user2)s", {
                user1: names[0],
                user2: names[1],
            });
        }
        return _t("Inviting %(user)s and %(count)s others", {
            user: names[0],
            count: count - 1,
        });
    }

    private createClient(creds: IMatrixClientCreds): void {
        const opts: ICreateClientOpts = {
            baseUrl: creds.homeserverUrl,
            idBaseUrl: creds.identityServerUrl,
            accessToken: creds.accessToken,
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
            verificationMethods: [
                verificationMethods.SAS,
                SHOW_QR_CODE_METHOD,
                verificationMethods.RECIPROCATE_QR_CODE,
            ],
            identityServer: new IdentityAuthClient(),
            // These are always installed regardless of the labs flag so that cross-signing features
            // can toggle on without reloading and also be accessed immediately after login.
            cryptoCallbacks: { ...crossSigningCallbacks },
            roomNameGenerator: (_: string, state: RoomNameState) => {
                switch (state.type) {
                    case RoomNameType.Generated:
                        switch (state.subtype) {
                            case "Inviting":
                                return this.inviteeNamesToRoomName(state.names, state.count);
                            default:
                                return this.memberNamesToRoomName(state.names, state.count);
                        }
                    case RoomNameType.EmptyRoom:
                        if (state.oldName) {
                            return _t("Empty room (was %(oldName)s)", {
                                oldName: state.oldName,
                            });
                        } else {
                            return _t("Empty room");
                        }
                    default:
                        return null;
                }
            },
        };

        if (SecurityCustomisations.getDehydrationKey) {
            opts.cryptoCallbacks!.getDehydrationKey = SecurityCustomisations.getDehydrationKey;
        }

        this.matrixClient = createMatrixClient(opts);

        // we're going to add eventlisteners for each matrix event tile, so the
        // potential number of event listeners is quite high.
        this.matrixClient.setMaxListeners(500);

        this.matrixClient.setGuest(Boolean(creds.guest));

        const notifTimelineSet = new EventTimelineSet(undefined, {
            timelineSupport: true,
            pendingEvents: false,
        });
        // XXX: what is our initial pagination token?! it somehow needs to be synchronised with /sync.
        notifTimelineSet.getLiveTimeline().setPaginationToken("", EventTimeline.BACKWARDS);
        this.matrixClient.setNotifTimelineSet(notifTimelineSet);
    }
}

/**
 * Note: You should be using a React context with access to a client rather than
 * using this, as in a multi-account world this will not exist!
 */
export const MatrixClientPeg: IMatrixClientPeg = new MatrixClientPegClass();

if (!window.mxMatrixClientPeg) {
    window.mxMatrixClientPeg = MatrixClientPeg;
}
