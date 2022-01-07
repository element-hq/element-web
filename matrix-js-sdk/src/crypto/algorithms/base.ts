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
 *
 * @module
 */

import { MatrixClient } from "../../client";
import { Room } from "../../models/room";
import { OlmDevice } from "../OlmDevice";
import { MatrixEvent, RoomMember } from "../..";
import { Crypto, IEventDecryptionResult, IMegolmSessionData, IncomingRoomKeyRequest } from "..";
import { DeviceInfo } from "../deviceinfo";
import { IRoomEncryption } from "../RoomList";

/**
 * map of registered encryption algorithm classes. A map from string to {@link
 * module:crypto/algorithms/base.EncryptionAlgorithm|EncryptionAlgorithm} class
 *
 * @type {Object.<string, function(new: module:crypto/algorithms/base.EncryptionAlgorithm)>}
 */
export const ENCRYPTION_CLASSES: Record<string, new (params: IParams) => EncryptionAlgorithm> = {};

type DecryptionClassParams = Omit<IParams, "deviceId" | "config">;

/**
 * map of registered encryption algorithm classes. Map from string to {@link
 * module:crypto/algorithms/base.DecryptionAlgorithm|DecryptionAlgorithm} class
 *
 * @type {Object.<string, function(new: module:crypto/algorithms/base.DecryptionAlgorithm)>}
 */
export const DECRYPTION_CLASSES: Record<string, new (params: DecryptionClassParams) => DecryptionAlgorithm> = {};

export interface IParams {
    userId: string;
    deviceId: string;
    crypto: Crypto;
    olmDevice: OlmDevice;
    baseApis: MatrixClient;
    roomId: string;
    config: IRoomEncryption & object;
}

/**
 * base type for encryption implementations
 *
 * @alias module:crypto/algorithms/base.EncryptionAlgorithm
 *
 * @param {object} params parameters
 * @param {string} params.userId  The UserID for the local user
 * @param {string} params.deviceId The identifier for this device.
 * @param {module:crypto} params.crypto crypto core
 * @param {module:crypto/OlmDevice} params.olmDevice olm.js wrapper
 * @param {MatrixClient} baseApis base matrix api interface
 * @param {string} params.roomId  The ID of the room we will be sending to
 * @param {object} params.config  The body of the m.room.encryption event
 */
export abstract class EncryptionAlgorithm {
    protected readonly userId: string;
    protected readonly deviceId: string;
    protected readonly crypto: Crypto;
    protected readonly olmDevice: OlmDevice;
    protected readonly baseApis: MatrixClient;
    protected readonly roomId: string;

