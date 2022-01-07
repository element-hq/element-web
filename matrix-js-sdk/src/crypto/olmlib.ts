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
 * @module olmlib
 *
 * Utilities common to olm encryption algorithms
 */

import anotherjson from "another-json";
import { Logger } from "loglevel";

import type { PkSigning } from "@matrix-org/olm";
import { OlmDevice } from "./OlmDevice";
import { DeviceInfo } from "./deviceinfo";
import { logger } from '../logger';
import { IOneTimeKey } from "./dehydration";
import { IClaimOTKsResult, MatrixClient } from "../client";
import { ISignatures } from "../@types/signed";

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
    device: DeviceInfo;
    sessionId?: string;
}

/**
 * Encrypt an event payload for an Olm device
 *
 * @param {Object<string, string>} resultsObject  The `ciphertext` property
 *   of the m.room.encrypted event to which to add our result
 *
 * @param {string} ourUserId
 * @param {string} ourDeviceId
 * @param {module:crypto/OlmDevice} olmDevice olm.js wrapper
 * @param {string} recipientUserId
 * @param {module:crypto/deviceinfo} recipientDevice
 * @param {object} payloadFields fields to include in the encrypted payload
 *
 * Returns a promise which resolves (to undefined) when the payload
 *    has been encrypted into `resultsObject`
 */
export async function encryptMessageForDevice(
    resultsObject: Record<string, string>,
    ourUserId: string,
    ourDeviceId: string,
    olmDevice: OlmDevice,
    recipientUserId: string,
    recipientDevice: DeviceInfo,
    payloadFields: Record<string, any>,
) {
    const deviceKey = recipientDevice.getIdentityKey();
    const sessionId = await olmDevice.getSessionIdForDevice(deviceKey);
    if (sessionId === null) {
        // If we don't have a session for a device then
        // we can't encrypt a message for it.
        return;
    }

    logger.log(
        "Using sessionid " + sessionId + " for device " +
            recipientUserId + ":" + recipientDevice.deviceId,
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
            "ed25519": olmDevice.deviceEd25519Key,
        },

        // include the recipient device details in the payload,
        // to avoid unknown key attacks, per
        // https://github.com/vector-im/vector-web/issues/2483
        recipient: recipientUserId,
        recipient_keys: {
            "ed25519": recipientDevice.getFingerprint(),
        },
    };

    // TODO: technically, a bunch of that stuff only needs to be included for
    // pre-key messages: after that, both sides know exactly which devices are
    // involved in the session. If we're looking to reduce data transfer in the
    // future, we could elide them for subsequent messages.

    Object.assign(payload, payloadFields);

    resultsObject[deviceKey] = await olmDevice.encryptMessage(
        deviceKey, sessionId, JSON.stringify(payload),
    );
}

interface IExistingOlmSession {
    device: DeviceInfo;
    sessionId?: string;
}

/**
 * Get the existing olm sessions for the given devices, and the devices that
 * don't have olm sessions.
 *
 * @param {module:crypto/OlmDevice} olmDevice
 *
 * @param {MatrixClient} baseApis
 *
 * @param {object<string, module:crypto/deviceinfo[]>} devicesByUser
 *    map from userid to list of devices to ensure sessions for
 *
 * @return {Promise} resolves to an array.  The first element of the array is a
 *    a map of user IDs to arrays of deviceInfo, representing the devices that
 *    don't have established olm sessions.  The second element of the array is
 *    a map from userId to deviceId to {@link module:crypto~OlmSessionResult}
 */
export async function getExistingOlmSessions(
    olmDevice: OlmDevice,
    baseApis: MatrixClient,
    devicesByUser: Record<string, DeviceInfo[]>,
): Promise<[Record<string, DeviceInfo[]>, Record<string, Record<string, IExistingOlmSession>>]> {
    const devicesWithoutSession: {[userId: string]: DeviceInfo[]} = {};
    const sessions: {[userId: string]: {[deviceId: string]: IExistingOlmSession}} = {};

    const promises: Promise<void>[] = [];

    for (const [userId, devices] of Object.entries(devicesByUser)) {
        for (const deviceInfo of devices) {
            const deviceId = deviceInfo.deviceId;
            const key = deviceInfo.getIdentityKey();
            promises.push((async () => {
                const sessionId = await olmDevice.getSessionIdForDevice(
                    key, true,
                );
                if (sessionId === null) {
                    devicesWithoutSession[userId] = devicesWithoutSession[userId] || [];
                    devicesWithoutSession[userId].push(deviceInfo);
                } else {
                    sessions[userId] = sessions[userId] || {};
                    sessions[userId][deviceId] = {
                        device: deviceInfo,
                        sessionId: sessionId,
                    };
                }
            })());
        }
    }

    await Promise.all(promises);

    return [devicesWithoutSession, sessions];
}

