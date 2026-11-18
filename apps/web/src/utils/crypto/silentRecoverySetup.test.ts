/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, type Mocked } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { type MatrixClient, encodeUnpaddedBase64Url } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { createTestClient } from "test-utils";

import SdkConfig from "../../SdkConfig";
import { isSecretStorageBeingAccessed } from "../../SecurityManager";
import { DeviceListener } from "../../device-listener";
import ToastStore from "../../stores/ToastStore";
import { RECOVERY_KEY_ESCROW_PATH, type SealedRecoveryKey, installRecoveryKeyEscrow } from "./recoveryKeyEscrow";
import { setUpRecoverySilently } from "./silentRecoverySetup";

const HOMESERVER = "https://chat.example.com";
const ESCROW_URL = HOMESERVER + RECOVERY_KEY_ESCROW_PATH;
const RECOVERY_KEY = "EsTc LW2K PGiF wKEA 3As5 g5c4 BXwk qeeJ ZJV8 Q9fu gUMN UE4d";

let recipient: string;

function sentBodies(): Array<{ key_id: string; sealed: SealedRecoveryKey }> {
    return fetchMock.callHistory.calls(ESCROW_URL).map((call) => JSON.parse(call.options.body as string));
}

beforeAll(async () => {
    // opening the copy is tested in recoveryKeyEscrow.test.ts
    const pair = (await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
        "deriveBits",
    ])) as CryptoKeyPair;
    recipient = encodeUnpaddedBase64Url(
        new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", pair.publicKey)),
    );
});

afterEach(() => {
    SdkConfig.reset();
    vi.restoreAllMocks();
});

describe("setUpRecoverySilently", () => {
    const createdKey = { privateKey: new Uint8Array(32).fill(9), encodedPrivateKey: RECOVERY_KEY };
    let client: Mocked<MatrixClient>;
    let crypto: Mocked<CryptoApi>;

    beforeEach(() => {
        client = vi.mocked(createTestClient());
        client.getHomeserverUrl.mockReturnValue(HOMESERVER);
        client.getAccessToken.mockReturnValue("token-of-this-account");
        crypto = vi.mocked(client.getCrypto()!);
        crypto.createRecoveryKeyFromPassphrase.mockResolvedValue(createdKey);
        crypto.getKeyBackupInfo.mockResolvedValue({ version: "1" } as any);
        vi.spyOn(DeviceListener.sharedInstance(), "whilePaused").mockImplementation(async (fn) => fn());
        vi.spyOn(ToastStore.sharedInstance(), "dismissToast");
        fetchMock.post(ESCROW_URL, 201);
    });

    it("does nothing without a recipient", async () => {
        expect(await setUpRecoverySilently(client)).toBe(false);

        expect(crypto.createRecoveryKeyFromPassphrase).not.toHaveBeenCalled();
        expect(crypto.bootstrapSecretStorage).not.toHaveBeenCalled();
        expect(client.setAccountData).not.toHaveBeenCalled();
    });

    describe("with a recipient", () => {
        beforeEach(() => {
            SdkConfig.put({ leveragers_recovery_key_recipient: recipient });
        });

        it("creates a key and saves the secrets under it, with the toasts held back", async () => {
            let toastsHeldBack: boolean | undefined;
            crypto.bootstrapSecretStorage.mockImplementation(async () => {
                toastsHeldBack = isSecretStorageBeingAccessed();
            });

            expect(await setUpRecoverySilently(client)).toBe(true);

            expect(crypto.bootstrapSecretStorage).toHaveBeenCalledTimes(1);
            const opts = crypto.bootstrapSecretStorage.mock.calls[0][0]!;
            expect(opts.setupNewSecretStorage).toBe(true);
            expect(opts.setupNewKeyBackup).toBe(false);
            expect(await opts.createSecretStorageKey!()).toBe(createdKey);
            expect(toastsHeldBack).toBe(true);
            expect(DeviceListener.sharedInstance().whilePaused).toHaveBeenCalled();
            expect(client.setAccountData).toHaveBeenCalledWith("io.element.recovery", { enabled: true });
            expect(ToastStore.sharedInstance().dismissToast).toHaveBeenCalledWith("setupencryption");
        });

        it("creates a key backup when there is none", async () => {
            crypto.getKeyBackupInfo.mockResolvedValue(null);

            expect(await setUpRecoverySilently(client)).toBe(true);
            expect(crypto.bootstrapSecretStorage.mock.calls[0][0]!.setupNewKeyBackup).toBe(true);
        });

        it("reports failure without throwing, and leaves the toasts alone", async () => {
            crypto.bootstrapSecretStorage.mockRejectedValue(new Error("boom"));

            expect(await setUpRecoverySilently(client)).toBe(false);
            expect(client.setAccountData).not.toHaveBeenCalled();
            expect(ToastStore.sharedInstance().dismissToast).not.toHaveBeenCalled();
        });

        it("sends us the new key through the wrapper", async () => {
            const secretStorage = client.secretStorage as Mocked<MatrixClient["secretStorage"]>;
            secretStorage.getDefaultKeyId.mockResolvedValue("newkeyid");
            secretStorage.getKey = vi
                .fn()
                .mockResolvedValue(["newkeyid", { algorithm: "m.secret_storage.v1.aes-hmac-sha2" }]);
            secretStorage.checkKey.mockResolvedValue(true);
            crypto.bootstrapSecretStorage.mockImplementation(async (opts) => {
                await opts?.createSecretStorageKey?.();
            });
            installRecoveryKeyEscrow(client);

            expect(await setUpRecoverySilently(client)).toBe(true);

            await vi.waitFor(() => expect(fetchMock.callHistory.calls(ESCROW_URL)).toHaveLength(1));
            const [body] = sentBodies();
            expect(body.key_id).toBe("newkeyid");
            expect(body.sealed.v).toBe(1);
            expect(Object.keys(body.sealed).sort()).toEqual(["ct", "epk", "iv", "v"]);
        });
    });
});
