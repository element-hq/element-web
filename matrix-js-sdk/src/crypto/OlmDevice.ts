/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import { Account, InboundGroupSession, OutboundGroupSession, Session, Utility } from "@matrix-org/olm";

import { logger, PrefixedLogger } from "../logger";
import { IndexedDBCryptoStore } from "./store/indexeddb-crypto-store";
import * as algorithms from "./algorithms";
import { CryptoStore, IProblem, ISessionInfo, IWithheld } from "./store/base";
import { IOlmDevice, IOutboundGroupSessionKey } from "./algorithms/megolm";
import { IMegolmSessionData, OlmGroupSessionExtraData } from "../@types/crypto";
import { IMessage } from "./algorithms/olm";

// The maximum size of an event is 65K, and we base64 the content, so this is a
// reasonable approximation to the biggest plaintext we can encrypt.
const MAX_PLAINTEXT_LENGTH = (65536 * 3) / 4;

export class PayloadTooLargeError extends Error {
    public readonly data = {
        errcode: "M_TOO_LARGE",
        error: "Payload too large for encrypted message",
    };
}

function checkPayloadLength(payloadString: string): void {
    if (payloadString === undefined) {
        throw new Error("payloadString undefined");
    }

    if (payloadString.length > MAX_PLAINTEXT_LENGTH) {
        // might as well fail early here rather than letting the olm library throw
        // a cryptic memory allocation error.
        //
        // Note that even if we manage to do the encryption, the message send may fail,
        // because by the time we've wrapped the ciphertext in the event object, it may
        // exceed 65K. But at least we won't just fail with "abort()" in that case.
        throw new PayloadTooLargeError(
            `Message too long (${payloadString.length} bytes). ` +
                `The maximum for an encrypted message is ${MAX_PLAINTEXT_LENGTH} bytes.`,
        );
    }
}

interface IInitOpts {
    fromExportedDevice?: IExportedDevice;
    pickleKey?: string;
}

/** data stored in the session store about an inbound group session */
export interface InboundGroupSessionData {
    room_id: string; // eslint-disable-line camelcase
    /** pickled Olm.InboundGroupSession */
    session: string;
    keysClaimed: Record<string, string>;
    /** Devices involved in forwarding this session to us (normally empty). */
    forwardingCurve25519KeyChain: string[];
    /** whether this session is untrusted. */
    untrusted?: boolean;
    /** whether this session exists during the room being set to shared history. */
    sharedHistory?: boolean;
}

export interface IDecryptedGroupMessage {
    result: string;
    keysClaimed: Record<string, string>;
    senderKey: string;
    forwardingCurve25519KeyChain: string[];
    untrusted: boolean;
}

export interface IInboundSession {
    payload: string;
    session_id: string;
}

export interface IExportedDevice {
    pickleKey: string;
    pickledAccount: string;
    sessions: ISessionInfo[];
}

interface IUnpickledSessionInfo extends Omit<ISessionInfo, "session"> {
    session: Session;
}

/* eslint-disable camelcase */
interface IInboundGroupSessionKey {
    chain_index: number;
    key: string;
    forwarding_curve25519_key_chain: string[];
    sender_claimed_ed25519_key: string | null;
    shared_history: boolean;
    untrusted?: boolean;
}
/* eslint-enable camelcase */

type OneTimeKeys = { curve25519: { [keyId: string]: string } };

/**
 * Manages the olm cryptography functions. Each OlmDevice has a single
 * OlmAccount and a number of OlmSessions.
 *
 * Accounts and sessions are kept pickled in the cryptoStore.
 */
export class OlmDevice {
    public pickleKey = "DEFAULT_KEY"; // set by consumers

    /** Curve25519 key for the account, unknown until we load the account from storage in init() */
    public deviceCurve25519Key: string | null = null;
    /** Ed25519 key for the account, unknown until we load the account from storage in init() */
    public deviceEd25519Key: string | null = null;
    private maxOneTimeKeys: number | null = null;

    // we don't bother stashing outboundgroupsessions in the cryptoStore -
    // instead we keep them here.
    private outboundGroupSessionStore: Record<string, string> = {};

    // Store a set of decrypted message indexes for each group session.
    // This partially mitigates a replay attack where a MITM resends a group
    // message into the room.
    //
    // When we decrypt a message and the message index matches a previously
    // decrypted message, one possible cause of that is that we are decrypting
    // the same event, and may not indicate an actual replay attack.  For
    // example, this could happen if we receive events, forget about them, and
    // then re-fetch them when we backfill.  So we store the event ID and
    // timestamp corresponding to each message index when we first decrypt it,
    // and compare these against the event ID and timestamp every time we use
    // that same index.  If they match, then we're probably decrypting the same
    // event and we don't consider it a replay attack.
    //
    // Keys are strings of form "<senderKey>|<session_id>|<message_index>"
    // Values are objects of the form "{id: <event id>, timestamp: <ts>}"
    private inboundGroupSessionMessageIndexes: Record<string, { id: string; timestamp: number }> = {};

    // Keep track of sessions that we're starting, so that we don't start
    // multiple sessions for the same device at the same time.
    public sessionsInProgress: Record<string, Promise<void>> = {}; // set by consumers

    // Used by olm to serialise prekey message decryptions
    public olmPrekeyPromise: Promise<any> = Promise.resolve(); // set by consumers

    public constructor(private readonly cryptoStore: CryptoStore) {}

    /**
     * @returns The version of Olm.
     */
    public static getOlmVersion(): [number, number, number] {
        return global.Olm.get_library_version();
    }

