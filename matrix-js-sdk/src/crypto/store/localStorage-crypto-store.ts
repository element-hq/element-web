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

import { logger } from "../../logger";
import { MemoryCryptoStore } from "./memory-crypto-store";
import { IDeviceData, IProblem, ISession, ISessionInfo, IWithheld, Mode, SecretStorePrivateKeys } from "./base";
import { IOlmDevice } from "../algorithms/megolm";
import { IRoomEncryption } from "../RoomList";
import { ICrossSigningKey } from "../../client";
import { InboundGroupSessionData } from "../OlmDevice";
import { safeSet } from "../../utils";

/**
 * Internal module. Partial localStorage backed storage for e2e.
 * This is not a full crypto store, just the in-memory store with
 * some things backed by localStorage. It exists because indexedDB
 * is broken in Firefox private mode or set to, "will not remember
 * history".
 */

const E2E_PREFIX = "crypto.";
const KEY_END_TO_END_ACCOUNT = E2E_PREFIX + "account";
const KEY_CROSS_SIGNING_KEYS = E2E_PREFIX + "cross_signing_keys";
const KEY_NOTIFIED_ERROR_DEVICES = E2E_PREFIX + "notified_error_devices";
const KEY_DEVICE_DATA = E2E_PREFIX + "device_data";
const KEY_INBOUND_SESSION_PREFIX = E2E_PREFIX + "inboundgroupsessions/";
const KEY_INBOUND_SESSION_WITHHELD_PREFIX = E2E_PREFIX + "inboundgroupsessions.withheld/";
const KEY_ROOMS_PREFIX = E2E_PREFIX + "rooms/";
const KEY_SESSIONS_NEEDING_BACKUP = E2E_PREFIX + "sessionsneedingbackup";

function keyEndToEndSessions(deviceKey: string): string {
    return E2E_PREFIX + "sessions/" + deviceKey;
}

function keyEndToEndSessionProblems(deviceKey: string): string {
    return E2E_PREFIX + "session.problems/" + deviceKey;
}

function keyEndToEndInboundGroupSession(senderKey: string, sessionId: string): string {
    return KEY_INBOUND_SESSION_PREFIX + senderKey + "/" + sessionId;
}

function keyEndToEndInboundGroupSessionWithheld(senderKey: string, sessionId: string): string {
    return KEY_INBOUND_SESSION_WITHHELD_PREFIX + senderKey + "/" + sessionId;
}

function keyEndToEndRoomsPrefix(roomId: string): string {
    return KEY_ROOMS_PREFIX + roomId;
}

export class LocalStorageCryptoStore extends MemoryCryptoStore {
    public static exists(store: Storage): boolean {
        const length = store.length;
        for (let i = 0; i < length; i++) {
            if (store.key(i)?.startsWith(E2E_PREFIX)) {
                return true;
            }
        }
        return false;
    }

    public constructor(private readonly store: Storage) {
        super();
    }

    // Olm Sessions

