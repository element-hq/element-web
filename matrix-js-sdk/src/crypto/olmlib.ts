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
 * Utilities common to olm encryption algorithms
 */

import anotherjson from "another-json";

import type { PkSigning } from "@matrix-org/olm";
import type { IOneTimeKey } from "../@types/crypto";
import { OlmDevice } from "./OlmDevice";
import { DeviceInfo } from "./deviceinfo";
import { logger } from "../logger";
import { IClaimOTKsResult, MatrixClient } from "../client";
import { ISignatures } from "../@types/signed";
import { MatrixEvent } from "../models/event";
import { EventType } from "../@types/event";
import { IMessage } from "./algorithms/olm";
import { MapWithDefault } from "../utils";

enum Algorithm {
    Olm = "m.olm.v1.curve25519-aes-sha2",
    Megolm = "m.megolm.v1.aes-sha2",
    MegolmBackup = "m.megolm_backup.v1.curve25519-aes-sha2",
}

/**
 * matrix algorithm tag for olm
 */
export const OLM_ALGORITHM = Algorithm.Olm;

/**
 * matrix algorithm tag for megolm
 */
export const MEGOLM_ALGORITHM = Algorithm.Megolm;

/**
 * matrix algorithm tag for megolm backups
 */
export const MEGOLM_BACKUP_ALGORITHM = Algorithm.MegolmBackup;

export interface IOlmSessionResult {
    /** device info */
    device: DeviceInfo;
    /** base64 olm session id; null if no session could be established */
    sessionId: string | null;
}

/**
 * Encrypt an event payload for an Olm device
 *
 * @param resultsObject -  The `ciphertext` property
 *   of the m.room.encrypted event to which to add our result
 *
 * @param olmDevice - olm.js wrapper
 * @param payloadFields - fields to include in the encrypted payload
 *
 * Returns a promise which resolves (to undefined) when the payload
 *    has been encrypted into `resultsObject`
 */
export async function encryptMessageForDevice(
    resultsObject: Record<string, IMessage>,
    ourUserId: string,
    ourDeviceId: string | undefined,
    olmDevice: OlmDevice,
    recipientUserId: string,
    recipientDevice: DeviceInfo,
    payloadFields: Record<string, any>,
): Promise<void> {
    const deviceKey = recipientDevice.getIdentityKey();
    const sessionId = await olmDevice.getSessionIdForDevice(deviceKey);
    if (sessionId === null) {
        // If we don't have a session for a device then
        // we can't encrypt a message for it.
        logger.log(
            `[olmlib.encryptMessageForDevice] Unable to find Olm session for device ` +
                `${recipientUserId}:${recipientDevice.deviceId}`,
        );
        return;
    }

    logger.log(
        `[olmlib.encryptMessageForDevice] Using Olm session ${sessionId} for device ` +
            `${recipientUserId}:${recipientDevice.deviceId}`,
    );

    const payload = {
        sender: ourUserId,
        // TODO this appears to no longer be used whatsoever
        sender_device: ourDeviceId,

        // Include the Ed25519 key so that the recipient knows what
        // device this message came from.
        // We don't need to include the curve25519 key since the
        // recipient will already know this from the olm headers.
        // When combined with the device keys retrieved from the
        // homeserver signed by the ed25519 key this proves that
        // the curve25519 key and the ed25519 key are owned by
        // the same device.
        keys: {
            ed25519: olmDevice.deviceEd25519Key,
        },

        // include the recipient device details in the payload,
        // to avoid unknown key attacks, per
        // https://github.com/vector-im/vector-web/issues/2483
        recipient: recipientUserId,
        recipient_keys: {
            ed25519: recipientDevice.getFingerprint(),
        },
        ...payloadFields,
    };

    // TODO: technically, a bunch of that stuff only needs to be included for
    // pre-key messages: after that, both sides know exactly which devices are
    // involved in the session. If we're looking to reduce data transfer in the
    // future, we could elide them for subsequent messages.

    resultsObject[deviceKey] = await olmDevice.encryptMessage(deviceKey, sessionId, JSON.stringify(payload));
}

interface IExistingOlmSession {
    device: DeviceInfo;
    sessionId: string | null;
}

/**
 * Get the existing olm sessions for the given devices, and the devices that
 * don't have olm sessions.
 *
 *
 *
 * @param devicesByUser - map from userid to list of devices to ensure sessions for
 *
 * @returns resolves to an array.  The first element of the array is a
 *    a map of user IDs to arrays of deviceInfo, representing the devices that
 *    don't have established olm sessions.  The second element of the array is
 *    a map from userId to deviceId to {@link OlmSessionResult}
 */
