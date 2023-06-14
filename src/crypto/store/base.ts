/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { IRoomKeyRequestBody, IRoomKeyRequestRecipient } from "../index";
import { RoomKeyRequestState } from "../OutgoingRoomKeyRequestManager";
import { ICrossSigningKey } from "../../client";
import { IOlmDevice } from "../algorithms/megolm";
import { TrackingStatus } from "../DeviceList";
import { IRoomEncryption } from "../RoomList";
import { IDevice } from "../deviceinfo";
import { ICrossSigningInfo } from "../CrossSigning";
import { PrefixedLogger } from "../../logger";
import { InboundGroupSessionData } from "../OlmDevice";
import { MatrixEvent } from "../../models/event";
import { DehydrationManager } from "../dehydration";
import { IEncryptedPayload } from "../aes";

/**
 * Internal module. Definitions for storage for the crypto module
 */

export interface SecretStorePrivateKeys {
    "dehydration": {
        keyInfo: DehydrationManager["keyInfo"];
        key: IEncryptedPayload;
        deviceDisplayName: string;
        time: number;
    } | null;
    "m.megolm_backup.v1": IEncryptedPayload;
}

/**
 * Abstraction of things that can store data required for end-to-end encryption
 */
export interface CryptoStore {
    startup(): Promise<CryptoStore>;
    deleteAllData(): Promise<void>;
    getOrAddOutgoingRoomKeyRequest(request: OutgoingRoomKeyRequest): Promise<OutgoingRoomKeyRequest>;
    getOutgoingRoomKeyRequest(requestBody: IRoomKeyRequestBody): Promise<OutgoingRoomKeyRequest | null>;
    getOutgoingRoomKeyRequestByState(wantedStates: number[]): Promise<OutgoingRoomKeyRequest | null>;
    getAllOutgoingRoomKeyRequestsByState(wantedState: number): Promise<OutgoingRoomKeyRequest[]>;
    getOutgoingRoomKeyRequestsByTarget(
        userId: string,
        deviceId: string,
        wantedStates: number[],
    ): Promise<OutgoingRoomKeyRequest[]>;
    updateOutgoingRoomKeyRequest(
        requestId: string,
        expectedState: number,
        updates: Partial<OutgoingRoomKeyRequest>,
    ): Promise<OutgoingRoomKeyRequest | null>;
    deleteOutgoingRoomKeyRequest(requestId: string, expectedState: number): Promise<OutgoingRoomKeyRequest | null>;