    constructor(params: IParams) {
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
     * @param {module:models/room} room the room the event is in
     */
    public prepareToEncrypt(room: Room): void {}

    /**
     * Encrypt a message event
     *
     * @method module:crypto/algorithms/base.EncryptionAlgorithm.encryptMessage
     * @public
     * @abstract
     *
     * @param {module:models/room} room
     * @param {string} eventType
     * @param {object} content event content
     *
     * @return {Promise} Promise which resolves to the new event body
     */
    public abstract encryptMessage(room: Room, eventType: string, content: object): Promise<object>;

    /**
     * Called when the membership of a member of the room changes.
     *
     * @param {module:models/event.MatrixEvent} event  event causing the change
     * @param {module:models/room-member} member  user whose membership changed
     * @param {string=} oldMembership  previous membership
     * @public
     * @abstract
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
 *
 * @alias module:crypto/algorithms/base.DecryptionAlgorithm
 * @param {object} params parameters
 * @param {string} params.userId  The UserID for the local user
 * @param {module:crypto} params.crypto crypto core
 * @param {module:crypto/OlmDevice} params.olmDevice olm.js wrapper
 * @param {MatrixClient} baseApis base matrix api interface
 * @param {string=} params.roomId The ID of the room we will be receiving
 *     from. Null for to-device events.
 */
export abstract class DecryptionAlgorithm {
    protected readonly userId: string;
    protected readonly crypto: Crypto;
    protected readonly olmDevice: OlmDevice;
    protected readonly baseApis: MatrixClient;
    protected readonly roomId: string;

    constructor(params: DecryptionClassParams) {
        this.userId = params.userId;
        this.crypto = params.crypto;
        this.olmDevice = params.olmDevice;
        this.baseApis = params.baseApis;
        this.roomId = params.roomId;
    }

    /**
     * Decrypt an event
     *
     * @method module:crypto/algorithms/base.DecryptionAlgorithm#decryptEvent
     * @abstract
     *
     * @param {MatrixEvent} event undecrypted event
     *
     * @return {Promise<module:crypto~EventDecryptionResult>} promise which
     * resolves once we have finished decrypting. Rejects with an
     * `algorithms.DecryptionError` if there is a problem decrypting the event.
     */
    public abstract decryptEvent(event: MatrixEvent): Promise<IEventDecryptionResult>;

    /**
     * Handle a key event
     *
     * @method module:crypto/algorithms/base.DecryptionAlgorithm#onRoomKeyEvent
     *
     * @param {module:models/event.MatrixEvent} params event key event
     */
    public onRoomKeyEvent(params: MatrixEvent): void {
        // ignore by default
    }

    /**
     * Import a room key
     *
     * @param {module:crypto/OlmDevice.MegolmSessionData} session
     * @param {object} opts object
     */
    public async importRoomKey(session: IMegolmSessionData, opts: object): Promise<void> {
        // ignore by default
    }

    /**
     * Determine if we have the keys necessary to respond to a room key request
     *
     * @param {module:crypto~IncomingRoomKeyRequest} keyRequest
     * @return {Promise<boolean>} true if we have the keys and could (theoretically) share
     *  them; else false.
     */
    public hasKeysForKeyRequest(keyRequest: IncomingRoomKeyRequest): Promise<boolean> {
        return Promise.resolve(false);
    }

    /**
     * Send the response to a room key request
     *
     * @param {module:crypto~IncomingRoomKeyRequest} keyRequest
     */
    public shareKeysWithDevice(keyRequest: IncomingRoomKeyRequest): void {
        throw new Error("shareKeysWithDevice not supported for this DecryptionAlgorithm");
    }

    /**
     * Retry decrypting all the events from a sender that haven't been
     * decrypted yet.
     *
     * @param {string} senderKey the sender's key
     */
    public async retryDecryptionFromSender(senderKey: string): Promise<boolean> {
        // ignore by default
        return false;
    }

    public onRoomKeyWithheldEvent?(event: MatrixEvent): Promise<void>;
    public sendSharedHistoryInboundSessions?(devicesByUser: Record<string, DeviceInfo[]>): Promise<void>;
}

/**
 * Exception thrown when decryption fails
 *
 * @alias module:crypto/algorithms/base.DecryptionError
 * @param {string} msg user-visible message describing the problem
 *
 * @param {Object=} details key/value pairs reported in the logs but not shown
 *   to the user.
 *
 * @extends Error
 */
export class DecryptionError extends Error {
    public readonly detailedString: string;

    constructor(public readonly code: string, msg: string, details?: Record<string, string>) {
        super(msg);
        this.code = code;
        this.name = 'DecryptionError';
        this.detailedString = detailedStringForDecryptionError(this, details);
    }
}

function detailedStringForDecryptionError(err: DecryptionError, details?: Record<string, string>): string {
    let result = err.name + '[msg: ' + err.message;

    if (details) {
        result += ', ' + Object.keys(details).map((k) => k + ': ' + details[k]).join(', ');
    }

    result += ']';

    return result;
}

/**
 * Exception thrown specifically when we want to warn the user to consider
 * the security of their conversation before continuing
 *
 * @param {string} msg message describing the problem
 * @param {Object} devices userId -> {deviceId -> object}
 *      set of unknown devices per user we're warning about
 * @extends Error
 */
export class UnknownDeviceError extends Error {
    constructor(msg: string, public readonly devices: Record<string, Record<string, object>>) {
        super(msg);
        this.name = "UnknownDeviceError";
        this.devices = devices;
    }
}

/**
 * Registers an encryption/decryption class for a particular algorithm
 *
 * @param {string} algorithm algorithm tag to register for
 *
 * @param {class} encryptor {@link
 *     module:crypto/algorithms/base.EncryptionAlgorithm|EncryptionAlgorithm}
 *     implementation
 *
 * @param {class} decryptor {@link
 *     module:crypto/algorithms/base.DecryptionAlgorithm|DecryptionAlgorithm}
 *     implementation
 */
export function registerAlgorithm(
    algorithm: string,
    encryptor: new (params: IParams) => EncryptionAlgorithm,
    decryptor: new (params: Omit<IParams, "deviceId">) => DecryptionAlgorithm,
): void {
    ENCRYPTION_CLASSES[algorithm] = encryptor;
    DECRYPTION_CLASSES[algorithm] = decryptor;
}