export async function getExistingOlmSessions(
    olmDevice: OlmDevice,
    baseApis: MatrixClient,
    devicesByUser: Record<string, DeviceInfo[]>,
): Promise<[Map<string, DeviceInfo[]>, Map<string, Map<string, IExistingOlmSession>>]> {
    // map user Id → DeviceInfo[]
    const devicesWithoutSession: MapWithDefault<string, DeviceInfo[]> = new MapWithDefault(() => []);
    // map user Id → device Id → IExistingOlmSession
    const sessions: MapWithDefault<string, Map<string, IExistingOlmSession>> = new MapWithDefault(() => new Map());

    const promises: Promise<void>[] = [];

    for (const [userId, devices] of Object.entries(devicesByUser)) {
        for (const deviceInfo of devices) {
            const deviceId = deviceInfo.deviceId;
            const key = deviceInfo.getIdentityKey();
            promises.push(
                (async (): Promise<void> => {
                    const sessionId = await olmDevice.getSessionIdForDevice(key, true);
                    if (sessionId === null) {
                        devicesWithoutSession.getOrCreate(userId).push(deviceInfo);
                    } else {
                        sessions.getOrCreate(userId).set(deviceId, {
                            device: deviceInfo,
                            sessionId: sessionId,
                        });
                    }
                })(),
            );
        }
    }

    await Promise.all(promises);

    return [devicesWithoutSession, sessions];
}

/**
 * Try to make sure we have established olm sessions for the given devices.
 *
 * @param devicesByUser - map from userid to list of devices to ensure sessions for
 *
 * @param force - If true, establish a new session even if one
 *     already exists.
 *
 * @param otkTimeout - The timeout in milliseconds when requesting
 *     one-time keys for establishing new olm sessions.
 *
 * @param failedServers - An array to fill with remote servers that
 *     failed to respond to one-time-key requests.
 *
 * @param log - A possibly customised log
 *
 * @returns resolves once the sessions are complete, to
 *    an Object mapping from userId to deviceId to
 *    {@link OlmSessionResult}
 */
