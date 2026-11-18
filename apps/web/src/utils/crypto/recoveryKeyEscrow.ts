/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, decodeBase64, encodeUnpaddedBase64Url } from "matrix-js-sdk/src/matrix";
import {
    type CreateSecretStorageOpts,
    type GeneratedSecretStorageKey,
    encodeRecoveryKey,
} from "matrix-js-sdk/src/crypto-api";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

import SdkConfig from "../../SdkConfig";

// Leveragers: a copy of every recovery key this build creates is sealed in the browser (WebCrypto, to a P-256 public
// key whose private half only Leveragers holds) and sent to the homeserver, so that Leveragers can give it back to
// its owner. Nothing here runs unless config.json names that public key in `leveragers_recovery_key_recipient`.
//
// Never log the recovery key nor the sealed copy: only HTTP statuses.
//
// This module only depends on the SDK and SdkConfig, because MatrixClientPeg imports it: importing Element's UI
// state from here (SecurityManager, DeviceListener, toasts) closes an import cycle. The silent setup, which needs
// them, is in silentRecoverySetup.ts.

const logger = rootLogger.getChild("RecoveryKeyEscrow:");

/** Path, on the homeserver's base URL, of the route that stores the sealed copy. */
export const RECOVERY_KEY_ESCROW_PATH = "/_leveragers/keys/v1/recovery-key";

/** Waits between the attempts to send the copy, then {@link LATER_RETRY_DELAY_MS} between all later ones. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];
export const LATER_RETRY_DELAY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** `info` of the HKDF step of format v1, which also names the format. */
const SEAL_INFO = "leveragers-recovery-key-v1";

/**
 * A sealed recovery key, format v1: base64url (unpadded) of the one-time P-256 public key (uncompressed point),
 * of the AES-GCM IV, and of the AES-GCM ciphertext followed by its tag.
 */
export interface SealedRecoveryKey {
    v: 1;
    epk: string;
    iv: string;
    ct: string;
}

/**
 * The public key that recovery keys are sealed to, from config.json: an uncompressed P-256 point (65 bytes,
 * `04‖X‖Y`), base64url without padding.
 *
 * @returns the public key, or null when it is absent or empty (then nothing in this module does anything).
 */
export function getRecoveryKeyRecipient(): string | null {
    const recipient = SdkConfig.get("leveragers_recovery_key_recipient");
    return typeof recipient === "string" && recipient.trim() ? recipient.trim() : null;
}

/**
 * Seal an encoded recovery key (`EsT…`, as Element shows it) to the recipient's P-256 public key, format v1:
 * ECDH with a one-time P-256 key pair, HKDF-SHA-256 (salt = one-time public key ‖ recipient public key, info
 * `leveragers-recovery-key-v1`) to an AES-256-GCM key, then AES-GCM with a random 12-byte IV and, as additional
 * data, `<user_id>\n<key_id>`, so that a copy moved onto another account or key does not open.
 *
 * Throws if the recipient is not a valid P-256 public key, or if WebCrypto is unavailable.
 */
export async function sealRecoveryKey(
    encodedRecoveryKey: string,
    recipient: string,
    userId: string,
    keyId: string,
): Promise<SealedRecoveryKey> {
    const subtle = globalThis.crypto.subtle;
    const encoder = new TextEncoder();

    const recipientBytes = decodeBase64(recipient);
    const recipientKey = await subtle.importKey(
        "raw",
        recipientBytes,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
    );
    const oneTime = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const oneTimePublic = new Uint8Array(await subtle.exportKey("raw", oneTime.publicKey));

    const sharedSecret = await subtle.deriveBits({ name: "ECDH", public: recipientKey }, oneTime.privateKey, 256);
    const hkdfKey = await subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
    const aesKey = await subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array([...oneTimePublic, ...recipientBytes]),
            info: encoder.encode(SEAL_INFO),
        },
        hkdfKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"],
    );

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128, additionalData: encoder.encode(`${userId}\n${keyId}`) },
        aesKey,
        encoder.encode(encodedRecoveryKey),
    );

    return {
        v: 1,
        epk: encodeUnpaddedBase64Url(oneTimePublic),
        iv: encodeUnpaddedBase64Url(iv),
        ct: encodeUnpaddedBase64Url(new Uint8Array(ciphertext)),
    };
}

