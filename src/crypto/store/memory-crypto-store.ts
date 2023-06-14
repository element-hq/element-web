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
import { safeSet, deepCompare, promiseTry } from "../../utils";
import {
    CryptoStore,
    IDeviceData,
    IProblem,
    ISession,
    ISessionInfo,
    IWithheld,
    Mode,
    OutgoingRoomKeyRequest,
    ParkedSharedHistory,
    SecretStorePrivateKeys,
} from "./base";
import { IRoomKeyRequestBody } from "../index";
import { ICrossSigningKey } from "../../client";
import { IOlmDevice } from "../algorithms/megolm";
import { IRoomEncryption } from "../RoomList";
import { InboundGroupSessionData } from "../OlmDevice";

/**
 * Internal module. in-memory storage for e2e.
 */

export class MemoryCryptoStore implements CryptoStore {
    private outgoingRoomKeyRequests: OutgoingRoomKeyRequest[] = [];
    private account: string | null = null;
    private crossSigningKeys: Record<string, ICrossSigningKey> | null = null;
    private privateKeys: Partial<SecretStorePrivateKeys> = {};

    private sessions: { [deviceKey: string]: { [sessionId: string]: ISessionInfo } } = {};
    private sessionProblems: { [deviceKey: string]: IProblem[] } = {};
    private notifiedErrorDevices: { [userId: string]: { [deviceId: string]: boolean } } = {};
    private inboundGroupSessions: { [sessionKey: string]: InboundGroupSessionData } = {};
    private inboundGroupSessionsWithheld: Record<string, IWithheld> = {};
    // Opaque device data object
    private deviceData: IDeviceData | null = null;
    private rooms: { [roomId: string]: IRoomEncryption } = {};
    private sessionsNeedingBackup: { [sessionKey: string]: boolean } = {};
    private sharedHistoryInboundGroupSessions: { [roomId: string]: [senderKey: string, sessionId: string][] } = {};
    private parkedSharedHistory = new Map<string, ParkedSharedHistory[]>(); // keyed by room ID

    /**
     * Ensure the database exists and is up-to-date.
     *
     * This must be called before the store can be used.
     *
     * @returns resolves to the store.
     */
    public async startup(): Promise<CryptoStore> {
        // No startup work to do for the memory store.
        return this;
    }

