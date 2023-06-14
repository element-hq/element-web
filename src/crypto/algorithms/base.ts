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

/**
 * Internal module. Defines the base classes of the encryption implementations
 */

import type { IMegolmSessionData } from "../../@types/crypto";
import { MatrixClient } from "../../client";
import { Room } from "../../models/room";
import { OlmDevice } from "../OlmDevice";
import { IContent, MatrixEvent, RoomMember } from "../../matrix";
import { Crypto, IEncryptedContent, IEventDecryptionResult, IncomingRoomKeyRequest } from "..";
import { DeviceInfo } from "../deviceinfo";
import { IRoomEncryption } from "../RoomList";
import { DeviceInfoMap } from "../DeviceList";

/**
 * Map of registered encryption algorithm classes. A map from string to {@link EncryptionAlgorithm} class
 */
export const ENCRYPTION_CLASSES = new Map<string, new (params: IParams) => EncryptionAlgorithm>();

export type DecryptionClassParams<P extends IParams = IParams> = Omit<P, "deviceId" | "config">;

/**
 * map of registered encryption algorithm classes. Map from string to {@link DecryptionAlgorithm} class
 */
export const DECRYPTION_CLASSES = new Map<string, new (params: DecryptionClassParams) => DecryptionAlgorithm>();

export interface IParams {
    /** The UserID for the local user */
    userId: string;
    /** The identifier for this device. */
    deviceId: string;
    /** crypto core */
    crypto: Crypto;
    /** olm.js wrapper */
    olmDevice: OlmDevice;
    /** base matrix api interface */
    baseApis: MatrixClient;
    /** The ID of the room we will be sending to */
    roomId?: string;
    /** The body of the m.room.encryption event */
    config: IRoomEncryption & object;
}

/**
 * base type for encryption implementations
 */
export abstract class EncryptionAlgorithm {
    protected readonly userId: string;
    protected readonly deviceId: string;
    protected readonly crypto: Crypto;
    protected readonly olmDevice: OlmDevice;
    protected readonly baseApis: MatrixClient;
    protected readonly roomId?: string;

    /**
     * @param params - parameters
     */
    public constructor(params: IParams) {
        this.userId = params.userId;
        this.deviceId = params.deviceId;
        this.crypto = params.crypto;
        this.olmDevice = params.olmDevice;
        this.baseApis = params.baseApis;
        this.roomId = params.roomId;
    }

    /**
     * Perform any background tasks that can be done before a message is ready to
     * send, in order to speed up sending of the message.
     *
     * @param room - the room the event is in
     */
    public prepareToEncrypt(room: Room): void {}

    /**
     * Encrypt a message event
     *
     * @public
     *
     * @param content - event content
     *
     * @returns Promise which resolves to the new event body
     */
    public abstract encryptMessage(room: Room, eventType: string, content: IContent): Promise<IEncryptedContent>;

    /**
     * Called when the membership of a member of the room changes.
     *
     * @param event -  event causing the change
     * @param member -  user whose membership changed
     * @param oldMembership -  previous membership
     * @public
     */
    public onRoomMembership(event: MatrixEvent, member: RoomMember, oldMembership?: string): void {}

    public reshareKeyWithDevice?(
        senderKey: string,
        sessionId: string,
        userId: string,
        device: DeviceInfo,
    ): Promise<void>;

    public forceDiscardSession?(): void;
}

/**
 * base type for decryption implementations
 */
export abstract class DecryptionAlgorithm {
    protected readonly userId: string;
    protected readonly crypto: Crypto;
    protected readonly olmDevice: OlmDevice;
    protected readonly baseApis: MatrixClient;
    protected readonly roomId?: string;

    public constructor(params: DecryptionClassParams) {
        this.userId = params.userId;
        this.crypto = params.crypto;
        this.olmDevice = params.olmDevice;
        this.baseApis = params.baseApis;
        this.roomId = params.roomId;
    }

