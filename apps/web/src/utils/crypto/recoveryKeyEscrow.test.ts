/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, type Mock, type Mocked } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CreateSecretStorageOpts, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { sleep } from "matrix-js-sdk/src/utils";
import { Decrypter, armor, generateX25519Identity, identityToRecipient } from "age-encryption";
import { createTestClient } from "test-utils";

import SdkConfig from "../../SdkConfig";
import {
    LATER_RETRY_DELAY_MS,
    RECOVERY_KEY_ESCROW_PATH,
    RETRY_DELAYS_MS,
    getRecoveryKeyRecipient,
    installRecoveryKeyEscrow,
    sealRecoveryKey,
    sendSealedRecoveryKey,
} from "./recoveryKeyEscrow";

const HOMESERVER = "https://chat.example.com";
const ESCROW_URL = HOMESERVER + RECOVERY_KEY_ESCROW_PATH;
const RECOVERY_KEY = "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d";

let identity: string;
let recipient: string;

async function unseal(sealed: string): Promise<string> {
    const decrypter = new Decrypter();
    decrypter.addIdentity(identity);
    return decrypter.decrypt(armor.decode(sealed), "text");
}

function sentBodies(): Array<{ key_id: string; sealed: string }> {
    return fetchMock.callHistory.calls(ESCROW_URL).map((call) => JSON.parse(call.options.body as string));
}

beforeAll(async () => {
    identity = await generateX25519Identity();
    recipient = await identityToRecipient(identity);
});

afterEach(() => {
    SdkConfig.reset();
    vi.useRealTimers();
});

describe("getRecoveryKeyRecipient", () => {
    it("is null when config.json has no recipient", () => {
        expect(getRecoveryKeyRecipient()).toBeNull();
    });

    it("is null when the recipient is empty", () => {
        SdkConfig.put({ leveragers_recovery_key_recipient: "  " });
        expect(getRecoveryKeyRecipient()).toBeNull();
    });

    it("returns the configured recipient", () => {
        SdkConfig.put({ leveragers_recovery_key_recipient: recipient });
        expect(getRecoveryKeyRecipient()).toBe(recipient);
    });
});

describe("sealRecoveryKey", () => {
    it("seals the key into an armored age file that only the identity opens, to exactly the key", async () => {
        const sealed = await sealRecoveryKey(RECOVERY_KEY, recipient);

        expect(sealed.startsWith("-----BEGIN AGE ENCRYPTED FILE-----\n")).toBe(true);
        expect(sealed.trimEnd().endsWith("-----END AGE ENCRYPTED FILE-----")).toBe(true);
        expect(sealed).not.toContain(RECOVERY_KEY);
        expect(await unseal(sealed)).toBe(RECOVERY_KEY);

        const otherDecrypter = new Decrypter();
        otherDecrypter.addIdentity(await generateX25519Identity());
        await expect(otherDecrypter.decrypt(armor.decode(sealed), "text")).rejects.toThrow();
    });

    it("refuses a malformed recipient", async () => {
        await expect(sealRecoveryKey(RECOVERY_KEY, "not-a-recipient")).rejects.toThrow();
    });
});

describe("sendSealedRecoveryKey", () => {
    let client: Mocked<MatrixClient>;

    beforeEach(() => {
        client = vi.mocked(createTestClient());
        client.getHomeserverUrl.mockReturnValue(HOMESERVER + "/");
        client.getAccessToken.mockReturnValue("token-of-this-account");
    });

    it("posts the key id and the sealed key with the access token", async () => {
        fetchMock.post(ESCROW_URL, 201);

        expect(await sendSealedRecoveryKey(client, "keyid", "SEALED")).toBe(true);

        const call = fetchMock.callHistory.lastCall(ESCROW_URL)!;
        const headers = new Headers(call.options.headers as HeadersInit);
        expect(headers.get("authorization")).toBe("Bearer token-of-this-account");
        expect(headers.get("content-type")).toBe("application/json");
        expect(sentBodies()).toEqual([{ key_id: "keyid", sealed: "SEALED" }]);
    });

    it.each([400, 401, 403, 413])("gives up at once on HTTP %i", async (status) => {
        fetchMock.post(ESCROW_URL, status);

        expect(await sendSealedRecoveryKey(client, "keyid", "SEALED")).toBe(false);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1);
    });

    it("does not send without an access token", async () => {
        client.getAccessToken.mockReturnValue(null);

        expect(await sendSealedRecoveryKey(client, "keyid", "SEALED")).toBe(false);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
    });

    it("retries network errors, 429 and 5xx after 2 s, 5 s, 15 s, 30 s, then every 60 s", async () => {
        vi.useFakeTimers();
        const answers: Array<number | { throws: Error }> = [
            { throws: new TypeError("Failed to fetch") },
            429,
            502,
            503,
            500,
            { throws: new TypeError("Failed to fetch") },
            201,
        ];
        fetchMock.post(ESCROW_URL, () => answers.shift()!);
        const calls = (): number => fetchMock.callHistory.calls(ESCROW_URL).length;

        const result = sendSealedRecoveryKey(client, "keyid", "SEALED");
        await vi.advanceTimersByTimeAsync(0);
        expect(calls()).toBe(1);

        for (const [index, delay] of [...RETRY_DELAYS_MS, LATER_RETRY_DELAY_MS, LATER_RETRY_DELAY_MS].entries()) {
            await vi.advanceTimersByTimeAsync(delay - 1);
            expect(calls()).toBe(index + 1);
            await vi.advanceTimersByTimeAsync(1);
            expect(calls()).toBe(index + 2);
        }

        expect(await result).toBe(true);
        expect(answers).toHaveLength(0);
    });

    it("gives up on a 4xx that follows a retried error", async () => {
        vi.useFakeTimers();
        const answers = [503, 400];
        fetchMock.post(ESCROW_URL, () => answers.shift()!);

        const result = sendSealedRecoveryKey(client, "keyid", "SEALED");
        await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]);

        expect(await result).toBe(false);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(2);
        await vi.advanceTimersByTimeAsync(10 * LATER_RETRY_DELAY_MS);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(2);
    });
});