    /**
     * Delete all data from this store.
     *
     * @returns Promise which resolves when the store has been cleared.
     */
    public deleteAllData(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Look for an existing outgoing room key request, and if none is found,
     * add a new one
     *
     *
     * @returns resolves to
     *    {@link OutgoingRoomKeyRequest}: either the
     *    same instance as passed in, or the existing one.
     */
    public getOrAddOutgoingRoomKeyRequest(request: OutgoingRoomKeyRequest): Promise<OutgoingRoomKeyRequest> {
        const requestBody = request.requestBody;

        return promiseTry(() => {
            // first see if we already have an entry for this request.
            const existing = this._getOutgoingRoomKeyRequest(requestBody);

            if (existing) {
                // this entry matches the request - return it.
                logger.log(
                    `already have key request outstanding for ` +
                        `${requestBody.room_id} / ${requestBody.session_id}: ` +
                        `not sending another`,
                );
                return existing;
            }

            // we got to the end of the list without finding a match
            // - add the new request.
            logger.log(`enqueueing key request for ${requestBody.room_id} / ` + requestBody.session_id);
            this.outgoingRoomKeyRequests.push(request);
            return request;
        });
    }

    /**
     * Look for an existing room key request
     *
     * @param requestBody - existing request to look for
     *
     * @returns resolves to the matching
     *    {@link OutgoingRoomKeyRequest}, or null if
     *    not found
     */
    public getOutgoingRoomKeyRequest(requestBody: IRoomKeyRequestBody): Promise<OutgoingRoomKeyRequest | null> {
        return Promise.resolve(this._getOutgoingRoomKeyRequest(requestBody));
    }

    /**
     * Looks for existing room key request, and returns the result synchronously.
     *
     * @internal
     *
     * @param requestBody - existing request to look for
     *
     * @returns
     *    the matching request, or null if not found
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    private _getOutgoingRoomKeyRequest(requestBody: IRoomKeyRequestBody): OutgoingRoomKeyRequest | null {
        for (const existing of this.outgoingRoomKeyRequests) {
            if (deepCompare(existing.requestBody, requestBody)) {
                return existing;
            }
        }
        return null;
    }

    /**
     * Look for room key requests by state
     *
     * @param wantedStates - list of acceptable states
     *
     * @returns resolves to the a
     *    {@link OutgoingRoomKeyRequest}, or null if
     *    there are no pending requests in those states
     */
    public getOutgoingRoomKeyRequestByState(wantedStates: number[]): Promise<OutgoingRoomKeyRequest | null> {
        for (const req of this.outgoingRoomKeyRequests) {
            for (const state of wantedStates) {
                if (req.state === state) {
                    return Promise.resolve(req);
                }
            }
        }
        return Promise.resolve(null);
    }

    /**
     *
     * @returns All OutgoingRoomKeyRequests in state
     */
    public getAllOutgoingRoomKeyRequestsByState(wantedState: number): Promise<OutgoingRoomKeyRequest[]> {
        return Promise.resolve(this.outgoingRoomKeyRequests.filter((r) => r.state == wantedState));
    }

    public getOutgoingRoomKeyRequestsByTarget(
        userId: string,
        deviceId: string,
        wantedStates: number[],
    ): Promise<OutgoingRoomKeyRequest[]> {
        const results: OutgoingRoomKeyRequest[] = [];

        for (const req of this.outgoingRoomKeyRequests) {
            for (const state of wantedStates) {
                if (
                    req.state === state &&
                    req.recipients.some((recipient) => recipient.userId === userId && recipient.deviceId === deviceId)
                ) {
                    results.push(req);
                }
            }
        }
        return Promise.resolve(results);
    }

    /**
     * Look for an existing room key request by id and state, and update it if
     * found
     *
     * @param requestId -      ID of request to update
     * @param expectedState -  state we expect to find the request in
     * @param updates -        name/value map of updates to apply
     *
     * @returns resolves to
     *    {@link OutgoingRoomKeyRequest}
     *    updated request, or null if no matching row was found
     */
    public updateOutgoingRoomKeyRequest(
        requestId: string,
        expectedState: number,
        updates: Partial<OutgoingRoomKeyRequest>,
    ): Promise<OutgoingRoomKeyRequest | null> {
        for (const req of this.outgoingRoomKeyRequests) {
            if (req.requestId !== requestId) {
                continue;
            }

            if (req.state !== expectedState) {
                logger.warn(
                    `Cannot update room key request from ${expectedState} ` +
                        `as it was already updated to ${req.state}`,
                );
                return Promise.resolve(null);
            }
            Object.assign(req, updates);
            return Promise.resolve(req);
        }

        return Promise.resolve(null);
    }

    /**
     * Look for an existing room key request by id and state, and delete it if
     * found
     *
     * @param requestId -      ID of request to update
     * @param expectedState -  state we expect to find the request in
     *
     * @returns resolves once the operation is completed
     */
    public deleteOutgoingRoomKeyRequest(
        requestId: string,
        expectedState: number,
    ): Promise<OutgoingRoomKeyRequest | null> {
        for (let i = 0; i < this.outgoingRoomKeyRequests.length; i++) {
            const req = this.outgoingRoomKeyRequests[i];

            if (req.requestId !== requestId) {
                continue;
            }

            if (req.state != expectedState) {
                logger.warn(`Cannot delete room key request in state ${req.state} ` + `(expected ${expectedState})`);
                return Promise.resolve(null);
            }

            this.outgoingRoomKeyRequests.splice(i, 1);
            return Promise.resolve(req);
        }

        return Promise.resolve(null);
    }

    // Olm Account

    public getAccount(txn: unknown, func: (accountPickle: string | null) => void): void {
        func(this.account);
    }

    public storeAccount(txn: unknown, accountPickle: string): void {
        this.account = accountPickle;
    }

    public getCrossSigningKeys(txn: unknown, func: (keys: Record<string, ICrossSigningKey> | null) => void): void {
        func(this.crossSigningKeys);
    }

    public getSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        func: (key: SecretStorePrivateKeys[K] | null) => void,
        type: K,
    ): void {
        const result = this.privateKeys[type] as SecretStorePrivateKeys[K] | undefined;
        func(result || null);
    }

