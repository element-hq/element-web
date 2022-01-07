/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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

import { logger, PrefixedLogger } from '../../logger';
import { LocalStorageCryptoStore } from './localStorage-crypto-store';
import { MemoryCryptoStore } from './memory-crypto-store';
import * as IndexedDBCryptoStoreBackend from './indexeddb-crypto-store-backend';
import { InvalidCryptoStoreError } from '../../errors';
import * as IndexedDBHelpers from "../../indexeddb-helpers";
import {
    CryptoStore,
    IDeviceData,
    IProblem,
    ISession,
    ISessionInfo,
    IWithheld,
    Mode,
    OutgoingRoomKeyRequest,
} from "./base";
import { IRoomKeyRequestBody } from "../index";
import { ICrossSigningKey } from "../../client";
import { IOlmDevice } from "../algorithms/megolm";
import { IRoomEncryption } from "../RoomList";
import { InboundGroupSessionData } from "../OlmDevice";
import { IEncryptedPayload } from "../aes";

/**
 * Internal module. indexeddb storage for e2e.
 *
 * @module
 */

/**
 * An implementation of CryptoStore, which is normally backed by an indexeddb,
 * but with fallback to MemoryCryptoStore.
 *
 * @implements {module:crypto/store/base~CryptoStore}
 */
export class IndexedDBCryptoStore implements CryptoStore {
    public static STORE_ACCOUNT = 'account';
    public static STORE_SESSIONS = 'sessions';
    public static STORE_INBOUND_GROUP_SESSIONS = 'inbound_group_sessions';
    public static STORE_INBOUND_GROUP_SESSIONS_WITHHELD = 'inbound_group_sessions_withheld';
    public static STORE_SHARED_HISTORY_INBOUND_GROUP_SESSIONS = 'shared_history_inbound_group_sessions';
    public static STORE_DEVICE_DATA = 'device_data';
    public static STORE_ROOMS = 'rooms';
    public static STORE_BACKUP = 'sessions_needing_backup';

    public static exists(indexedDB: IDBFactory, dbName: string): Promise<boolean> {
        return IndexedDBHelpers.exists(indexedDB, dbName);
    }

    private backendPromise: Promise<CryptoStore> = null;
    private backend: CryptoStore = null;

    /**
     * Create a new IndexedDBCryptoStore
     *
     * @param {IDBFactory} indexedDB  global indexedDB instance
     * @param {string} dbName   name of db to connect to
     */
    constructor(private readonly indexedDB: IDBFactory, private readonly dbName: string) {}