    public countEndToEndSessions(txn: unknown, func: (count: number) => void): void {
        let count = 0;
        for (let i = 0; i < this.store.length; ++i) {
            if (this.store.key(i)?.startsWith(keyEndToEndSessions(""))) ++count;
        }
        func(count);
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    private _getEndToEndSessions(deviceKey: string): Record<string, ISessionInfo> {
        const sessions = getJsonItem(this.store, keyEndToEndSessions(deviceKey));
        const fixedSessions: Record<string, ISessionInfo> = {};

        // fix up any old sessions to be objects rather than just the base64 pickle
        for (const [sid, val] of Object.entries(sessions || {})) {
            if (typeof val === "string") {
                fixedSessions[sid] = {
                    session: val,
                };
            } else {
                fixedSessions[sid] = val;
            }
        }

        return fixedSessions;
    }

    public getEndToEndSession(
        deviceKey: string,
        sessionId: string,
        txn: unknown,
        func: (session: ISessionInfo) => void,
    ): void {
        const sessions = this._getEndToEndSessions(deviceKey);
        func(sessions[sessionId] || {});
    }

    public getEndToEndSessions(
        deviceKey: string,
        txn: unknown,
        func: (sessions: { [sessionId: string]: ISessionInfo }) => void,
    ): void {
        func(this._getEndToEndSessions(deviceKey) || {});
    }

    public getAllEndToEndSessions(txn: unknown, func: (session: ISessionInfo) => void): void {
        for (let i = 0; i < this.store.length; ++i) {
            if (this.store.key(i)?.startsWith(keyEndToEndSessions(""))) {
                const deviceKey = this.store.key(i)!.split("/")[1];
                for (const sess of Object.values(this._getEndToEndSessions(deviceKey))) {
                    func(sess);
                }
            }
        }
    }

    public storeEndToEndSession(deviceKey: string, sessionId: string, sessionInfo: ISessionInfo, txn: unknown): void {
        const sessions = this._getEndToEndSessions(deviceKey) || {};
        sessions[sessionId] = sessionInfo;
        setJsonItem(this.store, keyEndToEndSessions(deviceKey), sessions);
    }

    public async storeEndToEndSessionProblem(deviceKey: string, type: string, fixed: boolean): Promise<void> {
        const key = keyEndToEndSessionProblems(deviceKey);
        const problems = getJsonItem<IProblem[]>(this.store, key) || [];
        problems.push({ type, fixed, time: Date.now() });
        problems.sort((a, b) => {
            return a.time - b.time;
        });
        setJsonItem(this.store, key, problems);
    }

    public async getEndToEndSessionProblem(deviceKey: string, timestamp: number): Promise<IProblem | null> {
        const key = keyEndToEndSessionProblems(deviceKey);
        const problems = getJsonItem<IProblem[]>(this.store, key) || [];
        if (!problems.length) {
            return null;
        }
        const lastProblem = problems[problems.length - 1];
        for (const problem of problems) {
            if (problem.time > timestamp) {
                return Object.assign({}, problem, { fixed: lastProblem.fixed });
            }
        }
        if (lastProblem.fixed) {
            return null;
        } else {
            return lastProblem;
        }
    }

    public async filterOutNotifiedErrorDevices(devices: IOlmDevice[]): Promise<IOlmDevice[]> {
        const notifiedErrorDevices =
            getJsonItem<MemoryCryptoStore["notifiedErrorDevices"]>(this.store, KEY_NOTIFIED_ERROR_DEVICES) || {};
        const ret: IOlmDevice[] = [];

        for (const device of devices) {
            const { userId, deviceInfo } = device;
            if (userId in notifiedErrorDevices) {
                if (!(deviceInfo.deviceId in notifiedErrorDevices[userId])) {
                    ret.push(device);
                    safeSet(notifiedErrorDevices[userId], deviceInfo.deviceId, true);
                }
            } else {
                ret.push(device);
                safeSet(notifiedErrorDevices, userId, { [deviceInfo.deviceId]: true });
            }
        }

        setJsonItem(this.store, KEY_NOTIFIED_ERROR_DEVICES, notifiedErrorDevices);

        return ret;
    }

    // Inbound Group Sessions

    public getEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        txn: unknown,
        func: (groupSession: InboundGroupSessionData | null, groupSessionWithheld: IWithheld | null) => void,
    ): void {
        func(
            getJsonItem(this.store, keyEndToEndInboundGroupSession(senderCurve25519Key, sessionId)),
            getJsonItem(this.store, keyEndToEndInboundGroupSessionWithheld(senderCurve25519Key, sessionId)),
        );
    }

    public getAllEndToEndInboundGroupSessions(txn: unknown, func: (session: ISession | null) => void): void {
        for (let i = 0; i < this.store.length; ++i) {
            const key = this.store.key(i);
            if (key?.startsWith(KEY_INBOUND_SESSION_PREFIX)) {
                // we can't use split, as the components we are trying to split out
                // might themselves contain '/' characters. We rely on the
                // senderKey being a (32-byte) curve25519 key, base64-encoded
                // (hence 43 characters long).

                func({
                    senderKey: key.slice(KEY_INBOUND_SESSION_PREFIX.length, KEY_INBOUND_SESSION_PREFIX.length + 43),
                    sessionId: key.slice(KEY_INBOUND_SESSION_PREFIX.length + 44),
                    sessionData: getJsonItem(this.store, key)!,
                });
            }
        }
        func(null);
    }

    public addEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void {
        const existing = getJsonItem(this.store, keyEndToEndInboundGroupSession(senderCurve25519Key, sessionId));
        if (!existing) {
            this.storeEndToEndInboundGroupSession(senderCurve25519Key, sessionId, sessionData, txn);
        }
    }

    public storeEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void {
        setJsonItem(this.store, keyEndToEndInboundGroupSession(senderCurve25519Key, sessionId), sessionData);
    }

    public storeEndToEndInboundGroupSessionWithheld(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: IWithheld,
        txn: unknown,
    ): void {
        setJsonItem(this.store, keyEndToEndInboundGroupSessionWithheld(senderCurve25519Key, sessionId), sessionData);
    }

    public getEndToEndDeviceData(txn: unknown, func: (deviceData: IDeviceData | null) => void): void {
        func(getJsonItem(this.store, KEY_DEVICE_DATA));
    }

    public storeEndToEndDeviceData(deviceData: IDeviceData, txn: unknown): void {
        setJsonItem(this.store, KEY_DEVICE_DATA, deviceData);
    }

    public storeEndToEndRoom(roomId: string, roomInfo: IRoomEncryption, txn: unknown): void {
        setJsonItem(this.store, keyEndToEndRoomsPrefix(roomId), roomInfo);
    }