    public storeCrossSigningKeys(txn: unknown, keys: Record<string, ICrossSigningKey>): void {
        this.crossSigningKeys = keys;
    }

    public storeSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        type: K,
        key: SecretStorePrivateKeys[K],
    ): void {
        this.privateKeys[type] = key;
    }

    // Olm Sessions

    public countEndToEndSessions(txn: unknown, func: (count: number) => void): void {
        func(Object.keys(this.sessions).length);
    }

    public getEndToEndSession(
        deviceKey: string,
        sessionId: string,
        txn: unknown,
        func: (session: ISessionInfo) => void,
    ): void {
        const deviceSessions = this.sessions[deviceKey] || {};
        func(deviceSessions[sessionId] || null);
    }

    public getEndToEndSessions(
        deviceKey: string,
        txn: unknown,
        func: (sessions: { [sessionId: string]: ISessionInfo }) => void,
    ): void {
        func(this.sessions[deviceKey] || {});
    }

    public getAllEndToEndSessions(txn: unknown, func: (session: ISessionInfo) => void): void {
        Object.entries(this.sessions).forEach(([deviceKey, deviceSessions]) => {
            Object.entries(deviceSessions).forEach(([sessionId, session]) => {
                func({
                    ...session,
                    deviceKey,
                    sessionId,
                });
            });
        });
    }

    public storeEndToEndSession(deviceKey: string, sessionId: string, sessionInfo: ISessionInfo, txn: unknown): void {
        let deviceSessions = this.sessions[deviceKey];
        if (deviceSessions === undefined) {
            deviceSessions = {};
            this.sessions[deviceKey] = deviceSessions;
        }
        safeSet(deviceSessions, sessionId, sessionInfo);
    }

    public async storeEndToEndSessionProblem(deviceKey: string, type: string, fixed: boolean): Promise<void> {
        const problems = (this.sessionProblems[deviceKey] = this.sessionProblems[deviceKey] || []);
        problems.push({ type, fixed, time: Date.now() });
        problems.sort((a, b) => {
            return a.time - b.time;
        });
    }

    public async getEndToEndSessionProblem(deviceKey: string, timestamp: number): Promise<IProblem | null> {
        const problems = this.sessionProblems[deviceKey] || [];
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
        const notifiedErrorDevices = this.notifiedErrorDevices;
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

        return ret;
    }

    // Inbound Group Sessions

    public getEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        txn: unknown,
        func: (groupSession: InboundGroupSessionData | null, groupSessionWithheld: IWithheld | null) => void,
    ): void {
        const k = senderCurve25519Key + "/" + sessionId;
        func(this.inboundGroupSessions[k] || null, this.inboundGroupSessionsWithheld[k] || null);
    }

    public getAllEndToEndInboundGroupSessions(txn: unknown, func: (session: ISession | null) => void): void {
        for (const key of Object.keys(this.inboundGroupSessions)) {
            // we can't use split, as the components we are trying to split out
            // might themselves contain '/' characters. We rely on the
            // senderKey being a (32-byte) curve25519 key, base64-encoded
            // (hence 43 characters long).

            func({
                senderKey: key.slice(0, 43),
                sessionId: key.slice(44),
                sessionData: this.inboundGroupSessions[key],
            });
        }
        func(null);
    }

    public addEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void {
        const k = senderCurve25519Key + "/" + sessionId;
        if (this.inboundGroupSessions[k] === undefined) {
            this.inboundGroupSessions[k] = sessionData;
        }
    }

    public storeEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void {
        this.inboundGroupSessions[senderCurve25519Key + "/" + sessionId] = sessionData;
    }

    public storeEndToEndInboundGroupSessionWithheld(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: IWithheld,
        txn: unknown,
    ): void {
        const k = senderCurve25519Key + "/" + sessionId;
        this.inboundGroupSessionsWithheld[k] = sessionData;
    }

    // Device Data

    public getEndToEndDeviceData(txn: unknown, func: (deviceData: IDeviceData | null) => void): void {
        func(this.deviceData);
    }

    public storeEndToEndDeviceData(deviceData: IDeviceData, txn: unknown): void {
        this.deviceData = deviceData;
    }

    // E2E rooms

    public storeEndToEndRoom(roomId: string, roomInfo: IRoomEncryption, txn: unknown): void {
        this.rooms[roomId] = roomInfo;
    }

    public getEndToEndRooms(txn: unknown, func: (rooms: Record<string, IRoomEncryption>) => void): void {
        func(this.rooms);
    }

    public getSessionsNeedingBackup(limit: number): Promise<ISession[]> {
        const sessions: ISession[] = [];
        for (const session in this.sessionsNeedingBackup) {
            if (this.inboundGroupSessions[session]) {
                sessions.push({
                    senderKey: session.slice(0, 43),
                    sessionId: session.slice(44),
                    sessionData: this.inboundGroupSessions[session],
                });
                if (limit && session.length >= limit) {
                    break;
                }
            }
        }
        return Promise.resolve(sessions);
    }

    public countSessionsNeedingBackup(): Promise<number> {
        return Promise.resolve(Object.keys(this.sessionsNeedingBackup).length);
    }

    public unmarkSessionsNeedingBackup(sessions: ISession[]): Promise<void> {
        for (const session of sessions) {
            const sessionKey = session.senderKey + "/" + session.sessionId;
            delete this.sessionsNeedingBackup[sessionKey];
        }
        return Promise.resolve();
    }

    public markSessionsNeedingBackup(sessions: ISession[]): Promise<void> {
        for (const session of sessions) {
            const sessionKey = session.senderKey + "/" + session.sessionId;
            this.sessionsNeedingBackup[sessionKey] = true;
        }
        return Promise.resolve();
    }

    public addSharedHistoryInboundGroupSession(roomId: string, senderKey: string, sessionId: string): void {
        const sessions = this.sharedHistoryInboundGroupSessions[roomId] || [];
        sessions.push([senderKey, sessionId]);
        this.sharedHistoryInboundGroupSessions[roomId] = sessions;
    }

    public getSharedHistoryInboundGroupSessions(roomId: string): Promise<[senderKey: string, sessionId: string][]> {
        return Promise.resolve(this.sharedHistoryInboundGroupSessions[roomId] || []);
    }

    public addParkedSharedHistory(roomId: string, parkedData: ParkedSharedHistory): void {
        const parked = this.parkedSharedHistory.get(roomId) ?? [];
        parked.push(parkedData);
        this.parkedSharedHistory.set(roomId, parked);
    }

    public takeParkedSharedHistory(roomId: string): Promise<ParkedSharedHistory[]> {
        const parked = this.parkedSharedHistory.get(roomId) ?? [];
        this.parkedSharedHistory.delete(roomId);
        return Promise.resolve(parked);
    }

    // Session key backups

    public doTxn<T>(mode: Mode, stores: Iterable<string>, func: (txn?: unknown) => T): Promise<T> {
        return Promise.resolve(func(null));
    }
}
