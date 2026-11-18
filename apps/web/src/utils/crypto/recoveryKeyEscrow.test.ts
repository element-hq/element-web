/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, type Mock, type Mocked } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { type MatrixClient, decodeBase64, encodeUnpaddedBase64Url } from "matrix-js-sdk/src/matrix";
import { type CreateSecretStorageOpts, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { sleep } from "matrix-js-sdk/src/utils";
import { createTestClient } from "test-utils";

import SdkConfig from "../../SdkConfig";
import {
    LATER_RETRY_DELAY_MS,
    RECOVERY_KEY_ESCROW_PATH,
    RETRY_DELAYS_MS,
    type SealedRecoveryKey,
    getRecoveryKeyRecipient,
    installRecoveryKeyEscrow,
    sealRecoveryKey,
    sendSealedRecoveryKey,
} from "./recoveryKeyEscrow";

const HOMESERVER = "https://chat.example.com";
const ESCROW_URL = HOMESERVER + RECOVERY_KEY_ESCROW_PATH;
const RECOVERY_KEY = "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d";
const USER_ID = "@userId:matrix.org"; // the user of createTestClient()
const SEALED: SealedRecoveryKey = { v: 1, epk: "epk", iv: "iv", ct: "ct" };

let privateKey: CryptoKey;
let recipient: string;

async function newKeyPair(): Promise<{ privateKey: CryptoKey; recipient: string }> {
    const pair = (await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
        "deriveBits",
    ])) as CryptoKeyPair;
    const publicKey = new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", pair.publicKey));
    return { privateKey: pair.privateKey, recipient: encodeUnpaddedBase64Url(publicKey) };
}

/** Open a copy as hub2 does (tools/recovery_key.py in the monitor repo), written again here with WebCrypto. */
async function unseal(sealed: SealedRecoveryKey, userId: string, keyId: string, key = privateKey): Promise<string> {
    const subtle = globalThis.crypto.subtle;
    const encoder = new TextEncoder();
    const epk = decodeBase64(sealed.epk);
    const oneTimePublic = await subtle.importKey("raw", epk, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const sharedSecret = await subtle.deriveBits({ name: "ECDH", public: oneTimePublic }, key, 256);
    const hkdfKey = await subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
    const aesKey = await subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array([...epk, ...decodeBase64(recipient)]),
            info: encoder.encode("leveragers-recovery-key-v1"),
        },
        hkdfKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
    );
    const plaintext = await subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(sealed.iv), additionalData: encoder.encode(`${userId}\n${keyId}`) },
        aesKey,
        decodeBase64(sealed.ct),
    );
    return new TextDecoder().decode(plaintext);
}

function sentBodies(): Array<{ key_id: string; sealed: SealedRecoveryKey }> {
    return fetchMock.callHistory.calls(ESCROW_URL).map((call) => JSON.parse(call.options.body as string));
}

beforeAll(async () => {
    ({ privateKey, recipient } = await newKeyPair());
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
    it("seals the key in format v1, which the private key opens to exactly the key", async () => {
        const sealed = await sealRecoveryKey(RECOVERY_KEY, recipient, USER_ID, "keyid");

        expect(Object.keys(sealed).sort()).toEqual(["ct", "epk", "iv", "v"]);
        expect(sealed.v).toBe(1);
        const epk = decodeBase64(sealed.epk);
        expect(epk).toHaveLength(65);
        expect(epk[0]).toBe(4);
        expect(decodeBase64(sealed.iv)).toHaveLength(12);
        expect(decodeBase64(sealed.ct)).toHaveLength(RECOVERY_KEY.length + 16);
        for (const value of [sealed.epk, sealed.iv, sealed.ct]) expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(JSON.stringify(sealed)).not.toContain("EsT");

        expect(await unseal(sealed, USER_ID, "keyid")).toBe(RECOVERY_KEY);
    });

    it("ties the copy to its account and key id", async () => {
        const sealed = await sealRecoveryKey(RECOVERY_KEY, recipient, USER_ID, "keyid");

        await expect(unseal(sealed, "@other:matrix.org", "keyid")).rejects.toThrow();
        await expect(unseal(sealed, USER_ID, "otherkeyid")).rejects.toThrow();
    });

    it("does not open with another private key", async () => {
        const sealed = await sealRecoveryKey(RECOVERY_KEY, recipient, USER_ID, "keyid");
        const other = await newKeyPair();

        await expect(unseal(sealed, USER_ID, "keyid", other.privateKey)).rejects.toThrow();
    });

    it("uses a new one-time key and IV for every copy", async () => {
        const first = await sealRecoveryKey(RECOVERY_KEY, recipient, USER_ID, "keyid");
        const second = await sealRecoveryKey(RECOVERY_KEY, recipient, USER_ID, "keyid");

        expect(second.epk).not.toBe(first.epk);
        expect(second.iv).not.toBe(first.iv);
        expect(second.ct).not.toBe(first.ct);
    });

    it("refuses a recipient that is not a P-256 public key", async () => {
        await expect(sealRecoveryKey(RECOVERY_KEY, "not-a-key", USER_ID, "keyid")).rejects.toThrow();
        const notOnCurve = encodeUnpaddedBase64Url(new Uint8Array([4, ...new Uint8Array(64).fill(1)]));
        await expect(sealRecoveryKey(RECOVERY_KEY, notOnCurve, USER_ID, "keyid")).rejects.toThrow();
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

        expect(await sendSealedRecoveryKey(client, "keyid", SEALED)).toBe(true);

        const call = fetchMock.callHistory.lastCall(ESCROW_URL)!;
        const headers = new Headers(call.options.headers as HeadersInit);
        expect(headers.get("authorization")).toBe("Bearer token-of-this-account");
        expect(headers.get("content-type")).toBe("application/json");
        expect(sentBodies()).toEqual([{ key_id: "keyid", sealed: SEALED }]);
    });

    it.each([400, 401, 403, 413])("gives up at once on HTTP %i", async (status) => {
        fetchMock.post(ESCROW_URL, status);

        expect(await sendSealedRecoveryKey(client, "keyid", SEALED)).toBe(false);
        expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1);
    });

    it("does not send without an access token", async () => {
        client.getAccessToken.mockReturnValue(null);

        expect(await sendSealedRecoveryKey(client, "keyid", SEALED)).toBe(false);
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

        const result = sendSealedRecoveryKey(client, "keyid", SEALED);
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

        const result = sendSealedRecoveryKey(client, "keyid", SEALED);
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
            expect(await unseal(body.sealed, USER_ID, "newkeyid")).toBe(RECOVERY_KEY);
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
            expect(await unseal(sentBodies()[0].sealed, USER_ID, "newkeyid")).toBe(
                encodeRecoveryKey(newKey.privateKey),
            );
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