    public getEndToEndRooms(txn: unknown, func: (rooms: Record<string, IRoomEncryption>) => void): void {
        const result: Record<string, IRoomEncryption> = {};
        const prefix = keyEndToEndRoomsPrefix("");

        for (let i = 0; i < this.store.length; ++i) {
            const key = this.store.key(i);
            if (key?.startsWith(prefix)) {
                const roomId = key.slice(prefix.length);
                result[roomId] = getJsonItem(this.store, key)!;
            }
        }
        func(result);
    }

    public getSessionsNeedingBackup(limit: number): Promise<ISession[]> {
        const sessionsNeedingBackup = getJsonItem<string[]>(this.store, KEY_SESSIONS_NEEDING_BACKUP) || {};
        const sessions: ISession[] = [];

        for (const session in sessionsNeedingBackup) {
            if (Object.prototype.hasOwnProperty.call(sessionsNeedingBackup, session)) {
                // see getAllEndToEndInboundGroupSessions for the magic number explanations
                const senderKey = session.slice(0, 43);
                const sessionId = session.slice(44);
                this.getEndToEndInboundGroupSession(senderKey, sessionId, null, (sessionData) => {
                    sessions.push({
                        senderKey: senderKey,
                        sessionId: sessionId,
                        sessionData: sessionData!,
                    });
                });
                if (limit && sessions.length >= limit) {
                    break;
                }
            }
        }
        return Promise.resolve(sessions);
    }

    public countSessionsNeedingBackup(): Promise<number> {
        const sessionsNeedingBackup = getJsonItem(this.store, KEY_SESSIONS_NEEDING_BACKUP) || {};
        return Promise.resolve(Object.keys(sessionsNeedingBackup).length);
    }

    public unmarkSessionsNeedingBackup(sessions: ISession[]): Promise<void> {
        const sessionsNeedingBackup =
            getJsonItem<{
                [senderKeySessionId: string]: string;
            }>(this.store, KEY_SESSIONS_NEEDING_BACKUP) || {};
        for (const session of sessions) {
            delete sessionsNeedingBackup[session.senderKey + "/" + session.sessionId];
        }
        setJsonItem(this.store, KEY_SESSIONS_NEEDING_BACKUP, sessionsNeedingBackup);
        return Promise.resolve();
    }

    public markSessionsNeedingBackup(sessions: ISession[]): Promise<void> {
        const sessionsNeedingBackup =
            getJsonItem<{
                [senderKeySessionId: string]: boolean;
            }>(this.store, KEY_SESSIONS_NEEDING_BACKUP) || {};
        for (const session of sessions) {
            sessionsNeedingBackup[session.senderKey + "/" + session.sessionId] = true;
        }
        setJsonItem(this.store, KEY_SESSIONS_NEEDING_BACKUP, sessionsNeedingBackup);
        return Promise.resolve();
    }

    /**
     * Delete all data from this store.
     *
     * @returns Promise which resolves when the store has been cleared.
     */
    public deleteAllData(): Promise<void> {
        this.store.removeItem(KEY_END_TO_END_ACCOUNT);
        return Promise.resolve();
    }

    // Olm account

    public getAccount(txn: unknown, func: (accountPickle: string | null) => void): void {
        const accountPickle = getJsonItem<string>(this.store, KEY_END_TO_END_ACCOUNT);
        func(accountPickle);
    }

    public storeAccount(txn: unknown, accountPickle: string): void {
        setJsonItem(this.store, KEY_END_TO_END_ACCOUNT, accountPickle);
    }

    public getCrossSigningKeys(txn: unknown, func: (keys: Record<string, ICrossSigningKey> | null) => void): void {
        const keys = getJsonItem<Record<string, ICrossSigningKey>>(this.store, KEY_CROSS_SIGNING_KEYS);
        func(keys);
    }

    public getSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        func: (key: SecretStorePrivateKeys[K] | null) => void,
        type: K,
    ): void {
        const key = getJsonItem<SecretStorePrivateKeys[K]>(this.store, E2E_PREFIX + `ssss_cache.${type}`);
        func(key);
    }

    public storeCrossSigningKeys(txn: unknown, keys: Record<string, ICrossSigningKey>): void {
        setJsonItem(this.store, KEY_CROSS_SIGNING_KEYS, keys);
    }

    public storeSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        type: K,
        key: SecretStorePrivateKeys[K],
    ): void {
        setJsonItem(this.store, E2E_PREFIX + `ssss_cache.${type}`, key);
    }

    public doTxn<T>(mode: Mode, stores: Iterable<string>, func: (txn: unknown) => T): Promise<T> {
        return Promise.resolve(func(null));
    }
}

function getJsonItem<T>(store: Storage, key: string): T | null {
    try {
        // if the key is absent, store.getItem() returns null, and
        // JSON.parse(null) === null, so this returns null.
        return JSON.parse(store.getItem(key)!);
    } catch (e) {
        logger.log("Error: Failed to get key %s: %s", key, (<Error>e).message);
        logger.log((<Error>e).stack);
    }
    return null;
}

function setJsonItem<T>(store: Storage, key: string, val: T): void {
    store.setItem(key, JSON.stringify(val));
}