    /**
     * Decrypt an event
     *
     * @param event - undecrypted event
     *
     * @returns promise which
     * resolves once we have finished decrypting. Rejects with an
     * `algorithms.DecryptionError` if there is a problem decrypting the event.
     */
    public abstract decryptEvent(event: MatrixEvent): Promise<IEventDecryptionResult>;

    /**
     * Handle a key event
     *
     * @param params - event key event
     */
    public async onRoomKeyEvent(params: MatrixEvent): Promise<void> {
        // ignore by default
    }

    /**
     * Import a room key
     *
     * @param opts - object
     */
    public async importRoomKey(session: IMegolmSessionData, opts: object): Promise<void> {
        // ignore by default
    }

    /**
     * Determine if we have the keys necessary to respond to a room key request
     *
     * @returns true if we have the keys and could (theoretically) share
     *  them; else false.
     */
    public hasKeysForKeyRequest(keyRequest: IncomingRoomKeyRequest): Promise<boolean> {
        return Promise.resolve(false);
    }

    /**
     * Send the response to a room key request
     *
     */
    public shareKeysWithDevice(keyRequest: IncomingRoomKeyRequest): void {
        throw new Error("shareKeysWithDevice not supported for this DecryptionAlgorithm");
    }

    /**
     * Retry decrypting all the events from a sender that haven't been
     * decrypted yet.
     *
     * @param senderKey - the sender's key
     */
    public async retryDecryptionFromSender(senderKey: string): Promise<boolean> {
        // ignore by default
        return false;
    }

    public onRoomKeyWithheldEvent?(event: MatrixEvent): Promise<void>;
    public sendSharedHistoryInboundSessions?(devicesByUser: Map<string, DeviceInfo[]>): Promise<void>;
}

/**
 * Exception thrown when decryption fails
 *
 * @param msg - user-visible message describing the problem
 *
 * @param details - key/value pairs reported in the logs but not shown
 *   to the user.
 */
export class DecryptionError extends Error {
    public readonly detailedString: string;

    public constructor(public readonly code: string, msg: string, details?: Record<string, string | Error>) {
        super(msg);
        this.code = code;
        this.name = "DecryptionError";
        this.detailedString = detailedStringForDecryptionError(this, details);
    }
}

function detailedStringForDecryptionError(err: DecryptionError, details?: Record<string, string | Error>): string {
    let result = err.name + "[msg: " + err.message;

    if (details) {
        result +=
            ", " +
            Object.keys(details)
                .map((k) => k + ": " + details[k])
                .join(", ");
    }

    result += "]";

    return result;
}

export class UnknownDeviceError extends Error {
    /**
     * Exception thrown specifically when we want to warn the user to consider
     * the security of their conversation before continuing
     *
     * @param msg - message describing the problem
     * @param devices - set of unknown devices per user we're warning about
     */
    public constructor(msg: string, public readonly devices: DeviceInfoMap, public event?: MatrixEvent) {
        super(msg);
        this.name = "UnknownDeviceError";
        this.devices = devices;
    }
}

/**
 * Registers an encryption/decryption class for a particular algorithm
 *
 * @param algorithm - algorithm tag to register for
 *
 * @param encryptor - {@link EncryptionAlgorithm} implementation
 *
 * @param decryptor - {@link DecryptionAlgorithm} implementation
 */
export function registerAlgorithm<P extends IParams = IParams>(
    algorithm: string,
    encryptor: new (params: P) => EncryptionAlgorithm,
    decryptor: new (params: DecryptionClassParams<P>) => DecryptionAlgorithm,
): void {
    ENCRYPTION_CLASSES.set(algorithm, encryptor as new (params: IParams) => EncryptionAlgorithm);
    DECRYPTION_CLASSES.set(algorithm, decryptor as new (params: DecryptionClassParams) => DecryptionAlgorithm);
}