describe("installRecoveryKeyEscrow", () => {
    const newKey = { privateKey: new Uint8Array(32).fill(7), encodedPrivateKey: RECOVERY_KEY };
    let client: Mocked<MatrixClient>;
    let crypto: Mocked<CryptoApi>;
    let originalBootstrap: Mock<CryptoApi["bootstrapSecretStorage"]>;

    beforeEach(() => {
        client = vi.mocked(createTestClient());
        client.getHomeserverUrl.mockReturnValue(HOMESERVER);
        client.getAccessToken.mockReturnValue("token-of-this-account");
        const secretStorage = client.secretStorage as Mocked<MatrixClient["secretStorage"]>;
        secretStorage.getDefaultKeyId.mockResolvedValue("newkeyid");
        secretStorage.getKey = vi
            .fn()
            .mockResolvedValue(["newkeyid", { algorithm: "m.secret_storage.v1.aes-hmac-sha2" }]);
        secretStorage.checkKey.mockResolvedValue(true);

        crypto = vi.mocked(client.getCrypto()!);
        // like the real one: calls createSecretStorageKey only when a new key is needed
        originalBootstrap = vi.fn(async (opts: CreateSecretStorageOpts = {}) => {
            if (opts.setupNewSecretStorage) await opts.createSecretStorageKey?.();
        });
        crypto.bootstrapSecretStorage = originalBootstrap;
        fetchMock.post(ESCROW_URL, 201);
    });

    it("leaves bootstrapSecretStorage alone without a recipient", async () => {
        installRecoveryKeyEscrow(client);

        expect(crypto.bootstrapSecretStorage).toBe(originalBootstrap);
        await crypto.bootstrapSecretStorage({
            setupNewSecretStorage: true,
            createSecretStorageKey: async () => newKey,
        });
        await sleep(50);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
    });

    describe("with a recipient", () => {
        beforeEach(() => {
            SdkConfig.put({ leveragers_recovery_key_recipient: recipient });
            installRecoveryKeyEscrow(client);
        });

        it("sends a sealed copy of a newly created key, with the new default key id", async () => {
            const opts = { setupNewSecretStorage: true, createSecretStorageKey: vi.fn().mockResolvedValue(newKey) };
            await crypto.bootstrapSecretStorage(opts);

            expect(originalBootstrap).toHaveBeenCalledWith(expect.objectContaining({ setupNewSecretStorage: true }));
            expect(opts.createSecretStorageKey).toHaveBeenCalledTimes(1);
            await vi.waitFor(() => expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1));
            const [body] = sentBodies();
            expect(body.key_id).toBe("newkeyid");
            expect(await unseal(body.sealed)).toBe(RECOVERY_KEY);
            expect(client.secretStorage.checkKey).toHaveBeenCalledWith(newKey.privateKey, expect.anything());
        });

        it("encodes the key when the caller gave only the raw key", async () => {
            const { encodeRecoveryKey } = await import("matrix-js-sdk/src/crypto-api");
            const rawKey = { privateKey: newKey.privateKey };
            await crypto.bootstrapSecretStorage({
                setupNewSecretStorage: true,
                createSecretStorageKey: async () => rawKey,
            });

            await vi.waitFor(() => expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1));
            expect(await unseal(sentBodies()[0].sealed)).toBe(encodeRecoveryKey(newKey.privateKey));
        });

        it("sends nothing when no new key was needed", async () => {
            const createSecretStorageKey = vi.fn().mockResolvedValue(newKey);
            await crypto.bootstrapSecretStorage({ createSecretStorageKey });

            expect(createSecretStorageKey).not.toHaveBeenCalled();
            await sleep(50);
            expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
        });

        it("passes calls without createSecretStorageKey through, and sends nothing", async () => {
            await crypto.bootstrapSecretStorage({});

            expect(originalBootstrap).toHaveBeenCalledWith({});
            await sleep(50);
            expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
        });

        it("sends nothing when the bootstrap fails after creating the key, and passes the error on", async () => {
            originalBootstrap.mockImplementation(async (opts) => {
                await opts?.createSecretStorageKey?.();
                throw new Error("account data refused");
            });

            await expect(
                crypto.bootstrapSecretStorage({
                    setupNewSecretStorage: true,
                    createSecretStorageKey: async () => newKey,
                }),
            ).rejects.toThrow("account data refused");
            await sleep(50);
            expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
        });

        it("sends nothing when the default key is no longer the new key", async () => {
            vi.mocked(client.secretStorage.checkKey).mockResolvedValue(false);

            await crypto.bootstrapSecretStorage({
                setupNewSecretStorage: true,
                createSecretStorageKey: async () => newKey,
            });
            await sleep(50);
            expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(0);
        });

        it("does not hold the caller back while sending", async () => {
            const { promise: answer, resolve: answerNow } = Promise.withResolvers<number>();
            fetchMock.removeRoutes();
            fetchMock.post(ESCROW_URL, answer);

            await crypto.bootstrapSecretStorage({
                setupNewSecretStorage: true,
                createSecretStorageKey: async () => newKey,
            });
            await vi.waitFor(() => expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1));
            answerNow(201);
        });
    });
});