    /**
     * Initialise the OlmAccount. This must be called before any other operations
     * on the OlmDevice.
     *
     * Data from an exported Olm device can be provided
     * in order to re-create this device.
     *
     * Attempts to load the OlmAccount from the crypto store, or creates one if none is
     * found.
     *
     * Reads the device keys from the OlmAccount object.
     *
     * @param fromExportedDevice - (Optional) data from exported device
     *     that must be re-created.
     *     If present, opts.pickleKey is ignored
     *     (exported data already provides a pickle key)
     * @param pickleKey - (Optional) pickle key to set instead of default one
     */
    public async init({ pickleKey, fromExportedDevice }: IInitOpts = {}): Promise<void> {
        let e2eKeys;
        const account = new global.Olm.Account();

        try {
            if (fromExportedDevice) {
                if (pickleKey) {
                    logger.warn("ignoring opts.pickleKey" + " because opts.fromExportedDevice is present.");
                }
                this.pickleKey = fromExportedDevice.pickleKey;
                await this.initialiseFromExportedDevice(fromExportedDevice, account);
            } else {
                if (pickleKey) {
                    this.pickleKey = pickleKey;
                }
                await this.initialiseAccount(account);
            }
            e2eKeys = JSON.parse(account.identity_keys());

            this.maxOneTimeKeys = account.max_number_of_one_time_keys();
        } finally {
            account.free();
        }

        this.deviceCurve25519Key = e2eKeys.curve25519;
        this.deviceEd25519Key = e2eKeys.ed25519;
    }