export async function ensureOlmSessionsForDevices(
    olmDevice: OlmDevice,
    baseApis: MatrixClient,
    devicesByUser: Map<string, DeviceInfo[]>,
    force = false,
    otkTimeout?: number,
    failedServers?: string[],
    log = logger,
): Promise<Map<string, Map<string, IOlmSessionResult>>> {
    const devicesWithoutSession: [string, string][] = [
        // [userId, deviceId], ...
    ];
    // map user Id → device Id → IExistingOlmSession
    const result: Map<string, Map<string, IExistingOlmSession>> = new Map();
    // map device key → resolve session fn
    const resolveSession: Map<string, (sessionId?: string) => void> = new Map();

    // Mark all sessions this task intends to update as in progress. It is
    // important to do this for all devices this task cares about in a single
    // synchronous operation, as otherwise it is possible to have deadlocks
    // where multiple tasks wait indefinitely on another task to update some set
    // of common devices.
    for (const devices of devicesByUser.values()) {
        for (const deviceInfo of devices) {
            const key = deviceInfo.getIdentityKey();

            if (key === olmDevice.deviceCurve25519Key) {
                // We don't start sessions with ourself, so there's no need to
                // mark it in progress.
                continue;
            }

            if (!olmDevice.sessionsInProgress[key]) {
                // pre-emptively mark the session as in-progress to avoid race
                // conditions.  If we find that we already have a session, then
                // we'll resolve
                olmDevice.sessionsInProgress[key] = new Promise((resolve) => {
                    resolveSession.set(key, (v: any): void => {
                        delete olmDevice.sessionsInProgress[key];
                        resolve(v);
                    });
                });
            }
        }
    }

    for (const [userId, devices] of devicesByUser) {
        const resultDevices = new Map();
        result.set(userId, resultDevices);

        for (const deviceInfo of devices) {
            const deviceId = deviceInfo.deviceId;
            const key = deviceInfo.getIdentityKey();

            if (key === olmDevice.deviceCurve25519Key) {
                // We should never be trying to start a session with ourself.
                // Apart from talking to yourself being the first sign of madness,
                // olm sessions can't do this because they get confused when
                // they get a message and see that the 'other side' has started a
                // new chain when this side has an active sender chain.
                // If you see this message being logged in the wild, we should find
                // the thing that is trying to send Olm messages to itself and fix it.
                log.info("Attempted to start session with ourself! Ignoring");
                // We must fill in the section in the return value though, as callers
                // expect it to be there.
                resultDevices.set(deviceId, {
                    device: deviceInfo,
                    sessionId: null,
                });
                continue;
            }

            const forWhom = `for ${key} (${userId}:${deviceId})`;
            const sessionId = await olmDevice.getSessionIdForDevice(key, !!resolveSession.get(key), log);
            const resolveSessionFn = resolveSession.get(key);
            if (sessionId !== null && resolveSessionFn) {
                // we found a session, but we had marked the session as
                // in-progress, so resolve it now, which will unmark it and
                // unblock anything that was waiting
                resolveSessionFn();
            }
            if (sessionId === null || force) {
                if (force) {
                    log.info(`Forcing new Olm session ${forWhom}`);
                } else {
                    log.info(`Making new Olm session ${forWhom}`);
                }
                devicesWithoutSession.push([userId, deviceId]);
            }
            resultDevices.set(deviceId, {
                device: deviceInfo,
                sessionId: sessionId,
            });
        }
    }

    if (devicesWithoutSession.length === 0) {
        return result;
    }

    const oneTimeKeyAlgorithm = "signed_curve25519";
    let res: IClaimOTKsResult;
    let taskDetail = `one-time keys for ${devicesWithoutSession.length} devices`;
    try {
        log.debug(`Claiming ${taskDetail}`);
        res = await baseApis.claimOneTimeKeys(devicesWithoutSession, oneTimeKeyAlgorithm, otkTimeout);
        log.debug(`Claimed ${taskDetail}`);
    } catch (e) {
        for (const resolver of resolveSession.values()) {
            resolver();
        }
        log.log(`Failed to claim ${taskDetail}`, e, devicesWithoutSession);
        throw e;
    }

    if (failedServers && "failures" in res) {
        failedServers.push(...Object.keys(res.failures));
    }

    const otkResult = res.one_time_keys || ({} as IClaimOTKsResult["one_time_keys"]);
    const promises: Promise<void>[] = [];
    for (const [userId, devices] of devicesByUser) {
        const userRes = otkResult[userId] || {};
        for (const deviceInfo of devices) {
            const deviceId = deviceInfo.deviceId;
            const key = deviceInfo.getIdentityKey();

            if (key === olmDevice.deviceCurve25519Key) {
                // We've already logged about this above. Skip here too
                // otherwise we'll log saying there are no one-time keys
                // which will be confusing.
                continue;
            }

            if (result.get(userId)?.get(deviceId)?.sessionId && !force) {
                // we already have a result for this device
                continue;
            }

            const deviceRes = userRes[deviceId] || {};
            let oneTimeKey: IOneTimeKey | null = null;
            for (const keyId in deviceRes) {
                if (keyId.indexOf(oneTimeKeyAlgorithm + ":") === 0) {
                    oneTimeKey = deviceRes[keyId];
                }
            }

            if (!oneTimeKey) {
                log.warn(`No one-time keys (alg=${oneTimeKeyAlgorithm}) ` + `for device ${userId}:${deviceId}`);
                resolveSession.get(key)?.();
                continue;
            }

            promises.push(
                _verifyKeyAndStartSession(olmDevice, oneTimeKey, userId, deviceInfo).then(
                    (sid) => {
                        resolveSession.get(key)?.(sid ?? undefined);
                        const deviceInfo = result.get(userId)?.get(deviceId);
                        if (deviceInfo) deviceInfo.sessionId = sid;
                    },
                    (e) => {
                        resolveSession.get(key)?.();
                        throw e;
                    },
                ),
            );
        }
    }

    taskDetail = `Olm sessions for ${promises.length} devices`;
    log.debug(`Starting ${taskDetail}`);
    await Promise.all(promises);
    log.debug(`Started ${taskDetail}`);
    return result;
}

async function _verifyKeyAndStartSession(
    olmDevice: OlmDevice,
    oneTimeKey: IOneTimeKey,
    userId: string,
    deviceInfo: DeviceInfo,
): Promise<string | null> {
    const deviceId = deviceInfo.deviceId;
    try {
        await verifySignature(olmDevice, oneTimeKey, userId, deviceId, deviceInfo.getFingerprint());
    } catch (e) {
        logger.error("Unable to verify signature on one-time key for device " + userId + ":" + deviceId + ":", e);
        return null;
    }

    let sid;
    try {
        sid = await olmDevice.createOutboundSession(deviceInfo.getIdentityKey(), oneTimeKey.key);
    } catch (e) {
        // possibly a bad key
        logger.error("Error starting olm session with device " + userId + ":" + deviceId + ": " + e);
        return null;
    }

    logger.log("Started new olm sessionid " + sid + " for device " + userId + ":" + deviceId);
    return sid;
}

export interface IObject {
    unsigned?: object;
    signatures?: ISignatures;
}

