/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, type MockedObject } from "vitest";

import Modal from "../../Modal";
import { X509Manager } from "./X509Manager";

describe("X509Manager", () => {
    const key = {
        label: "YubiKey PIV",
        serialNumber: "12345678",
        manufacturerID: "Yubico",
        model: "YubiKey 5",
        maxPinLength: 8,
        minPinLength: 6,
    };
    const validTo = new Date(Date.now() + 86_400_000);
    const userCert = {
        serialNumber: "01",
        subject: "CN=alice",
        issuer: "CN=test-intermediate",
        validFrom: new Date(0),
        validTo,
    };
    const chain = "-----BEGIN CERTIFICATE-----\nleaf\n-----END CERTIFICATE-----\n";
    const caCertsPem = "-----BEGIN CERTIFICATE-----\nroot\n-----END CERTIFICATE-----\n";

    /**
     * What the main process reports when `signData` is called before `logIntoKey`.
     *
     * A token's private key objects are invisible until `C_Login`, so the main process cannot tell a
     * missing key from a missing login by searching. It tracks the login itself and says so explicitly.
     */
    const loginRequired = { ok: false, error: { code: "LOGIN_REQUIRED" } };

    const mockElectron = {
        on: vi.fn(),
        send: vi.fn(),
    } as unknown as MockedObject<Electron>;

    let manager: X509Manager;
    // Canned main-process replies, keyed by IPC command name.
    let replies: Record<string, () => unknown>;
    /**
     * Login state as the main process would track it: `logIntoKey` sets it, `getKeyState` reports it, and
     * `signData` refuses without it. Modelling this is the point - the previous suite let `signData`
     * succeed without a login, which is why a real hardware key never got a PIN prompt.
     */
    let authenticated: boolean;

    const ipcCalls = (name: string): any[][] =>
        mockElectron.send.mock.calls.filter(([channel, payload]) => channel === "x509" && payload.name === name);

    beforeEach(() => {
        vi.resetAllMocks();
        window.electron = mockElectron;
        authenticated = false;
        replies = {
            getUserCertificate: () => ({ ok: true, data: { certificate: userCert, chain, caCertsPem } }),
            listHardwareKeys: () => ({ ok: true, data: [key] }),
            getKeyState: () => ({ ok: true, data: authenticated ? "authenticated" : "open" }),
            logIntoKey: () => {
                authenticated = true;
                return { ok: true };
            },
            signData: () => (authenticated ? { ok: true, data: new Uint8Array([1, 2, 3]) } : loginRequired),
        };
        manager = new X509Manager();
        const [, onReply] = mockElectron.on.mock.calls.find(([channel]) => channel === "x509Reply")!;
        mockElectron.send.mockImplementation((channel: string, payload: any) => {
            if (channel !== "x509") return;
            onReply({} as Event, { id: payload.id, reply: replies[payload.name]() });
        });
        Modal.createDialog = vi.fn().mockReturnValue({
            close: vi.fn(),
            finished: Promise.resolve([true, "123456"]),
        }) as any;
    });

    it("reads the certificate from disk and touches no hardware key at startup", async () => {
        const opts = await manager.getClientInitOpts();
        expect(opts?.validity!()).toBe(validTo.getTime());
        expect(ipcCalls("getUserCertificate")).toHaveLength(1);
        expect(ipcCalls("listHardwareKeys")).toHaveLength(0);
        expect(ipcCalls("getKeyState")).toHaveLength(0);
        expect(Modal.createDialog).not.toHaveBeenCalled();
    });

    it("passes the CA certificates through as trust anchors for other users", async () => {
        const opts = await manager.getClientInitOpts();
        expect(opts?.userVerificationCaCertsPem).toBe(caCertsPem);
    });

    it("omits the trust anchors entirely when the directory holds no CA certificates", async () => {
        replies.getUserCertificate = () => ({ ok: true, data: { certificate: userCert, chain, caCertsPem: "" } });
        const opts = await manager.getClientInitOpts();
        // An empty bundle would give the crypto stack a verifier with no anchors; better to send nothing.
        expect(opts?.userVerificationCaCertsPem).toBeUndefined();
    });

    it("still supplies trust anchors when this user has no certificate of their own", async () => {
        // A deployment where this user has not been issued a hardware key yet: they cannot sign, but they
        // must still be able to verify everyone who can.
        replies.getUserCertificate = () => ({ ok: false, error: { code: "CERTIFICATE_NOT_FOUND" } });
        replies.getCaCertificates = () => ({ ok: true, data: caCertsPem });

        const opts = await manager.getClientInitOpts();
        expect(opts?.userVerificationCaCertsPem).toBe(caCertsPem);
        expect(opts?.signer).toBeUndefined();
        expect(opts?.validity).toBeUndefined();
    });

    it("returns null when neither a certificate nor any CA is provisioned", async () => {
        replies.getUserCertificate = () => ({ ok: false, error: { code: "CERTIFICATE_NOT_FOUND" } });
        replies.getCaCertificates = () => ({ ok: true, data: "" });
        await expect(manager.getClientInitOpts()).resolves.toBeNull();
        expect(Modal.createDialog).not.toHaveBeenCalled();
    });

    it("only reads the certificate once across repeated calls", async () => {
        await manager.getClientInitOpts();
        await manager.getClientInitOpts();
        expect(ipcCalls("getUserCertificate")).toHaveLength(1);
    });

    it("skips an attached hardware key that holds no signing key for the certificate, without asking for a PIN", async () => {
        const otherKey = { ...key, serialNumber: "99999999", label: "Someone else's key" };
        replies.listHardwareKeys = () => ({ ok: true, data: [otherKey, key] });
        replies.getKeyState = () => ({ ok: true, data: "noSigningKey" });

        const opts = await manager.getClientInitOpts();
        // Neither key holds our signing key, so we end up waiting for one to be inserted.
        vi.mocked(Modal.createDialog).mockReturnValue({
            close: vi.fn(),
            finished: Promise.resolve([]),
        } as any);

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("X.509 signing cancelled");
        expect(vi.mocked(Modal.createDialog).mock.calls[0][1]).toMatchObject({
            title: "Insert your hardware key",
        });
        // Both attached keys were checked, and neither was asked for a PIN it could not use.
        expect(ipcCalls("getKeyState")).toHaveLength(2);
        expect(ipcCalls("logIntoKey")).toHaveLength(0);
    });

    it("waits for a hardware key to be inserted, then signs", async () => {
        vi.useFakeTimers();
        try {
            replies.listHardwareKeys = () => ({ ok: true, data: [] });
            const opts = await manager.getClientInitOpts();

            const close = vi.fn();
            let resolveDialog: (v: unknown[]) => void;
            const finished = new Promise<unknown[]>((r) => (resolveDialog = r));
            close.mockImplementation(() => resolveDialog([]));
            vi.mocked(Modal.createDialog).mockReturnValue({ close, finished } as any);

            const signing = opts!.signer!(new Uint8Array([9]));

            // The key appears on the second poll, already logged in, so this test stays about the polling
            // rather than the PIN dialog.
            await vi.advanceTimersByTimeAsync(1000);
            expect(close).not.toHaveBeenCalled();
            authenticated = true;
            replies.listHardwareKeys = () => ({ ok: true, data: [key] });
            await vi.advanceTimersByTimeAsync(1000);

            await expect(signing).resolves.toMatchObject({ certificate_chain: chain });
            expect(close).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it("logs into an open hardware key before signing, and signs only once", async () => {
        const opts = await manager.getClientInitOpts();

        const signature = await opts!.signer!(new Uint8Array([9]));
        expect(signature).toEqual({
            signature_bytes: new Uint8Array([1, 2, 3]),
            certificate_chain: chain,
            signature_scheme: "RsaPssSha512",
        });
        // The login comes first, so there is no speculative failed signature to recover from.
        expect(ipcCalls("logIntoKey")[0][1].args).toEqual([key.serialNumber, "123456"]);
        expect(ipcCalls("signData")).toHaveLength(1);
        expect(ipcCalls("signData")[0][1].args).toEqual([key.serialNumber, new Uint8Array([9])]);
    });

    it("does not ask for a PIN when the main process reports the hardware key is already authenticated", async () => {
        authenticated = true;
        const opts = await manager.getClientInitOpts();
        await opts!.signer!(new Uint8Array([9]));
        expect(ipcCalls("logIntoKey")).toHaveLength(0);
        expect(Modal.createDialog).not.toHaveBeenCalled();
    });

    it("retries once when the session is lost between the state check and the signature", async () => {
        const opts = await manager.getClientInitOpts();
        // The hardware key reports itself authenticated, but the session is gone by the time we sign.
        authenticated = true;
        let attempts = 0;
        replies.signData = () => (++attempts === 1 ? loginRequired : { ok: true, data: new Uint8Array([7]) });
        replies.getKeyState = () => ({ ok: true, data: attempts === 0 ? "authenticated" : "open" });

        const signature = await opts!.signer!(new Uint8Array([9]));
        expect(signature.signature_bytes).toEqual(new Uint8Array([7]));
        // Second round logged in properly rather than failing outright.
        expect(ipcCalls("logIntoKey")).toHaveLength(1);
    });

    it("raises one PIN dialog for concurrent signatures", async () => {
        const opts = await manager.getClientInitOpts();

        await Promise.all([opts!.signer!(new Uint8Array([9])), opts!.signer!(new Uint8Array([8]))]);
        expect(Modal.createDialog).toHaveBeenCalledTimes(1);
        expect(ipcCalls("logIntoKey")).toHaveLength(1);
    });

    it("re-prompts with the remaining tries after a wrong PIN", async () => {
        const opts = await manager.getClientInitOpts();
        let attempts = 0;
        replies.logIntoKey = () => {
            if (++attempts === 1) {
                return { ok: false, error: { code: "PKCS11", pkcs11Code: 0xa0, triesRemaining: 2 } };
            }
            authenticated = true;
            return { ok: true };
        };

        await opts!.signer!(new Uint8Array([9]));
        expect(Modal.createDialog).toHaveBeenCalledTimes(2);
        expect(vi.mocked(Modal.createDialog).mock.calls[1][1]).toMatchObject({
            description: expect.stringContaining("2 attempts remaining"),
        });
    });

    it("gives up once the hardware key is locked", async () => {
        const opts = await manager.getClientInitOpts();
        replies.logIntoKey = () => ({
            ok: false,
            error: { code: "PKCS11", pkcs11Code: 0xa4, triesRemaining: 0 },
        });

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("X.509 signing cancelled");
        expect(ipcCalls("logIntoKey")).toHaveLength(1);
        // Never attempted, because a locked hardware key cannot be logged into.
        expect(ipcCalls("signData")).toHaveLength(0);
    });

    it("throws without retrying when signing fails for a reason a login cannot fix", async () => {
        const opts = await manager.getClientInitOpts();
        replies.signData = () => ({ ok: false, error: { code: "PRIVATE_KEY_NOT_FOUND" } });

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("PRIVATE_KEY_NOT_FOUND");
        expect(ipcCalls("signData")).toHaveLength(1);
    });

    it("throws when the PIN prompt is cancelled", async () => {
        const opts = await manager.getClientInitOpts();
        vi.mocked(Modal.createDialog).mockReturnValue({ finished: Promise.resolve([false]) } as any);

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("X.509 signing cancelled");
        expect(ipcCalls("logIntoKey")).toHaveLength(0);
        expect(ipcCalls("signData")).toHaveLength(0);
    });

    it("asks for the PIN once across repeated signatures", async () => {
        const opts = await manager.getClientInitOpts();
        await opts!.signer!(new Uint8Array([9]));
        await opts!.signer!(new Uint8Array([8]));
        // The main process keeps the authenticated session, so the second signature reports
        // `authenticated` and needs no PIN.
        expect(ipcCalls("logIntoKey")).toHaveLength(1);
        expect(ipcCalls("signData")).toHaveLength(2);
    });

    it("re-resolves the hardware key after it is removed", async () => {
        const opts = await manager.getClientInitOpts();
        await opts!.signer!(new Uint8Array([9]));

        // The hardware key is pulled: it reports itself authenticated but will not log in or sign.
        let removed = true;
        replies.signData = () =>
            removed ? { ok: false, error: { code: "PKCS11", pkcs11Code: 0xb3 } } : { ok: true, data: [7] };
        replies.getKeyState = () => ({ ok: true, data: removed ? "open" : "authenticated" });
        replies.logIntoKey = () => (removed ? { ok: false, error: { code: "KEY_NOT_FOUND" } } : { ok: true });
        // It is plugged back in by the time we go looking for it again.
        replies.listHardwareKeys = () => {
            removed = false;
            return { ok: true, data: [key] };
        };

        const signature = await opts!.signer!(new Uint8Array([9]));
        expect(signature.signature_bytes).toEqual(new Uint8Array([7]));
        expect(ipcCalls("listHardwareKeys").length).toBeGreaterThan(1);
    });

    it("stops asking for the PIN once the hardware key takes it but still will not sign", async () => {
        const opts = await manager.getClientInitOpts();
        replies.signData = () => ({ ok: false, error: { code: "PKCS11", pkcs11Code: 0xb3 } });

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("X.509 signing failed");
        // One PIN dialog, not one per round: the login succeeded, so retrying cannot help.
        expect(Modal.createDialog).toHaveBeenCalledTimes(1);
        expect(ipcCalls("logIntoKey")).toHaveLength(1);
    });

    it("gives up after exactly three rounds of an unresponsive hardware key", async () => {
        const opts = await manager.getClientInitOpts();
        replies.logIntoKey = () => ({ ok: false, error: { code: "KEY_NOT_FOUND" } });

        await expect(opts!.signer!(new Uint8Array([9]))).rejects.toThrow("the hardware key kept failing");
        // Exact, not an upper bound: a loop that gave up early would still satisfy `<= 3`.
        expect(ipcCalls("listHardwareKeys")).toHaveLength(3);
        expect(ipcCalls("logIntoKey")).toHaveLength(3);
        // Never reached, because the login never succeeded.
        expect(ipcCalls("signData")).toHaveLength(0);
    });

    it("never signs before logging in, even if the hardware key would allow it", async () => {
        const opts = await manager.getClientInitOpts();
        // Fail loudly if a signature is attempted while unauthenticated: that was the shipped bug, where
        // an unauthenticated `signData` returned a not-found error and the PIN prompt was skipped.
        replies.signData = () => {
            expect(authenticated).toBe(true);
            return { ok: true, data: new Uint8Array([1]) };
        };

        await opts!.signer!(new Uint8Array([9]));
        const order = mockElectron.send.mock.calls
            .filter(([channel]) => channel === "x509")
            .map(([, payload]) => payload.name);
        expect(order.indexOf("logIntoKey")).toBeLessThan(order.indexOf("signData"));
    });
});