    /**
     * Ensure the database exists and is up-to-date, or fall back to
     * a local storage or in-memory store.
     *
     * This must be called before the store can be used.
     *
     * @return {Promise} resolves to either an IndexedDBCryptoStoreBackend.Backend,
     * or a MemoryCryptoStore
     */
    public startup(): Promise<CryptoStore> {
        if (this.backendPromise) {
            return this.backendPromise;
        }

        this.backendPromise = new Promise<CryptoStore>((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('no indexeddb support available'));
                return;
            }

            logger.log(`connecting to indexeddb ${this.dbName}`);

            const req = this.indexedDB.open(this.dbName, IndexedDBCryptoStoreBackend.VERSION);

            req.onupgradeneeded = (ev) => {
                const db = req.result;
                const oldVersion = ev.oldVersion;
                IndexedDBCryptoStoreBackend.upgradeDatabase(db, oldVersion);
            };

            req.onblocked = () => {
                logger.log(
                    `can't yet open IndexedDBCryptoStore because it is open elsewhere`,
                );
            };

            req.onerror = (ev) => {
                logger.log("Error connecting to indexeddb", ev);
                reject(req.error);
            };

            req.onsuccess = () => {
                const db = req.result;

                logger.log(`connected to indexeddb ${this.dbName}`);
                resolve(new IndexedDBCryptoStoreBackend.Backend(db));
            };
        }).then((backend) => {
            // Edge has IndexedDB but doesn't support compund keys which we use fairly extensively.
            // Try a dummy query which will fail if the browser doesn't support compund keys, so
            // we can fall back to a different backend.
            return backend.doTxn(
                'readonly',
                [
                    IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS,
                    IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD,
                ],
                (txn) => {
                    backend.getEndToEndInboundGroupSession('', '', txn, () => {});
                }).then(() => backend,
            );
        }).catch((e) => {
            if (e.name === 'VersionError') {
                logger.warn("Crypto DB is too new for us to use!", e);
                // don't fall back to a different store: the user has crypto data
                // in this db so we should use it or nothing at all.
                throw new InvalidCryptoStoreError(InvalidCryptoStoreError.TOO_NEW);
            }
            logger.warn(
                `unable to connect to indexeddb ${this.dbName}` +
                    `: falling back to localStorage store: ${e}`,
            );

            try {
                return new LocalStorageCryptoStore(global.localStorage);
            } catch (e) {
                logger.warn(
                    `unable to open localStorage: falling back to in-memory store: ${e}`,
                );
                return new MemoryCryptoStore();
            }
        }).then(backend => {
            this.backend = backend;
            return backend as CryptoStore;
        });

        return this.backendPromise;
    }

    /**
     * Delete all data from this store.
     *
     * @returns {Promise} resolves when the store has been cleared.
     */
    public deleteAllData(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.indexedDB) {
                reject(new Error('no indexeddb support available'));
                return;
            }

            logger.log(`Removing indexeddb instance: ${this.dbName}`);
            const req = this.indexedDB.deleteDatabase(this.dbName);

            req.onblocked = () => {
                logger.log(
                    `can't yet delete IndexedDBCryptoStore because it is open elsewhere`,
                );
            };

            req.onerror = (ev) => {
                logger.log("Error deleting data from indexeddb", ev);
                reject(req.error);
            };

            req.onsuccess = () => {
                logger.log(`Removed indexeddb instance: ${this.dbName}`);
                resolve();
            };
        }).catch((e) => {
            // in firefox, with indexedDB disabled, this fails with a
            // DOMError. We treat this as non-fatal, so that people can
            // still use the app.
            logger.warn(`unable to delete IndexedDBCryptoStore: ${e}`);
        });
    }

    /**
     * Look for an existing outgoing room key request, and if none is found,
     * add a new one
     *
     * @param {module:crypto/store/base~OutgoingRoomKeyRequest} request
     *
     * @returns {Promise} resolves to
     *    {@link module:crypto/store/base~OutgoingRoomKeyRequest}: either the
     *    same instance as passed in, or the existing one.
     */
    public getOrAddOutgoingRoomKeyRequest(request: OutgoingRoomKeyRequest): Promise<OutgoingRoomKeyRequest> {
        return this.backend.getOrAddOutgoingRoomKeyRequest(request);
    }

    /**
     * Look for an existing room key request
     *
     * @param {module:crypto~RoomKeyRequestBody} requestBody
     *    existing request to look for
     *
     * @return {Promise} resolves to the matching
     *    {@link module:crypto/store/base~OutgoingRoomKeyRequest}, or null if
     *    not found
     */
    public getOutgoingRoomKeyRequest(requestBody: IRoomKeyRequestBody): Promise<OutgoingRoomKeyRequest | null> {
        return this.backend.getOutgoingRoomKeyRequest(requestBody);
    }

    /**
     * Look for room key requests by state
     *
     * @param {Array<Number>} wantedStates list of acceptable states
     *
     * @return {Promise} resolves to the a
     *    {@link module:crypto/store/base~OutgoingRoomKeyRequest}, or null if
     *    there are no pending requests in those states. If there are multiple
     *    requests in those states, an arbitrary one is chosen.
     */
    public getOutgoingRoomKeyRequestByState(wantedStates: number[]): Promise<OutgoingRoomKeyRequest | null> {
        return this.backend.getOutgoingRoomKeyRequestByState(wantedStates);
    }

    /**
     * Look for room key requests by state –
     * unlike above, return a list of all entries in one state.
     *
     * @param {Number} wantedState
     * @return {Promise<Array<*>>} Returns an array of requests in the given state
     */
    public getAllOutgoingRoomKeyRequestsByState(wantedState: number): Promise<OutgoingRoomKeyRequest[]> {
        return this.backend.getAllOutgoingRoomKeyRequestsByState(wantedState);
    }

    /**
     * Look for room key requests by target device and state
     *
     * @param {string} userId Target user ID
     * @param {string} deviceId Target device ID
     * @param {Array<Number>} wantedStates list of acceptable states
     *
     * @return {Promise} resolves to a list of all the
     *    {@link module:crypto/store/base~OutgoingRoomKeyRequest}
     */
    public getOutgoingRoomKeyRequestsByTarget(
        userId: string,
        deviceId: string,
        wantedStates: number[],
    ): Promise<OutgoingRoomKeyRequest[]> {
        return this.backend.getOutgoingRoomKeyRequestsByTarget(
            userId, deviceId, wantedStates,
        );
    }

    /**
     * Look for an existing room key request by id and state, and update it if
     * found
     *
     * @param {string} requestId      ID of request to update
     * @param {number} expectedState  state we expect to find the request in
     * @param {Object} updates        name/value map of updates to apply
     *
     * @returns {Promise} resolves to
     *    {@link module:crypto/store/base~OutgoingRoomKeyRequest}
     *    updated request, or null if no matching row was found
     */
    public updateOutgoingRoomKeyRequest(
        requestId: string,
        expectedState: number,
        updates: Partial<OutgoingRoomKeyRequest>,
    ): Promise<OutgoingRoomKeyRequest | null> {
        return this.backend.updateOutgoingRoomKeyRequest(
            requestId, expectedState, updates,
        );
    }

    /**
     * Look for an existing room key request by id and state, and delete it if
     * found
     *
     * @param {string} requestId      ID of request to update
     * @param {number} expectedState  state we expect to find the request in
     *
     * @returns {Promise} resolves once the operation is completed
     */
    public deleteOutgoingRoomKeyRequest(
        requestId: string,
        expectedState: number,
    ): Promise<OutgoingRoomKeyRequest | null> {
        return this.backend.deleteOutgoingRoomKeyRequest(requestId, expectedState);
    }

    // Olm Account

    /*
     * Get the account pickle from the store.
     * This requires an active transaction. See doTxn().
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(string)} func Called with the account pickle
     */
    public getAccount(txn: IDBTransaction, func: (accountPickle: string) => void) {
        this.backend.getAccount(txn, func);
    }

    /**
     * Write the account pickle to the store.
     * This requires an active transaction. See doTxn().
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {string} accountPickle The new account pickle to store.
     */
    public storeAccount(txn: IDBTransaction, accountPickle: string): void {
        this.backend.storeAccount(txn, accountPickle);
    }

    /**
     * Get the public part of the cross-signing keys (eg. self-signing key,
     * user signing key).
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(string)} func Called with the account keys object:
     *        { key_type: base64 encoded seed } where key type = user_signing_key_seed or self_signing_key_seed
     */
    public getCrossSigningKeys(txn: IDBTransaction, func: (keys: Record<string, ICrossSigningKey>) => void): void {
        this.backend.getCrossSigningKeys(txn, func);
    }

    /**
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(string)} func Called with the private key
     * @param {string} type A key type
     */
    public getSecretStorePrivateKey(
        txn: IDBTransaction,
        func: (key: IEncryptedPayload | null) => void,
        type: string,
    ): void {
        this.backend.getSecretStorePrivateKey(txn, func, type);
    }

    /**
     * Write the cross-signing keys back to the store
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {string} keys keys object as getCrossSigningKeys()
     */
    public storeCrossSigningKeys(txn: IDBTransaction, keys: Record<string, ICrossSigningKey>): void {
        this.backend.storeCrossSigningKeys(txn, keys);
    }

    /**
     * Write the cross-signing private keys back to the store
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {string} type The type of cross-signing private key to store
     * @param {string} key keys object as getCrossSigningKeys()
     */
    public storeSecretStorePrivateKey(txn: IDBTransaction, type: string, key: IEncryptedPayload): void {
        this.backend.storeSecretStorePrivateKey(txn, type, key);
    }

    // Olm sessions

    /**
     * Returns the number of end-to-end sessions in the store
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(int)} func Called with the count of sessions
     */
    public countEndToEndSessions(txn: IDBTransaction, func: (count: number) => void): void {
        this.backend.countEndToEndSessions(txn, func);
    }

    /**
     * Retrieve a specific end-to-end session between the logged-in user
     * and another device.
     * @param {string} deviceKey The public key of the other device.
     * @param {string} sessionId The ID of the session to retrieve
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(object)} func Called with A map from sessionId
     *     to session information object with 'session' key being the
     *     Base64 end-to-end session and lastReceivedMessageTs being the
     *     timestamp in milliseconds at which the session last received
     *     a message.
     */
    public getEndToEndSession(
        deviceKey: string,
        sessionId: string,
        txn: IDBTransaction,
        func: (sessions: { [ sessionId: string ]: ISessionInfo }) => void,
    ): void {
        this.backend.getEndToEndSession(deviceKey, sessionId, txn, func);
    }

    /**
     * Retrieve the end-to-end sessions between the logged-in user and another
     * device.
     * @param {string} deviceKey The public key of the other device.
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(object)} func Called with A map from sessionId
     *     to session information object with 'session' key being the
     *     Base64 end-to-end session and lastReceivedMessageTs being the
     *     timestamp in milliseconds at which the session last received
     *     a message.
     */
    public getEndToEndSessions(
        deviceKey: string,
        txn: IDBTransaction,
        func: (sessions: { [sessionId: string]: ISessionInfo }) => void,
    ): void {
        this.backend.getEndToEndSessions(deviceKey, txn, func);
    }

    /**
     * Retrieve all end-to-end sessions
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(object)} func Called one for each session with
     *     an object with, deviceKey, lastReceivedMessageTs, sessionId
     *     and session keys.
     */
    public getAllEndToEndSessions(txn: IDBTransaction, func: (session: ISessionInfo) => void): void {
        this.backend.getAllEndToEndSessions(txn, func);
    }

    /**
     * Store a session between the logged-in user and another device
     * @param {string} deviceKey The public key of the other device.
     * @param {string} sessionId The ID for this end-to-end session.
     * @param {string} sessionInfo Session information object
     * @param {*} txn An active transaction. See doTxn().
     */
    public storeEndToEndSession(
        deviceKey: string,
        sessionId: string,
        sessionInfo: ISessionInfo,
        txn: IDBTransaction,
    ): void {
        this.backend.storeEndToEndSession(deviceKey, sessionId, sessionInfo, txn);
    }

    public storeEndToEndSessionProblem(deviceKey: string, type: string, fixed: boolean): Promise<void> {
        return this.backend.storeEndToEndSessionProblem(deviceKey, type, fixed);
    }

    public getEndToEndSessionProblem(deviceKey: string, timestamp: number): Promise<IProblem | null> {
        return this.backend.getEndToEndSessionProblem(deviceKey, timestamp);
    }

    public filterOutNotifiedErrorDevices(devices: IOlmDevice[]): Promise<IOlmDevice[]> {
        return this.backend.filterOutNotifiedErrorDevices(devices);
    }

    // Inbound group sessions

    /**
     * Retrieve the end-to-end inbound group session for a given
     * server key and session ID
     * @param {string} senderCurve25519Key The sender's curve 25519 key
     * @param {string} sessionId The ID of the session
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(object)} func Called with A map from sessionId
     *     to Base64 end-to-end session.
     */
    public getEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        txn: IDBTransaction,
        func: (groupSession: InboundGroupSessionData | null, groupSessionWithheld: IWithheld | null) => void,
    ): void {
        this.backend.getEndToEndInboundGroupSession(senderCurve25519Key, sessionId, txn, func);
    }

    /**
     * Fetches all inbound group sessions in the store
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(object)} func Called once for each group session
     *     in the store with an object having keys {senderKey, sessionId,
     *     sessionData}, then once with null to indicate the end of the list.
     */
    public getAllEndToEndInboundGroupSessions(
        txn: IDBTransaction,
        func: (session: ISession | null) => void,
    ): void {
        this.backend.getAllEndToEndInboundGroupSessions(txn, func);
    }

    /**
     * Adds an end-to-end inbound group session to the store.
     * If there already exists an inbound group session with the same
     * senderCurve25519Key and sessionID, the session will not be added.
     * @param {string} senderCurve25519Key The sender's curve 25519 key
     * @param {string} sessionId The ID of the session
     * @param {object} sessionData The session data structure
     * @param {*} txn An active transaction. See doTxn().
     */
    public addEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: IDBTransaction,
    ): void {
        this.backend.addEndToEndInboundGroupSession(senderCurve25519Key, sessionId, sessionData, txn);
    }

    /**
     * Writes an end-to-end inbound group session to the store.
     * If there already exists an inbound group session with the same
     * senderCurve25519Key and sessionID, it will be overwritten.
     * @param {string} senderCurve25519Key The sender's curve 25519 key
     * @param {string} sessionId The ID of the session
     * @param {object} sessionData The session data structure
     * @param {*} txn An active transaction. See doTxn().
     */
    public storeEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: IDBTransaction,
    ): void {
        this.backend.storeEndToEndInboundGroupSession(senderCurve25519Key, sessionId, sessionData, txn);
    }

    public storeEndToEndInboundGroupSessionWithheld(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: IWithheld,
        txn: IDBTransaction,
    ): void {
        this.backend.storeEndToEndInboundGroupSessionWithheld(senderCurve25519Key, sessionId, sessionData, txn);
    }

    // End-to-end device tracking

    /**
     * Store the state of all tracked devices
     * This contains devices for each user, a tracking state for each user
     * and a sync token matching the point in time the snapshot represents.
     * These all need to be written out in full each time such that the snapshot
     * is always consistent, so they are stored in one object.
     *
     * @param {Object} deviceData
     * @param {*} txn An active transaction. See doTxn().
     */
    public storeEndToEndDeviceData(deviceData: IDeviceData, txn: IDBTransaction): void {
        this.backend.storeEndToEndDeviceData(deviceData, txn);
    }

    /**
     * Get the state of all tracked devices
     *
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(Object)} func Function called with the
     *     device data
     */
    public getEndToEndDeviceData(txn: IDBTransaction, func: (deviceData: IDeviceData | null) => void): void {
        this.backend.getEndToEndDeviceData(txn, func);
    }

    // End to End Rooms

    /**
     * Store the end-to-end state for a room.
     * @param {string} roomId The room's ID.
     * @param {object} roomInfo The end-to-end info for the room.
     * @param {*} txn An active transaction. See doTxn().
     */
    public storeEndToEndRoom(roomId: string, roomInfo: IRoomEncryption, txn: IDBTransaction): void {
        this.backend.storeEndToEndRoom(roomId, roomInfo, txn);
    }

    /**
     * Get an object of roomId->roomInfo for all e2e rooms in the store
     * @param {*} txn An active transaction. See doTxn().
     * @param {function(Object)} func Function called with the end to end encrypted rooms
     */
    public getEndToEndRooms(txn: IDBTransaction, func: (rooms: Record<string, IRoomEncryption>) => void): void {
        this.backend.getEndToEndRooms(txn, func);
    }

    // session backups

    /**
     * Get the inbound group sessions that need to be backed up.
     * @param {number} limit The maximum number of sessions to retrieve.  0
     * for no limit.
     * @returns {Promise} resolves to an array of inbound group sessions
     */
    public getSessionsNeedingBackup(limit: number): Promise<ISession[]> {
        return this.backend.getSessionsNeedingBackup(limit);
    }

    /**
     * Count the inbound group sessions that need to be backed up.
     * @param {*} txn An active transaction. See doTxn(). (optional)
     * @returns {Promise} resolves to the number of sessions
     */
    public countSessionsNeedingBackup(txn?: IDBTransaction): Promise<number> {
        return this.backend.countSessionsNeedingBackup(txn);
    }

    /**
     * Unmark sessions as needing to be backed up.
     * @param {Array<object>} sessions The sessions that need to be backed up.
     * @param {*} txn An active transaction. See doTxn(). (optional)
     * @returns {Promise} resolves when the sessions are unmarked
     */
    public unmarkSessionsNeedingBackup(sessions: ISession[], txn?: IDBTransaction): Promise<void> {
        return this.backend.unmarkSessionsNeedingBackup(sessions, txn);
    }

    /**
     * Mark sessions as needing to be backed up.
     * @param {Array<object>} sessions The sessions that need to be backed up.
     * @param {*} txn An active transaction. See doTxn(). (optional)
     * @returns {Promise} resolves when the sessions are marked
     */
    public markSessionsNeedingBackup(sessions: ISession[], txn?: IDBTransaction): Promise<void> {
        return this.backend.markSessionsNeedingBackup(sessions, txn);
    }

    /**
     * Add a shared-history group session for a room.
     * @param {string} roomId The room that the key belongs to
     * @param {string} senderKey The sender's curve 25519 key
     * @param {string} sessionId The ID of the session
     * @param {*} txn An active transaction. See doTxn(). (optional)
     */
    public addSharedHistoryInboundGroupSession(
        roomId: string,
        senderKey: string,
        sessionId: string,
        txn?: IDBTransaction,
    ): void {
        this.backend.addSharedHistoryInboundGroupSession(roomId, senderKey, sessionId, txn);
    }

    /**
     * Get the shared-history group session for a room.
     * @param {string} roomId The room that the key belongs to
     * @param {*} txn An active transaction. See doTxn(). (optional)
     * @returns {Promise} Resolves to an array of [senderKey, sessionId]
     */
    public getSharedHistoryInboundGroupSessions(
        roomId: string,
        txn?: IDBTransaction,
    ): Promise<[senderKey: string, sessionId: string][]> {
        return this.backend.getSharedHistoryInboundGroupSessions(roomId, txn);
    }

    /**
     * Perform a transaction on the crypto store. Any store methods
     * that require a transaction (txn) object to be passed in may
     * only be called within a callback of either this function or
     * one of the store functions operating on the same transaction.
     *
     * @param {string} mode 'readwrite' if you need to call setter
     *     functions with this transaction. Otherwise, 'readonly'.
     * @param {string[]} stores List IndexedDBCryptoStore.STORE_*
     *     options representing all types of object that will be
     *     accessed or written to with this transaction.
     * @param {function(*)} func Function called with the
     *     transaction object: an opaque object that should be passed
     *     to store functions.
     * @param {Logger} [log] A possibly customised log
     * @return {Promise} Promise that resolves with the result of the `func`
     *     when the transaction is complete. If the backend is
     *     async (ie. the indexeddb backend) any of the callback
     *     functions throwing an exception will cause this promise to
     *     reject with that exception. On synchronous backends, the
     *     exception will propagate to the caller of the getFoo method.
     */
    doTxn<T>(mode: Mode, stores: Iterable<string>, func: (txn: IDBTransaction) => T, log?: PrefixedLogger): Promise<T> {
        return this.backend.doTxn(mode, stores, func, log);
    }
}