/**
 * Verify the signature on an object
 *
 * @param olmDevice - olm wrapper to use for verify op
 *
 * @param obj - object to check signature on.
 *
 * @param signingUserId -  ID of the user whose signature should be checked
 *
 * @param signingDeviceId -  ID of the device whose signature should be checked
 *
 * @param signingKey -   base64-ed ed25519 public key
 *
 * Returns a promise which resolves (to undefined) if the the signature is good,
 * or rejects with an Error if it is bad.
 */
export async function verifySignature(
    olmDevice: OlmDevice,
    obj: IOneTimeKey | IObject,
    signingUserId: string,
    signingDeviceId: string,
    signingKey: string,
): Promise<void> {
    const signKeyId = "ed25519:" + signingDeviceId;
    const signatures = obj.signatures || {};
    const userSigs = signatures[signingUserId] || {};
    const signature = userSigs[signKeyId];
    if (!signature) {
        throw Error("No signature");
    }

    // prepare the canonical json: remove unsigned and signatures, and stringify with anotherjson
    const mangledObj = Object.assign({}, obj);
    if ("unsigned" in mangledObj) {
        delete mangledObj.unsigned;
    }
    delete mangledObj.signatures;
    const json = anotherjson.stringify(mangledObj);

    olmDevice.verifySignature(signingKey, json, signature);
}

/**
 * Sign a JSON object using public key cryptography
 * @param obj - Object to sign.  The object will be modified to include
 *     the new signature
 * @param key - the signing object or the private key
 * seed
 * @param userId - The user ID who owns the signing key
 * @param pubKey - The public key (ignored if key is a seed)
 * @returns the signature for the object
 */
export function pkSign(obj: object & IObject, key: Uint8Array | PkSigning, userId: string, pubKey: string): string {
    let createdKey = false;
    if (key instanceof Uint8Array) {
        const keyObj = new global.Olm.PkSigning();
        pubKey = keyObj.init_with_seed(key);
        key = keyObj;
        createdKey = true;
    }
    const sigs = obj.signatures || {};
    delete obj.signatures;
    const unsigned = obj.unsigned;
    if (obj.unsigned) delete obj.unsigned;
    try {
        const mysigs = sigs[userId] || {};
        sigs[userId] = mysigs;

        return (mysigs["ed25519:" + pubKey] = key.sign(anotherjson.stringify(obj)));
    } finally {
        obj.signatures = sigs;
        if (unsigned) obj.unsigned = unsigned;
        if (createdKey) {
            key.free();
        }
    }
}

/**
 * Verify a signed JSON object
 * @param obj - Object to verify
 * @param pubKey - The public key to use to verify
 * @param userId - The user ID who signed the object
 */
export function pkVerify(obj: IObject, pubKey: string, userId: string): void {
    const keyId = "ed25519:" + pubKey;
    if (!(obj.signatures && obj.signatures[userId] && obj.signatures[userId][keyId])) {
        throw new Error("No signature");
    }
    const signature = obj.signatures[userId][keyId];
    const util = new global.Olm.Utility();
    const sigs = obj.signatures;
    delete obj.signatures;
    const unsigned = obj.unsigned;
    if (obj.unsigned) delete obj.unsigned;
    try {
        util.ed25519_verify(pubKey, anotherjson.stringify(obj), signature);
    } finally {
        obj.signatures = sigs;
        if (unsigned) obj.unsigned = unsigned;
        util.free();
    }
}

/**
 * Check that an event was encrypted using olm.
 */
export function isOlmEncrypted(event: MatrixEvent): boolean {
    if (!event.getSenderKey()) {
        logger.error("Event has no sender key (not encrypted?)");
        return false;
    }
    if (
        event.getWireType() !== EventType.RoomMessageEncrypted ||
        !["m.olm.v1.curve25519-aes-sha2"].includes(event.getWireContent().algorithm)
    ) {
        logger.error("Event was not encrypted using an appropriate algorithm");
        return false;
    }
    return true;
}

/**
 * Encode a typed array of uint8 as base64.
 * @param uint8Array - The data to encode.
 * @returns The base64.
 */
export function encodeBase64(uint8Array: ArrayBuffer | Uint8Array): string {
    return Buffer.from(uint8Array).toString("base64");
}

/**
 * Encode a typed array of uint8 as unpadded base64.
 * @param uint8Array - The data to encode.
 * @returns The unpadded base64.
 */
export function encodeUnpaddedBase64(uint8Array: ArrayBuffer | Uint8Array): string {
    return encodeBase64(uint8Array).replace(/=+$/g, "");
}

/**
 * Decode a base64 string to a typed array of uint8.
 * @param base64 - The base64 to decode.
 * @returns The decoded data.
 */
export function decodeBase64(base64: string): Uint8Array {
    return Buffer.from(base64, "base64");
}