    // Olm Account
    getAccount(txn: unknown, func: (accountPickle: string | null) => void): void;
    storeAccount(txn: unknown, accountPickle: string): void;
    getCrossSigningKeys(txn: unknown, func: (keys: Record<string, ICrossSigningKey> | null) => void): void;
    getSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        func: (key: SecretStorePrivateKeys[K] | null) => void,
        type: K,
    ): void;
    storeCrossSigningKeys(txn: unknown, keys: Record<string, ICrossSigningKey>): void;
    storeSecretStorePrivateKey<K extends keyof SecretStorePrivateKeys>(
        txn: unknown,
        type: K,
        key: SecretStorePrivateKeys[K],
    ): void;

    // Olm Sessions
    countEndToEndSessions(txn: unknown, func: (count: number) => void): void;
    getEndToEndSession(
        deviceKey: string,
        sessionId: string,
        txn: unknown,
        func: (session: ISessionInfo | null) => void,
    ): void;
    getEndToEndSessions(
        deviceKey: string,
        txn: unknown,
        func: (sessions: { [sessionId: string]: ISessionInfo }) => void,
    ): void;
    getAllEndToEndSessions(txn: unknown, func: (session: ISessionInfo | null) => void): void;
    storeEndToEndSession(deviceKey: string, sessionId: string, sessionInfo: ISessionInfo, txn: unknown): void;
    storeEndToEndSessionProblem(deviceKey: string, type: string, fixed: boolean): Promise<void>;
    getEndToEndSessionProblem(deviceKey: string, timestamp: number): Promise<IProblem | null>;
    filterOutNotifiedErrorDevices(devices: IOlmDevice[]): Promise<IOlmDevice[]>;

    // Inbound Group Sessions
    getEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        txn: unknown,
        func: (groupSession: InboundGroupSessionData | null, groupSessionWithheld: IWithheld | null) => void,
    ): void;
    getAllEndToEndInboundGroupSessions(txn: unknown, func: (session: ISession | null) => void): void;
    addEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void;
    storeEndToEndInboundGroupSession(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: InboundGroupSessionData,
        txn: unknown,
    ): void;
    storeEndToEndInboundGroupSessionWithheld(
        senderCurve25519Key: string,
        sessionId: string,
        sessionData: IWithheld,
        txn: unknown,
    ): void;

    // Device Data
    getEndToEndDeviceData(txn: unknown, func: (deviceData: IDeviceData | null) => void): void;
    storeEndToEndDeviceData(deviceData: IDeviceData, txn: unknown): void;
    storeEndToEndRoom(roomId: string, roomInfo: IRoomEncryption, txn: unknown): void;
    getEndToEndRooms(txn: unknown, func: (rooms: Record<string, IRoomEncryption>) => void): void;
    getSessionsNeedingBackup(limit: number): Promise<ISession[]>;
    countSessionsNeedingBackup(txn?: unknown): Promise<number>;
    unmarkSessionsNeedingBackup(sessions: ISession[], txn?: unknown): Promise<void>;
    markSessionsNeedingBackup(sessions: ISession[], txn?: unknown): Promise<void>;
    addSharedHistoryInboundGroupSession(roomId: string, senderKey: string, sessionId: string, txn?: unknown): void;
    getSharedHistoryInboundGroupSessions(
        roomId: string,
        txn?: unknown,
    ): Promise<[senderKey: string, sessionId: string][]>;
    addParkedSharedHistory(roomId: string, data: ParkedSharedHistory, txn?: unknown): void;
    takeParkedSharedHistory(roomId: string, txn?: unknown): Promise<ParkedSharedHistory[]>;

    // Session key backups
    doTxn<T>(mode: Mode, stores: Iterable<string>, func: (txn: unknown) => T, log?: PrefixedLogger): Promise<T>;
}

export type Mode = "readonly" | "readwrite";

export interface ISession {
    senderKey: string;
    sessionId: string;
    sessionData?: InboundGroupSessionData;
}

export interface ISessionInfo {
    deviceKey?: string;
    sessionId?: string;
    session?: string;
    lastReceivedMessageTs?: number;
}

export interface IDeviceData {
    devices: {
        [userId: string]: {
            [deviceId: string]: IDevice;
        };
    };
    trackingStatus: {
        [userId: string]: TrackingStatus;
    };
    crossSigningInfo?: Record<string, ICrossSigningInfo>;
    syncToken?: string;
}

export interface IProblem {
    type: string;
    fixed: boolean;
    time: number;
}

export interface IWithheld {
    // eslint-disable-next-line camelcase
    room_id: string;
    code: string;
    reason: string;
}

/**
 * Represents an outgoing room key request
 */
export interface OutgoingRoomKeyRequest {
    /**
     * Unique id for this request. Used for both an id within the request for later pairing with a cancellation,
     * and for the transaction id when sending the to_device messages to our local server.
     */
    requestId: string;
    requestTxnId?: string;
    /**
     * Transaction id for the cancellation, if any
     */
    cancellationTxnId?: string;
    /**
     * List of recipients for the request
     */
    recipients: IRoomKeyRequestRecipient[];
    /**
     * Parameters for the request
     */
    requestBody: IRoomKeyRequestBody;
    /**
     * current state of this request
     */
    state: RoomKeyRequestState;
}

export interface ParkedSharedHistory {
    senderId: string;
    senderKey: string;
    sessionId: string;
    sessionKey: string;
    keysClaimed: ReturnType<MatrixEvent["getKeysClaimed"]>; // XXX: Less type dependence on MatrixEvent
    forwardingCurve25519KeyChain: string[];
}