    /**
     * Populates the crypto store using data that was exported from an existing device.
     * Note that for now only the “account” and “sessions” stores are populated;
     * Other stores will be as with a new device.
     *
     * @param exportedData - Data exported from another device
     *     through the “export” method.
     * @param account - an olm account to initialize
     */
    private async initialiseFromExportedDevice(exportedData: IExportedDevice, account: Account): Promise<void> {
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_ACCOUNT, IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.cryptoStore.storeAccount(txn, exportedData.pickledAccount);
                exportedData.sessions.forEach((session) => {
                    const { deviceKey, sessionId } = session;
                    const sessionInfo = {
                        session: session.session,
                        lastReceivedMessageTs: session.lastReceivedMessageTs,
                    };
                    this.cryptoStore.storeEndToEndSession(deviceKey!, sessionId!, sessionInfo, txn);
                });
            },
        );
        account.unpickle(this.pickleKey, exportedData.pickledAccount);
    }

    private async initialiseAccount(account: Account): Promise<void> {
        await this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.cryptoStore.getAccount(txn, (pickledAccount) => {
                if (pickledAccount !== null) {
                    account.unpickle(this.pickleKey, pickledAccount);
                } else {
                    account.create();
                    pickledAccount = account.pickle(this.pickleKey);
                    this.cryptoStore.storeAccount(txn, pickledAccount);
                }
            });
        });
    }

    /**
     * extract our OlmAccount from the crypto store and call the given function
     * with the account object
     * The `account` object is usable only within the callback passed to this
     * function and will be freed as soon the callback returns. It is *not*
     * usable for the rest of the lifetime of the transaction.
     * This function requires a live transaction object from cryptoStore.doTxn()
     * and therefore may only be called in a doTxn() callback.
     *
     * @param txn - Opaque transaction object from cryptoStore.doTxn()
     * @internal
     */
    private getAccount(txn: unknown, func: (account: Account) => void): void {
        this.cryptoStore.getAccount(txn, (pickledAccount: string | null) => {
            const account = new global.Olm.Account();
            try {
                account.unpickle(this.pickleKey, pickledAccount!);
                func(account);
            } finally {
                account.free();
            }
        });
    }

    /*
     * Saves an account to the crypto store.
     * This function requires a live transaction object from cryptoStore.doTxn()
     * and therefore may only be called in a doTxn() callback.
     *
     * @param txn - Opaque transaction object from cryptoStore.doTxn()
     * @param Olm.Account object
     * @internal
     */
    private storeAccount(txn: unknown, account: Account): void {
        this.cryptoStore.storeAccount(txn, account.pickle(this.pickleKey));
    }

    /**
     * Export data for re-creating the Olm device later.
     * TODO export data other than just account and (P2P) sessions.
     *
     * @returns The exported data
     */
    public async export(): Promise<IExportedDevice> {
        const result: Partial<IExportedDevice> = {
            pickleKey: this.pickleKey,
        };

        await this.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_ACCOUNT, IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.cryptoStore.getAccount(txn, (pickledAccount: string | null) => {
                    result.pickledAccount = pickledAccount!;
                });
                result.sessions = [];
                // Note that the pickledSession object we get in the callback
                // is not exactly the same thing you get in method _getSession
                // see documentation of IndexedDBCryptoStore.getAllEndToEndSessions
                this.cryptoStore.getAllEndToEndSessions(txn, (pickledSession) => {
                    result.sessions!.push(pickledSession!);
                });
            },
        );
        return result as IExportedDevice;
    }

    /**
     * extract an OlmSession from the session store and call the given function
     * The session is usable only within the callback passed to this
     * function and will be freed as soon the callback returns. It is *not*
     * usable for the rest of the lifetime of the transaction.
     *
     * @param txn - Opaque transaction object from cryptoStore.doTxn()
     * @internal
     */
    private getSession(
        deviceKey: string,
        sessionId: string,
        txn: unknown,
        func: (unpickledSessionInfo: IUnpickledSessionInfo) => void,
    ): void {
        this.cryptoStore.getEndToEndSession(deviceKey, sessionId, txn, (sessionInfo: ISessionInfo | null) => {
            this.unpickleSession(sessionInfo!, func);
        });
    }

    /**
     * Creates a session object from a session pickle and executes the given
     * function with it. The session object is destroyed once the function
     * returns.
     *
     * @internal
     */
    private unpickleSession(
        sessionInfo: ISessionInfo,
        func: (unpickledSessionInfo: IUnpickledSessionInfo) => void,
    ): void {
        const session = new global.Olm.Session();
        try {
            session.unpickle(this.pickleKey, sessionInfo.session!);
            const unpickledSessInfo: IUnpickledSessionInfo = Object.assign({}, sessionInfo, { session });

            func(unpickledSessInfo);
        } finally {
            session.free();
        }
    }

    /**
     * store our OlmSession in the session store
     *
     * @param sessionInfo - `{session: OlmSession, lastReceivedMessageTs: int}`
     * @param txn - Opaque transaction object from cryptoStore.doTxn()
     * @internal
     */
    private saveSession(deviceKey: string, sessionInfo: IUnpickledSessionInfo, txn: unknown): void {
        const sessionId = sessionInfo.session.session_id();
        logger.debug(`Saving Olm session ${sessionId} with device ${deviceKey}: ${sessionInfo.session.describe()}`);

        // Why do we re-use the input object for this, overwriting the same key with a different
        // type? Is it because we want to erase the unpickled session to enforce that it's no longer
        // used? A comment would be great.
        const pickledSessionInfo = Object.assign(sessionInfo, {
            session: sessionInfo.session.pickle(this.pickleKey),
        });
        this.cryptoStore.storeEndToEndSession(deviceKey, sessionId, pickledSessionInfo, txn);
    }

    /**
     * get an OlmUtility and call the given function
     *
     * @returns result of func
     * @internal
     */
    private getUtility<T>(func: (utility: Utility) => T): T {
        const utility = new global.Olm.Utility();
        try {
            return func(utility);
        } finally {
            utility.free();
        }
    }

    /**
     * Signs a message with the ed25519 key for this account.
     *
     * @param message -  message to be signed
     * @returns base64-encoded signature
     */
    public async sign(message: string): Promise<string> {
        let result: string;
        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account: Account) => {
                result = account.sign(message);
            });
        });
        return result!;
    }

    /**
     * Get the current (unused, unpublished) one-time keys for this account.
     *
     * @returns one time keys; an object with the single property
     * <tt>curve25519</tt>, which is itself an object mapping key id to Curve25519
     * key.
     */
    public async getOneTimeKeys(): Promise<OneTimeKeys> {
        let result: OneTimeKeys;
        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account) => {
                result = JSON.parse(account.one_time_keys());
            });
        });

        return result!;
    }

    /**
     * Get the maximum number of one-time keys we can store.
     *
     * @returns number of keys
     */
    public maxNumberOfOneTimeKeys(): number {
        return this.maxOneTimeKeys ?? -1;
    }

    /**
     * Marks all of the one-time keys as published.
     */
    public async markKeysAsPublished(): Promise<void> {
        await this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account: Account) => {
                account.mark_keys_as_published();
                this.storeAccount(txn, account);
            });
        });
    }

    /**
     * Generate some new one-time keys
     *
     * @param numKeys - number of keys to generate
     * @returns Resolved once the account is saved back having generated the keys
     */
    public generateOneTimeKeys(numKeys: number): Promise<void> {
        return this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account) => {
                account.generate_one_time_keys(numKeys);
                this.storeAccount(txn, account);
            });
        });
    }

    /**
     * Generate a new fallback keys
     *
     * @returns Resolved once the account is saved back having generated the key
     */
    public async generateFallbackKey(): Promise<void> {
        await this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account) => {
                account.generate_fallback_key();
                this.storeAccount(txn, account);
            });
        });
    }

    public async getFallbackKey(): Promise<Record<string, Record<string, string>>> {
        let result: Record<string, Record<string, string>>;
        await this.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account: Account) => {
                result = JSON.parse(account.unpublished_fallback_key());
            });
        });
        return result!;
    }

    public async forgetOldFallbackKey(): Promise<void> {
        await this.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.getAccount(txn, (account: Account) => {
                account.forget_old_fallback_key();
                this.storeAccount(txn, account);
            });
        });
    }

    /**
     * Generate a new outbound session
     *
     * The new session will be stored in the cryptoStore.
     *
     * @param theirIdentityKey - remote user's Curve25519 identity key
     * @param theirOneTimeKey -  remote user's one-time Curve25519 key
     * @returns sessionId for the outbound session.
     */
    public async createOutboundSession(theirIdentityKey: string, theirOneTimeKey: string): Promise<string> {
        let newSessionId: string;
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_ACCOUNT, IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.getAccount(txn, (account: Account) => {
                    const session = new global.Olm.Session();
                    try {
                        session.create_outbound(account, theirIdentityKey, theirOneTimeKey);
                        newSessionId = session.session_id();
                        this.storeAccount(txn, account);
                        const sessionInfo: IUnpickledSessionInfo = {
                            session,
                            // Pretend we've received a message at this point, otherwise
                            // if we try to send a message to the device, it won't use
                            // this session
                            lastReceivedMessageTs: Date.now(),
                        };
                        this.saveSession(theirIdentityKey, sessionInfo, txn);
                    } finally {
                        session.free();
                    }
                });
            },
            logger.withPrefix("[createOutboundSession]"),
        );
        return newSessionId!;
    }

    /**
     * Generate a new inbound session, given an incoming message
     *
     * @param theirDeviceIdentityKey - remote user's Curve25519 identity key
     * @param messageType -  messageType field from the received message (must be 0)
     * @param ciphertext - base64-encoded body from the received message
     *
     * @returns decrypted payload, and
     *     session id of new session
     *
     * @throws Error if the received message was not valid (for instance, it didn't use a valid one-time key).
     */
    public async createInboundSession(
        theirDeviceIdentityKey: string,
        messageType: number,
        ciphertext: string,
    ): Promise<IInboundSession> {
        if (messageType !== 0) {
            throw new Error("Need messageType == 0 to create inbound session");
        }

        let result: { payload: string; session_id: string }; // eslint-disable-line camelcase
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_ACCOUNT, IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.getAccount(txn, (account: Account) => {
                    const session = new global.Olm.Session();
                    try {
                        session.create_inbound_from(account, theirDeviceIdentityKey, ciphertext);
                        account.remove_one_time_keys(session);
                        this.storeAccount(txn, account);

                        const payloadString = session.decrypt(messageType, ciphertext);

                        const sessionInfo: IUnpickledSessionInfo = {
                            session,
                            // this counts as a received message: set last received message time
                            // to now
                            lastReceivedMessageTs: Date.now(),
                        };
                        this.saveSession(theirDeviceIdentityKey, sessionInfo, txn);

                        result = {
                            payload: payloadString,
                            session_id: session.session_id(),
                        };
                    } finally {
                        session.free();
                    }
                });
            },
            logger.withPrefix("[createInboundSession]"),
        );

        return result!;
    }

    /**
     * Get a list of known session IDs for the given device
     *
     * @param theirDeviceIdentityKey - Curve25519 identity key for the
     *     remote device
     * @returns  a list of known session ids for the device
     */
    public async getSessionIdsForDevice(theirDeviceIdentityKey: string): Promise<string[]> {
        const log = logger.withPrefix("[getSessionIdsForDevice]");

        if (theirDeviceIdentityKey in this.sessionsInProgress) {
            log.debug(`Waiting for Olm session for ${theirDeviceIdentityKey} to be created`);
            try {
                await this.sessionsInProgress[theirDeviceIdentityKey];
            } catch (e) {
                // if the session failed to be created, just fall through and
                // return an empty result
            }
        }
        let sessionIds: string[];
        await this.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.cryptoStore.getEndToEndSessions(theirDeviceIdentityKey, txn, (sessions) => {
                    sessionIds = Object.keys(sessions);
                });
            },
            log,
        );

        return sessionIds!;
    }

    /**
     * Get the right olm session id for encrypting messages to the given identity key
     *
     * @param theirDeviceIdentityKey - Curve25519 identity key for the
     *     remote device
     * @param nowait - Don't wait for an in-progress session to complete.
     *     This should only be set to true of the calling function is the function
     *     that marked the session as being in-progress.
     * @param log - A possibly customised log
     * @returns  session id, or null if no established session
     */
    public async getSessionIdForDevice(
        theirDeviceIdentityKey: string,
        nowait = false,
        log?: PrefixedLogger,
    ): Promise<string | null> {
        const sessionInfos = await this.getSessionInfoForDevice(theirDeviceIdentityKey, nowait, log);

        if (sessionInfos.length === 0) {
            return null;
        }
        // Use the session that has most recently received a message
        let idxOfBest = 0;
        for (let i = 1; i < sessionInfos.length; i++) {
            const thisSessInfo = sessionInfos[i];
            const thisLastReceived =
                thisSessInfo.lastReceivedMessageTs === undefined ? 0 : thisSessInfo.lastReceivedMessageTs;

            const bestSessInfo = sessionInfos[idxOfBest];
            const bestLastReceived =
                bestSessInfo.lastReceivedMessageTs === undefined ? 0 : bestSessInfo.lastReceivedMessageTs;
            if (
                thisLastReceived > bestLastReceived ||
                (thisLastReceived === bestLastReceived && thisSessInfo.sessionId < bestSessInfo.sessionId)
            ) {
                idxOfBest = i;
            }
        }
        return sessionInfos[idxOfBest].sessionId;
    }

    /**
     * Get information on the active Olm sessions for a device.
     * <p>
     * Returns an array, with an entry for each active session. The first entry in
     * the result will be the one used for outgoing messages. Each entry contains
     * the keys 'hasReceivedMessage' (true if the session has received an incoming
     * message and is therefore past the pre-key stage), and 'sessionId'.
     *
     * @param deviceIdentityKey - Curve25519 identity key for the device
     * @param nowait - Don't wait for an in-progress session to complete.
     *     This should only be set to true of the calling function is the function
     *     that marked the session as being in-progress.
     * @param log - A possibly customised log
     */
    public async getSessionInfoForDevice(
        deviceIdentityKey: string,
        nowait = false,
        log = logger,
    ): Promise<{ sessionId: string; lastReceivedMessageTs: number; hasReceivedMessage: boolean }[]> {
        log = log.withPrefix("[getSessionInfoForDevice]");

        if (deviceIdentityKey in this.sessionsInProgress && !nowait) {
            log.debug(`Waiting for Olm session for ${deviceIdentityKey} to be created`);
            try {
                await this.sessionsInProgress[deviceIdentityKey];
            } catch (e) {
                // if the session failed to be created, then just fall through and
                // return an empty result
            }
        }
        const info: {
            lastReceivedMessageTs: number;
            hasReceivedMessage: boolean;
            sessionId: string;
        }[] = [];

        await this.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.cryptoStore.getEndToEndSessions(deviceIdentityKey, txn, (sessions) => {
                    const sessionIds = Object.keys(sessions).sort();
                    for (const sessionId of sessionIds) {
                        this.unpickleSession(sessions[sessionId], (sessInfo: IUnpickledSessionInfo) => {
                            info.push({
                                lastReceivedMessageTs: sessInfo.lastReceivedMessageTs!,
                                hasReceivedMessage: sessInfo.session.has_received_message(),
                                sessionId,
                            });
                        });
                    }
                });
            },
            log,
        );

        return info;
    }

    /**
     * Encrypt an outgoing message using an existing session
     *
     * @param theirDeviceIdentityKey - Curve25519 identity key for the
     *     remote device
     * @param sessionId -  the id of the active session
     * @param payloadString -  payload to be encrypted and sent
     *
     * @returns ciphertext
     */
    public async encryptMessage(
        theirDeviceIdentityKey: string,
        sessionId: string,
        payloadString: string,
    ): Promise<IMessage> {
        checkPayloadLength(payloadString);

        let res: IMessage;
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.getSession(theirDeviceIdentityKey, sessionId, txn, (sessionInfo) => {
                    const sessionDesc = sessionInfo.session.describe();
                    logger.log(
                        "encryptMessage: Olm Session ID " +
                            sessionId +
                            " to " +
                            theirDeviceIdentityKey +
                            ": " +
                            sessionDesc,
                    );
                    res = sessionInfo.session.encrypt(payloadString);
                    this.saveSession(theirDeviceIdentityKey, sessionInfo, txn);
                });
            },
            logger.withPrefix("[encryptMessage]"),
        );
        return res!;
    }

    /**
     * Decrypt an incoming message using an existing session
     *
     * @param theirDeviceIdentityKey - Curve25519 identity key for the
     *     remote device
     * @param sessionId -  the id of the active session
     * @param messageType -  messageType field from the received message
     * @param ciphertext - base64-encoded body from the received message
     *
     * @returns decrypted payload.
     */
    public async decryptMessage(
        theirDeviceIdentityKey: string,
        sessionId: string,
        messageType: number,
        ciphertext: string,
    ): Promise<string> {
        let payloadString: string;
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.getSession(theirDeviceIdentityKey, sessionId, txn, (sessionInfo: IUnpickledSessionInfo) => {
                    const sessionDesc = sessionInfo.session.describe();
                    logger.log(
                        "decryptMessage: Olm Session ID " +
                            sessionId +
                            " from " +
                            theirDeviceIdentityKey +
                            ": " +
                            sessionDesc,
                    );
                    payloadString = sessionInfo.session.decrypt(messageType, ciphertext);
                    sessionInfo.lastReceivedMessageTs = Date.now();
                    this.saveSession(theirDeviceIdentityKey, sessionInfo, txn);
                });
            },
            logger.withPrefix("[decryptMessage]"),
        );
        return payloadString!;
    }

    /**
     * Determine if an incoming messages is a prekey message matching an existing session
     *
     * @param theirDeviceIdentityKey - Curve25519 identity key for the
     *     remote device
     * @param sessionId -  the id of the active session
     * @param messageType -  messageType field from the received message
     * @param ciphertext - base64-encoded body from the received message
     *
     * @returns true if the received message is a prekey message which matches
     *    the given session.
     */
    public async matchesSession(
        theirDeviceIdentityKey: string,
        sessionId: string,
        messageType: number,
        ciphertext: string,
    ): Promise<boolean> {
        if (messageType !== 0) {
            return false;
        }

        let matches: boolean;
        await this.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_SESSIONS],
            (txn) => {
                this.getSession(theirDeviceIdentityKey, sessionId, txn, (sessionInfo) => {
                    matches = sessionInfo.session.matches_inbound(ciphertext);
                });
            },
            logger.withPrefix("[matchesSession]"),
        );
        return matches!;
    }

    public async recordSessionProblem(deviceKey: string, type: string, fixed: boolean): Promise<void> {
        logger.info(`Recording problem on olm session with ${deviceKey} of type ${type}. Recreating: ${fixed}`);
        await this.cryptoStore.storeEndToEndSessionProblem(deviceKey, type, fixed);
    }

    public sessionMayHaveProblems(deviceKey: string, timestamp: number): Promise<IProblem | null> {
        return this.cryptoStore.getEndToEndSessionProblem(deviceKey, timestamp);
    }

    public filterOutNotifiedErrorDevices(devices: IOlmDevice[]): Promise<IOlmDevice[]> {
        return this.cryptoStore.filterOutNotifiedErrorDevices(devices);
    }

    // Outbound group session
    // ======================

    /**
     * store an OutboundGroupSession in outboundGroupSessionStore
     *
     * @internal
     */
    private saveOutboundGroupSession(session: OutboundGroupSession): void {
        this.outboundGroupSessionStore[session.session_id()] = session.pickle(this.pickleKey);
    }

    /**
     * extract an OutboundGroupSession from outboundGroupSessionStore and call the
     * given function
     *
     * @returns result of func
     * @internal
     */
    private getOutboundGroupSession<T>(sessionId: string, func: (session: OutboundGroupSession) => T): T {
        const pickled = this.outboundGroupSessionStore[sessionId];
        if (pickled === undefined) {
            throw new Error("Unknown outbound group session " + sessionId);
        }

        const session = new global.Olm.OutboundGroupSession();
        try {
            session.unpickle(this.pickleKey, pickled);
            return func(session);
        } finally {
            session.free();
        }
    }

    /**
     * Generate a new outbound group session
     *
     * @returns sessionId for the outbound session.
     */
    public createOutboundGroupSession(): string {
        const session = new global.Olm.OutboundGroupSession();
        try {
            session.create();
            this.saveOutboundGroupSession(session);
            return session.session_id();
        } finally {
            session.free();
        }
    }

    /**
     * Encrypt an outgoing message with an outbound group session
     *
     * @param sessionId -  the id of the outboundgroupsession
     * @param payloadString -  payload to be encrypted and sent
     *
     * @returns ciphertext
     */
    public encryptGroupMessage(sessionId: string, payloadString: string): string {
        logger.log(`encrypting msg with megolm session ${sessionId}`);

        checkPayloadLength(payloadString);

        return this.getOutboundGroupSession(sessionId, (session: OutboundGroupSession) => {
            const res = session.encrypt(payloadString);
            this.saveOutboundGroupSession(session);
            return res;
        });
    }

    /**
     * Get the session keys for an outbound group session
     *
     * @param sessionId -  the id of the outbound group session
     *
     * @returns current chain index, and
     *     base64-encoded secret key.
     */
    public getOutboundGroupSessionKey(sessionId: string): IOutboundGroupSessionKey {
        return this.getOutboundGroupSession(sessionId, function (session: OutboundGroupSession) {
            return {
                chain_index: session.message_index(),
                key: session.session_key(),
            };
        });
    }

    // Inbound group session
    // =====================

    /**
     * Unpickle a session from a sessionData object and invoke the given function.
     * The session is valid only until func returns.
     *
     * @param sessionData - Object describing the session.
     * @param func - Invoked with the unpickled session
     * @returns result of func
     */
    private unpickleInboundGroupSession<T>(
        sessionData: InboundGroupSessionData,
        func: (session: InboundGroupSession) => T,
    ): T {
        const session = new global.Olm.InboundGroupSession();
        try {
            session.unpickle(this.pickleKey, sessionData.session);
            return func(session);
        } finally {
            session.free();
        }
    }

    /**
     * extract an InboundGroupSession from the crypto store and call the given function
     *
     * @param roomId - The room ID to extract the session for, or null to fetch
     *     sessions for any room.
     * @param txn - Opaque transaction object from cryptoStore.doTxn()
     * @param func - function to call.
     *
     * @internal
     */
    private getInboundGroupSession(
        roomId: string,
        senderKey: string,
        sessionId: string,
        txn: unknown,
        func: (
            session: InboundGroupSession | null,
            data: InboundGroupSessionData | null,
            withheld: IWithheld | null,
        ) => void,
    ): void {
        this.cryptoStore.getEndToEndInboundGroupSession(
            senderKey,
            sessionId,
            txn,
            (sessionData: InboundGroupSessionData | null, withheld: IWithheld | null) => {
                if (sessionData === null) {
                    func(null, null, withheld);
                    return;
                }

                // if we were given a room ID, check that the it matches the original one for the session. This stops
                // the HS pretending a message was targeting a different room.
                if (roomId !== null && roomId !== sessionData.room_id) {
                    throw new Error(
                        "Mismatched room_id for inbound group session (expected " +
                            sessionData.room_id +
                            ", was " +
                            roomId +
                            ")",
                    );
                }

                this.unpickleInboundGroupSession(sessionData, (session: InboundGroupSession) => {
                    func(session, sessionData, withheld);
                });
            },
        );
    }

    /**
     * Add an inbound group session to the session store
     *
     * @param roomId -     room in which this session will be used
     * @param senderKey -  base64-encoded curve25519 key of the sender
     * @param forwardingCurve25519KeyChain -  Devices involved in forwarding
     *     this session to us.
     * @param sessionId -  session identifier
     * @param sessionKey - base64-encoded secret key
     * @param keysClaimed - Other keys the sender claims.
     * @param exportFormat - true if the megolm keys are in export format
     *    (ie, they lack an ed25519 signature)
     * @param extraSessionData - any other data to be include with the session
     */
    public async addInboundGroupSession(
        roomId: string,
        senderKey: string,
        forwardingCurve25519KeyChain: string[],
        sessionId: string,
        sessionKey: string,
        keysClaimed: Record<string, string>,
        exportFormat: boolean,
        extraSessionData: OlmGroupSessionExtraData = {},
    ): Promise<void> {
        await this.cryptoStore.doTxn(
            "readwrite",
            [
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS,
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD,
                IndexedDBCryptoStore.STORE_SHARED_HISTORY_INBOUND_GROUP_SESSIONS,
            ],
            (txn) => {
                /* if we already have this session, consider updating it */
                this.getInboundGroupSession(
                    roomId,
                    senderKey,
                    sessionId,
                    txn,
                    (
                        existingSession: InboundGroupSession | null,
                        existingSessionData: InboundGroupSessionData | null,
                    ) => {
                        // new session.
                        const session = new global.Olm.InboundGroupSession();
                        try {
                            if (exportFormat) {
                                session.import_session(sessionKey);
                            } else {
                                session.create(sessionKey);
                            }
                            if (sessionId != session.session_id()) {
                                throw new Error("Mismatched group session ID from senderKey: " + senderKey);
                            }

                            if (existingSession) {
                                logger.log(`Update for megolm session ${senderKey}|${sessionId}`);
                                if (existingSession.first_known_index() <= session.first_known_index()) {
                                    if (!existingSessionData!.untrusted || extraSessionData.untrusted) {
                                        // existing session has less-than-or-equal index
                                        // (i.e. can decrypt at least as much), and the
                                        // new session's trust does not win over the old
                                        // session's trust, so keep it
                                        logger.log(`Keeping existing megolm session ${senderKey}|${sessionId}`);
                                        return;
                                    }
                                    if (existingSession.first_known_index() < session.first_known_index()) {
                                        // We want to upgrade the existing session's trust,
                                        // but we can't just use the new session because we'll
                                        // lose the lower index. Check that the sessions connect
                                        // properly, and then manually set the existing session
                                        // as trusted.
                                        if (
                                            existingSession.export_session(session.first_known_index()) ===
                                            session.export_session(session.first_known_index())
                                        ) {
                                            logger.info(
                                                "Upgrading trust of existing megolm session " +
                                                    `${senderKey}|${sessionId} based on newly-received trusted session`,
                                            );
                                            existingSessionData!.untrusted = false;
                                            this.cryptoStore.storeEndToEndInboundGroupSession(
                                                senderKey,
                                                sessionId,
                                                existingSessionData!,
                                                txn,
                                            );
                                        } else {
                                            logger.warn(
                                                `Newly-received megolm session ${senderKey}|$sessionId}` +
                                                    " does not match existing session! Keeping existing session",
                                            );
                                        }
                                        return;
                                    }
                                    // If the sessions have the same index, go ahead and store the new trusted one.
                                }
                            }

                            logger.info(
                                `Storing megolm session ${senderKey}|${sessionId} with first index ` +
                                    session.first_known_index(),
                            );

                            const sessionData = Object.assign({}, extraSessionData, {
                                room_id: roomId,
                                session: session.pickle(this.pickleKey),
                                keysClaimed: keysClaimed,
                                forwardingCurve25519KeyChain: forwardingCurve25519KeyChain,
                            });

                            this.cryptoStore.storeEndToEndInboundGroupSession(senderKey, sessionId, sessionData, txn);

                            if (!existingSession && extraSessionData.sharedHistory) {
                                this.cryptoStore.addSharedHistoryInboundGroupSession(roomId, senderKey, sessionId, txn);
                            }
                        } finally {
                            session.free();
                        }
                    },
                );
            },
            logger.withPrefix("[addInboundGroupSession]"),
        );
    }

    /**
     * Record in the data store why an inbound group session was withheld.
     *
     * @param roomId -     room that the session belongs to
     * @param senderKey -  base64-encoded curve25519 key of the sender
     * @param sessionId -  session identifier
     * @param code -       reason code
     * @param reason -     human-readable version of `code`
     */
    public async addInboundGroupSessionWithheld(
        roomId: string,
        senderKey: string,
        sessionId: string,
        code: string,
        reason: string,
    ): Promise<void> {
        await this.cryptoStore.doTxn(
            "readwrite",
            [IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD],
            (txn) => {
                this.cryptoStore.storeEndToEndInboundGroupSessionWithheld(
                    senderKey,
                    sessionId,
                    {
                        room_id: roomId,
                        code: code,
                        reason: reason,
                    },
                    txn,
                );
            },
        );
    }

    /**
     * Decrypt a received message with an inbound group session
     *
     * @param roomId -    room in which the message was received
     * @param senderKey - base64-encoded curve25519 key of the sender
     * @param sessionId - session identifier
     * @param body -      base64-encoded body of the encrypted message
     * @param eventId -   ID of the event being decrypted
     * @param timestamp - timestamp of the event being decrypted
     *
     * @returns null if the sessionId is unknown
     */
    public async decryptGroupMessage(
        roomId: string,
        senderKey: string,
        sessionId: string,
        body: string,
        eventId: string,
        timestamp: number,
    ): Promise<IDecryptedGroupMessage | null> {
        let result: IDecryptedGroupMessage | null = null;
        // when the localstorage crypto store is used as an indexeddb backend,
        // exceptions thrown from within the inner function are not passed through
        // to the top level, so we store exceptions in a variable and raise them at
        // the end
        let error: Error;

        await this.cryptoStore.doTxn(
            "readwrite",
            [
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS,
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD,
            ],
            (txn) => {
                this.getInboundGroupSession(roomId, senderKey, sessionId, txn, (session, sessionData, withheld) => {
                    if (session === null || sessionData === null) {
                        if (withheld) {
                            error = new algorithms.DecryptionError(
                                "MEGOLM_UNKNOWN_INBOUND_SESSION_ID",
                                calculateWithheldMessage(withheld),
                                {
                                    session: senderKey + "|" + sessionId,
                                },
                            );
                        }
                        result = null;
                        return;
                    }
                    let res: ReturnType<InboundGroupSession["decrypt"]>;
                    try {
                        res = session.decrypt(body);
                    } catch (e) {
                        if ((<Error>e)?.message === "OLM.UNKNOWN_MESSAGE_INDEX" && withheld) {
                            error = new algorithms.DecryptionError(
                                "MEGOLM_UNKNOWN_INBOUND_SESSION_ID",
                                calculateWithheldMessage(withheld),
                                {
                                    session: senderKey + "|" + sessionId,
                                },
                            );
                        } else {
                            error = <Error>e;
                        }
                        return;
                    }

                    let plaintext: string = res.plaintext;
                    if (plaintext === undefined) {
                        // @ts-ignore - Compatibility for older olm versions.
                        plaintext = res as string;
                    } else {
                        // Check if we have seen this message index before to detect replay attacks.
                        // If the event ID and timestamp are specified, and the match the event ID
                        // and timestamp from the last time we used this message index, then we
                        // don't consider it a replay attack.
                        const messageIndexKey = senderKey + "|" + sessionId + "|" + res.message_index;
                        if (messageIndexKey in this.inboundGroupSessionMessageIndexes) {
                            const msgInfo = this.inboundGroupSessionMessageIndexes[messageIndexKey];
                            if (msgInfo.id !== eventId || msgInfo.timestamp !== timestamp) {
                                error = new Error(
                                    "Duplicate message index, possible replay attack: " + messageIndexKey,
                                );
                                return;
                            }
                        }
                        this.inboundGroupSessionMessageIndexes[messageIndexKey] = {
                            id: eventId,
                            timestamp: timestamp,
                        };
                    }

                    sessionData.session = session.pickle(this.pickleKey);
                    this.cryptoStore.storeEndToEndInboundGroupSession(senderKey, sessionId, sessionData, txn);
                    result = {
                        result: plaintext,
                        keysClaimed: sessionData.keysClaimed || {},
                        senderKey: senderKey,
                        forwardingCurve25519KeyChain: sessionData.forwardingCurve25519KeyChain || [],
                        untrusted: !!sessionData.untrusted,
                    };
                });
            },
            logger.withPrefix("[decryptGroupMessage]"),
        );

        if (error!) {
            throw error;
        }
        return result!;
    }

    /**
     * Determine if we have the keys for a given megolm session
     *
     * @param roomId -    room in which the message was received
     * @param senderKey - base64-encoded curve25519 key of the sender
     * @param sessionId - session identifier
     *
     * @returns true if we have the keys to this session
     */
    public async hasInboundSessionKeys(roomId: string, senderKey: string, sessionId: string): Promise<boolean> {
        let result: boolean;
        await this.cryptoStore.doTxn(
            "readonly",
            [
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS,
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD,
            ],
            (txn) => {
                this.cryptoStore.getEndToEndInboundGroupSession(senderKey, sessionId, txn, (sessionData) => {
                    if (sessionData === null) {
                        result = false;
                        return;
                    }

                    if (roomId !== sessionData.room_id) {
                        logger.warn(
                            `requested keys for inbound group session ${senderKey}|` +
                                `${sessionId}, with incorrect room_id ` +
                                `(expected ${sessionData.room_id}, ` +
                                `was ${roomId})`,
                        );
                        result = false;
                    } else {
                        result = true;
                    }
                });
            },
            logger.withPrefix("[hasInboundSessionKeys]"),
        );

        return result!;
    }

    /**
     * Extract the keys to a given megolm session, for sharing
     *
     * @param roomId -    room in which the message was received
     * @param senderKey - base64-encoded curve25519 key of the sender
     * @param sessionId - session identifier
     * @param chainIndex - The chain index at which to export the session.
     *     If omitted, export at the first index we know about.
     *
     * @returns
     *    details of the session key. The key is a base64-encoded megolm key in
     *    export format.
     *
     * @throws Error If the given chain index could not be obtained from the known
     *     index (ie. the given chain index is before the first we have).
     */
    public async getInboundGroupSessionKey(
        roomId: string,
        senderKey: string,
        sessionId: string,
        chainIndex?: number,
    ): Promise<IInboundGroupSessionKey | null> {
        let result: IInboundGroupSessionKey | null = null;
        await this.cryptoStore.doTxn(
            "readonly",
            [
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS,
                IndexedDBCryptoStore.STORE_INBOUND_GROUP_SESSIONS_WITHHELD,
            ],
            (txn) => {
                this.getInboundGroupSession(roomId, senderKey, sessionId, txn, (session, sessionData) => {
                    if (session === null || sessionData === null) {
                        result = null;
                        return;
                    }

                    if (chainIndex === undefined) {
                        chainIndex = session.first_known_index();
                    }

                    const exportedSession = session.export_session(chainIndex);

                    const claimedKeys = sessionData.keysClaimed || {};
                    const senderEd25519Key = claimedKeys.ed25519 || null;

                    const forwardingKeyChain = sessionData.forwardingCurve25519KeyChain || [];
                    // older forwarded keys didn't set the "untrusted"
                    // property, but can be identified by having a
                    // non-empty forwarding key chain.  These keys should
                    // be marked as untrusted since we don't know that they
                    // can be trusted
                    const untrusted =
                        "untrusted" in sessionData ? sessionData.untrusted : forwardingKeyChain.length > 0;

                    result = {
                        chain_index: chainIndex,
                        key: exportedSession,
                        forwarding_curve25519_key_chain: forwardingKeyChain,
                        sender_claimed_ed25519_key: senderEd25519Key,
                        shared_history: sessionData.sharedHistory || false,
                        untrusted: untrusted,
                    };
                });
            },
            logger.withPrefix("[getInboundGroupSessionKey]"),
        );

        return result;
    }

    /**
     * Export an inbound group session
     *
     * @param senderKey - base64-encoded curve25519 key of the sender
     * @param sessionId - session identifier
     * @param sessionData - The session object from the store
     * @returns exported session data
     */
    public exportInboundGroupSession(
        senderKey: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
    ): IMegolmSessionData {
        return this.unpickleInboundGroupSession(sessionData, (session) => {
            const messageIndex = session.first_known_index();

            return {
                "sender_key": senderKey,
                "sender_claimed_keys": sessionData.keysClaimed,
                "room_id": sessionData.room_id,
                "session_id": sessionId,
                "session_key": session.export_session(messageIndex),
                "forwarding_curve25519_key_chain": sessionData.forwardingCurve25519KeyChain || [],
                "first_known_index": session.first_known_index(),
                "org.matrix.msc3061.shared_history": sessionData.sharedHistory || false,
            } as IMegolmSessionData;
        });
    }

    public async getSharedHistoryInboundGroupSessions(
        roomId: string,
    ): Promise<[senderKey: string, sessionId: string][]> {
        let result: Promise<[senderKey: string, sessionId: string][]>;
        await this.cryptoStore.doTxn(
            "readonly",
            [IndexedDBCryptoStore.STORE_SHARED_HISTORY_INBOUND_GROUP_SESSIONS],
            (txn) => {
                result = this.cryptoStore.getSharedHistoryInboundGroupSessions(roomId, txn);
            },
            logger.withPrefix("[getSharedHistoryInboundGroupSessionsForRoom]"),
        );
        return result!;
    }

    // Utilities
    // =========

    /**
     * Verify an ed25519 signature.
     *
     * @param key - ed25519 key
     * @param message - message which was signed
     * @param signature - base64-encoded signature to be checked
     *
     * @throws Error if there is a problem with the verification. If the key was
     * too small then the message will be "OLM.INVALID_BASE64". If the signature
     * was invalid then the message will be "OLM.BAD_MESSAGE_MAC".
     */
    public verifySignature(key: string, message: string, signature: string): void {
        this.getUtility(function (util: Utility) {
            util.ed25519_verify(key, message, signature);
        });
    }
}

export const WITHHELD_MESSAGES: Record<string, string> = {
    "m.unverified": "The sender has disabled encrypting to unverified devices.",
    "m.blacklisted": "The sender has blocked you.",
    "m.unauthorised": "You are not authorised to read the message.",
    "m.no_olm": "Unable to establish a secure channel.",
};

/**
 * Calculate the message to use for the exception when a session key is withheld.
 *
 * @param withheld -  An object that describes why the key was withheld.
 *
 * @returns the message
 *
 * @internal
 */
function calculateWithheldMessage(withheld: IWithheld): string {
    if (withheld.code && withheld.code in WITHHELD_MESSAGES) {
        return WITHHELD_MESSAGES[withheld.code];
    } else if (withheld.reason) {
        return withheld.reason;
    } else {
        return "decryption key withheld";
    }
}