/**
 * Send a sealed recovery key to the homeserver, retrying on network errors, 429 and 5xx (after 2 s, 5 s, 15 s,
 * 30 s, then every 60 s) for as long as the page is open, and giving up on any other answer.
 *
 * @returns true once the homeserver has stored it, false if it refused it.
 */
export async function sendSealedRecoveryKey(
    cli: MatrixClient,
    keyId: string,
    sealed: SealedRecoveryKey,
): Promise<boolean> {
    const url = cli.getHomeserverUrl().replace(/\/+$/, "") + RECOVERY_KEY_ESCROW_PATH;
    const body = JSON.stringify({ key_id: keyId, sealed });

    for (let attempt = 0; ; attempt++) {
        // read at each attempt: the access token may have been refreshed in the meantime
        const accessToken = cli.getAccessToken();
        if (!accessToken) {
            logger.warn("no access token: recovery key copy not sent");
            return false;
        }

        let status: number | null = null;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body,
                credentials: "omit",
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            status = response.status;
        } catch {
            // network error, CORS refusal or timeout: retried below
        }

        if (status !== null && status >= 200 && status < 300) {
            logger.info(`recovery key copy stored (HTTP ${status})`);
            return true;
        }
        if (status !== null && status !== 429 && status < 500) {
            logger.warn(`recovery key copy refused (HTTP ${status}): giving up`);
            return false;
        }

        const delay = RETRY_DELAYS_MS[attempt] ?? LATER_RETRY_DELAY_MS;
        logger.info(
            `recovery key copy not sent (${status === null ? "network error" : `HTTP ${status}`}), ` +
                `next attempt in ${delay / 1000} s`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

/**
 * Seal a recovery key that `CryptoApi.bootstrapSecretStorage` has just saved, and send it with the id of the
 * account's default secret storage key, which bootstrapSecretStorage has just set to it. Never throws.
 */
export async function escrowRecoveryKey(
    cli: MatrixClient,
    recoveryKey: GeneratedSecretStorageKey,
    recipient: string,
): Promise<void> {
    try {
        const keyId = await cli.secretStorage.getDefaultKeyId();
        const keyTuple = keyId ? await cli.secretStorage.getKey(keyId) : null;
        if (!keyId || !keyTuple || !(await cli.secretStorage.checkKey(recoveryKey.privateKey, keyTuple[1]))) {
            logger.warn("the new recovery key is not the default secret storage key: copy not sent");
            return;
        }

        const encodedKey = recoveryKey.encodedPrivateKey ?? encodeRecoveryKey(recoveryKey.privateKey);
        if (!encodedKey) return;
        const sealed = await sealRecoveryKey(encodedKey, recipient, cli.getSafeUserId(), keyId);
        await sendSealedRecoveryKey(cli, keyId, sealed);
    } catch (e) {
        logger.warn("could not send a copy of the recovery key", e);
    }
}

/**
 * Make every recovery key created on this client reach us: wrap `CryptoApi.bootstrapSecretStorage`, which
 * every Element screen that creates a recovery key goes through, so that when it called `createSecretStorageKey`
 * and resolved, the new key is sealed and sent (in the background, the caller does not wait for it).
 *
 * Does nothing without a recipient in config.json. Call it once, right after the client's crypto is initialised.
 */
export function installRecoveryKeyEscrow(cli: MatrixClient): void {
    const recipient = getRecoveryKeyRecipient();
    const crypto = cli.getCrypto();
    if (!recipient || !crypto) return;

    const bootstrapSecretStorage = crypto.bootstrapSecretStorage.bind(crypto);
    crypto.bootstrapSecretStorage = async (opts: CreateSecretStorageOpts = {}): Promise<void> => {
        const { createSecretStorageKey } = opts;
        if (!createSecretStorageKey) return bootstrapSecretStorage(opts);

        let createdKey: GeneratedSecretStorageKey | undefined;
        await bootstrapSecretStorage({
            ...opts,
            createSecretStorageKey: async () => (createdKey = await createSecretStorageKey()),
        });
        if (createdKey) void escrowRecoveryKey(cli, createdKey, recipient);
    };
}
