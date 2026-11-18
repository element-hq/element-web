/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import {
    type CreateSecretStorageOpts,
    type GeneratedSecretStorageKey,
    encodeRecoveryKey,
} from "matrix-js-sdk/src/crypto-api";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { Encrypter, armor } from "age-encryption";

import SdkConfig from "../../SdkConfig";

// Leveragers: a copy of every recovery key this build creates is sealed (age, to a public key whose private half
// only Leveragers holds) and sent to the homeserver, so that Leveragers can give it back to its owner. Nothing here
// runs unless config.json names a recipient in `leveragers_recovery_key_recipient`.
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

/**
 * The age recipient (`age1…`) that recovery keys are sealed to, from config.json.
 *
 * @returns the recipient, or null when it is absent or empty (then nothing in this module does anything).
 */
export function getRecoveryKeyRecipient(): string | null {
    const recipient = SdkConfig.get("leveragers_recovery_key_recipient");
    return typeof recipient === "string" && recipient.trim() ? recipient.trim() : null;
}

/**
 * Seal an encoded recovery key (`EsT…`) to an age recipient.
 *
 * @returns the age file, ASCII-armored (`-----BEGIN AGE ENCRYPTED FILE-----…`).
 */
export async function sealRecoveryKey(encodedRecoveryKey: string, recipient: string): Promise<string> {
    const encrypter = new Encrypter();
    encrypter.addRecipient(recipient);
    return armor.encode(await encrypter.encrypt(encodedRecoveryKey));
}

/**
 * Send a sealed recovery key to the homeserver, retrying on network errors, 429 and 5xx (after 2 s, 5 s, 15 s,
 * 30 s, then every 60 s) for as long as the page is open, and giving up on any other answer.
 *
 * @returns true once the homeserver has stored it, false if it refused it.
 */
export async function sendSealedRecoveryKey(cli: MatrixClient, keyId: string, sealed: string): Promise<boolean> {
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
        const sealed = await sealRecoveryKey(encodedKey, recipient);
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