/**
 * Try to make sure we have established olm sessions for the given devices.
 *
 * @param {module:crypto/OlmDevice} olmDevice
 *
 * @param {MatrixClient} baseApis
 *
 * @param {object<string, module:crypto/deviceinfo[]>} devicesByUser
 *    map from userid to list of devices to ensure sessions for
 *
 * @param {boolean} [force=false] If true, establish a new session even if one
 *     already exists.
 *
 * @param {Number} [otkTimeout] The timeout in milliseconds when requesting
 *     one-time keys for establishing new olm sessions.
 *
 * @param {Array} [failedServers] An array to fill with remote servers that
 *     failed to respond to one-time-key requests.
 *
 * @param {Logger} [log] A possibly customised log
 *
 * @return {Promise} resolves once the sessions are complete, to
 *    an Object mapping from userId to deviceId to
 *    {@link module:crypto~OlmSessionResult}
 */
export async function ensureOlmSessionsForDevices(
    olmDevice: OlmDevice,
    baseApis: MatrixClient,
    devicesByUser: Record<string, DeviceInfo[]>,
    force = false,
    otkTimeout?: number,
    failedServers?: string[],
    log: Logger = logger,
): Promise<Record<string, Record<string, IOlmSessionResult>>> {
    if (typeof force === "number") {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - backwards compatibility
        log = failedServers;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - backwards compatibility
        failedServers = otkTimeout;
        otkTimeout = force;
        force = false;
    }

    const devicesWithoutSession: [string, string][] = [
        // [userId, deviceId], ...
    ];
    const result: {[userId: string]: {[deviceId: string]: IExistingOlmSession}} = {};
    const resolveSession: Record<string, (sessionId?: string) => void> = {};

    // Mark all sessions this task intends to update as in progress. It is
    // important to do this for all devices this task cares about in a single
    // synchronous operation, as otherwise it is possible to have deadlocks
    // where multiple tasks wait indefinitely on another task to update some set
    // of common devices.
    for (const [, devices] of Object.entries(devicesByUser)) {
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
                olmDevice.sessionsInProgress[key] = new Promise(resolve => {
                    resolveSession[key] = (v: any) => {
                        delete olmDevice.sessionsInProgress[key];
                        resolve(v);
                    };
                });
            }
        }
    }

    for (const [userId, devices] of Object.entries(devicesByUser)) {
        result[userId] = {};
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
                result[userId][deviceId] = {
                    device: deviceInfo,
                    sessionId: null,
                };
                continue;
            }

            const forWhom = `for ${key} (${userId}:${deviceId})`;
            const sessionId = await olmDevice.getSessionIdForDevice(key, !!resolveSession[key], log);
            if (sessionId !== null && resolveSession[key]) {
                // we found a session, but we had marked the session as
                // in-progress, so resolve it now, which will unmark it and
                // unblock anything that was waiting
                resolveSession[key]();
            }
            if (sessionId === null || force) {
                if (force) {
                    log.info(`Forcing new Olm session ${forWhom}`);
                } else {
                    log.info(`Making new Olm session ${forWhom}`);
                }
                devicesWithoutSession.push([userId, deviceId]);
            }
            result[userId][deviceId] = {
                device: deviceInfo,
                sessionId: sessionId,
            };
        }
    }

    if (devicesWithoutSession.length === 0) {
        return result;
    }

    const oneTimeKeyAlgorithm = "signed_curve25519";
    let res;
    let taskDetail = `one-time keys for ${devicesWithoutSession.length} devices`;
    try {
        log.debug(`Claiming ${taskDetail}`);
        res = await baseApis.claimOneTimeKeys(devicesWithoutSession, oneTimeKeyAlgorithm, otkTimeout);
        log.debug(`Claimed ${taskDetail}`);
    } catch (e) {
        for (const resolver of Object.values(resolveSession)) {
            resolver();
        }
        log.log(`Failed to claim ${taskDetail}`, e, devicesWithoutSession);
        throw e;
    }

    if (failedServers && "failures" in res) {
        failedServers.push(...Object.keys(res.failures));
    }

    const otkResult = res.one_time_keys || {} as IClaimOTKsResult["one_time_keys"];
    const promises: Promise<void>[] = [];
    for (const [userId, devices] of Object.entries(devicesByUser)) {
        const userRes = otkResult[userId] || {};
        for (let j = 0; j < devices.length; j++) {
            const deviceInfo = devices[j];
            const deviceId = deviceInfo.deviceId;
            const key = deviceInfo.getIdentityKey();

            if (key === olmDevice.deviceCurve25519Key) {
                // We've already logged about this above. Skip here too
                // otherwise we'll log saying there are no one-time keys
                // which will be confusing.
                continue;
            }

            if (result[userId][deviceId].sessionId && !force) {
                // we already have a result for this device
                continue;
            }

            const deviceRes = userRes[deviceId] || {};
            let oneTimeKey: IOneTimeKey = null;
            for (const keyId in deviceRes) {
                if (keyId.indexOf(oneTimeKeyAlgorithm + ":") === 0) {
                    oneTimeKey = deviceRes[keyId];
                }
            }

            if (!oneTimeKey) {
                log.warn(
                    `No one-time keys (alg=${oneTimeKeyAlgorithm}) ` +
                    `for device ${userId}:${deviceId}`,
                );
                if (resolveSession[key]) {
                    resolveSession[key]();
                }
                continue;
            }

            promises.push(
                _verifyKeyAndStartSession(
                    olmDevice, oneTimeKey, userId, deviceInfo,
                ).then((sid) => {
                    if (resolveSession[key]) {
                        resolveSession[key](sid);
                    }
                    result[userId][deviceId].sessionId = sid;
                }, (e) => {
                    if (resolveSession[key]) {
                        resolveSession[key]();
                    }
                    throw e;
                }),
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
): Promise<string> {
    const deviceId = deviceInfo.deviceId;
    try {
        await verifySignature(
            olmDevice, oneTimeKey, userId, deviceId,
            deviceInfo.getFingerprint(),
        );
    } catch (e) {
        logger.error(
            "Unable to verify signature on one-time key for device " +
                userId + ":" + deviceId + ":", e,
        );
        return null;
    }

    let sid;
    try {
        sid = await olmDevice.createOutboundSession(
            deviceInfo.getIdentityKey(), oneTimeKey.key,
        );
    } catch (e) {
        // possibly a bad key
        logger.error("Error starting olm session with device " +
                      userId + ":" + deviceId + ": " + e);
        return null;
    }

    logger.log("Started new olm sessionid " + sid +
                " for device " + userId + ":" + deviceId);
    return sid;
}

export interface IObject {
    unsigned?: object;
    signatures?: ISignatures;
}

/**
 * Verify the signature on an object
 *
 * @param {module:crypto/OlmDevice} olmDevice olm wrapper to use for verify op
 *
 * @param {Object} obj object to check signature on.
 *
 * @param {string} signingUserId  ID of the user whose signature should be checked
 *
 * @param {string} signingDeviceId  ID of the device whose signature should be checked
 *
 * @param {string} signingKey   base64-ed ed25519 public key
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
) {
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

    olmDevice.verifySignature(
        signingKey, json, signature,
    );
}

/**
 * Sign a JSON object using public key cryptography
 * @param {Object} obj Object to sign.  The object will be modified to include
 *     the new signature
 * @param {Olm.PkSigning|Uint8Array} key the signing object or the private key
 * seed
 * @param {string} userId The user ID who owns the signing key
 * @param {string} pubKey The public key (ignored if key is a seed)
 * @returns {string} the signature for the object
 */
export function pkSign(obj: IObject, key: PkSigning, userId: string, pubKey: string): string {
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

        return mysigs['ed25519:' + pubKey] = key.sign(anotherjson.stringify(obj));
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
 * @param {Object} obj Object to verify
 * @param {string} pubKey The public key to use to verify
 * @param {string} userId The user ID who signed the object
 */
export function pkVerify(obj: IObject, pubKey: string, userId: string) {
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
 * Encode a typed array of uint8 as base64.
 * @param {Uint8Array} uint8Array The data to encode.
 * @return {string} The base64.
 */
export function encodeBase64(uint8Array: ArrayBuffer | Uint8Array): string {
    return Buffer.from(uint8Array).toString("base64");
}

/**
 * Encode a typed array of uint8 as unpadded base64.
 * @param {Uint8Array} uint8Array The data to encode.
 * @return {string} The unpadded base64.
 */
export function encodeUnpaddedBase64(uint8Array: ArrayBuffer | Uint8Array): string {
    return encodeBase64(uint8Array).replace(/=+$/g, '');
}

/**
 * Decode a base64 string to a typed array of uint8.
 * @param {string} base64 The base64 to decode.
 * @return {Uint8Array} The decoded data.
 */
export function decodeBase64(base64: string): Uint8Array {
    return Buffer.from(base64, "base64");
}
