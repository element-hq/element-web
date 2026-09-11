/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { X509Certificate } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserWindow } from "electron";
import type {
    HardwareKey,
    HardwareKeyState,
    UserCertificate,
    X509IpcCommand,
    X509IpcError,
    X509LoginResult,
    X509Result,
} from "shared-types";

import type { ConfigOptions } from "./config.js";

// --- Mocks ---

/**
 * The `x509` IPC handler, captured when x509.ts registers it.
 */
let ipcHandler: (ev: unknown, payload: unknown) => Promise<void>;

// x509.ts registers its IPC handler at import time, so every test in this file needs electron mocked.
vi.mock("electron", () => ({
    ipcMain: {
        on: vi.fn((channel: string, cb: (ev: unknown, payload: unknown) => Promise<void>) => {
            ipcHandler = cb;
        }),
    },
}));

const send = vi.fn();
const getConfig = vi.fn<() => ConfigOptions>();
const moduleLoad = vi.fn();
const RsaPssParams = vi.fn();
class Pkcs11Error extends Error {
    public constructor(
        public readonly code: number,
        message: string,
    ) {
        super(message);
    }
}

// --- Fixtures ---

/**
 * A root CA, an intermediate CA it signed, and two leaves it signed. Generated with `__fixtures__/x509/generate.sh`.
 * Round-tripped through {@link X509Certificate} so the PEM is normalised the way x509.ts emits it.
 */
const [rootPem, intermediatePem, leafPem, otherLeafPem] = await Promise.all(
    ["root-ca", "intermediate-ca", "alice", "bob"].map(async (name) =>
        new X509Certificate(
            await readFile(path.join(import.meta.dirname, "__fixtures__", "x509", `${name}.pem`)),
        ).toString(),
    ),
);

// CK_TOKEN_INFO flags, mirrored from x509.ts (and, for CKF_RNG, PKCS#11 itself).
const CKF_RNG = 0x00000001;
const CKF_USER_PIN_COUNT_LOW = 0x00010000;
const CKF_USER_PIN_FINAL_TRY = 0x00020000;
const CKF_USER_PIN_LOCKED = 0x00040000;

// CKR_* return values mirrored from PKCS#11.
const CKR_PIN_INCORRECT = 0xa0;
const CKR_SESSION_HANDLE_INVALID = 0xb3;

const PKCS11_LIBRARY = {
    library_path: "/usr/lib/token.so",
    library_name: "token",
};

// --- Helpers ---

let testDir: string;
let x509: typeof import("./x509.js");

/**
 * Override the `x509` config section returned by config.js. Requires that `getConfig` is mocked
 * via {@link loadX509WithConfig} or similar.
 */
function mockX509Config(x509: ConfigOptions["x509"]): void {
    getConfig.mockReturnValue({ x509 } as ConfigOptions);
}

/**
 * Mock config.js with the given `x509` config section, then import x509.js (which reads it at import time).
 * The config can be overridden later with {@link mockX509Config} if desired.
 */
async function loadX509WithConfig(config: ConfigOptions["x509"]): Promise<void> {
    vi.doMock("./config.js", () => ({ getConfig }));
    mockX509Config(config);
    x509 = await import("./x509.js");
}

/**
 * Write the given certificates into the configured certificate directory.
 */
async function writeCerts(...pems: string[]): Promise<void> {
    await Promise.all(pems.map((pem, index) => writeFile(path.join(testDir, `cert-${index}.pem`), pem)));
}

/**
 * Convert an an array into an array-like object that also offers graphene's `items()` accessor.
 */
function collection<T>(items: T[]) {
    return Object.assign(items, { items: (index: number) => items[index] });
}

/**
 * The `CKA_ID` a {@link MockHardwareToken} gives the key pair belonging to `certPem`.
 */
function keyId(certPem: string): Buffer {
    return Buffer.from(new X509Certificate(certPem).serialNumber, "hex");
}

/**
 * A mock PKCS#11 token that looks vaguely like the ones returned by graphene. Contains the slot holding it,
 * an open "session" and the key objects that session finds.
 */
class MockHardwareToken {
    public readonly info: {
        label: string;
        serialNumber: string;
        manufacturerID: string;
        model: string;
        maxPinLen: number;
        minPinLen: number;
        flags: number;
    };
    public readonly signer = { once: vi.fn(() => Buffer.from("signature")) };
    public readonly slot = { getToken: () => this.info, open: vi.fn(() => this.session) };
    public readonly session = {
        slot: this.slot,
        login: vi.fn(),
        find: vi.fn((template: { class: "public" | "private"; id?: Buffer }) =>
            collection(this.keys[template.class].filter((key) => !template.id || key.id.equals(template.id))),
        ),
        createSign: vi.fn(() => this.signer),
    };

    /**
     * Internal map of keys. Call {@link insertKeyPair} with a certificate PEM to hydrate.
     */
    private readonly keys = {
        public: [] as { id: Buffer; getAttribute: () => Record<string, Buffer> }[],
        private: [] as { id: Buffer; toType: () => unknown }[],
    };

    public constructor(serialNumber: string) {
        this.info = {
            label: `Token ${serialNumber}`,
            serialNumber,
            manufacturerID: "Coyote Inc.",
            model: "PIV",
            maxPinLen: 8,
            minPinLen: 6,
            flags: 0,
        };
    }

    /**
     * Provision the key pair belonging to `certPem`, optionally leaving out the private half.
     */
    public insertKeyPair(certPem: string, { privateKey = true } = {}): this {
        const id = keyId(certPem);
        const { n, e } = new X509Certificate(certPem).publicKey.export({ format: "jwk" }) as { n: string; e: string };
        this.keys.public.push({
            id,
            getAttribute: () => ({
                id,
                modulus: Buffer.from(n, "base64url"),
                publicExponent: Buffer.from(e, "base64url"),
            }),
        });
        if (privateKey) {
            this.keys.private.push({ id, toType: () => ({ id }) });
        }
        return this;
    }
}

/**
 * Mock a loaded PKCS#11 module with the given hardware keys, as returned by `graphene.load`.
 */
function mockModuleLoad(...tokens: MockHardwareToken[]) {
    const module = {
        initialize: vi.fn(),
        finalize: vi.fn(),
        getSlots: vi.fn(() => collection(tokens.map((token) => token.slot))),
    };
    moduleLoad.mockReturnValueOnce(module);
    return module;
}

let nextIpcId = 0;

/**
 * Dispatch an IPC command and return the reply the renderer would receive. The IPC
 * should always return a response, even if it fails.
 */
async function callIpc<T>(name: X509IpcCommand, ...args: unknown[]): Promise<T> {
    const id = nextIpcId++;
    send.mockClear();
    await ipcHandler({}, { id, name, args });
    expect(send).toHaveBeenCalledExactlyOnceWith("x509Reply", {
        id,
        reply: expect.anything(),
    });
    return send.mock.lastCall![1].reply as T;
}

/**
 * Like {@link callIpc}, but for commands that are expected to succeed.
 */
async function callIpcAndUnwrap<T>(name: X509IpcCommand, ...args: unknown[]): Promise<T> {
    const result = await callIpc<X509Result<T>>(name, ...args);
    // Inspect the error rather than `ok` so we get error messages in failures.
    expect((result as { error?: X509IpcError }).error).toBeUndefined();
    return (result as { data: T }).data;
}

// --- Tests ---

beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    testDir = await mkdtemp(path.join(tmpdir(), "x509-test-"));
    // N.B. this `any` shouldn't be necessary, but Zed complains regardless.
    (global as any).mainWindow = { webContents: { send } } as unknown as BrowserWindow;
});

afterEach(() => rm(testDir, { recursive: true, force: true }));

describe("decodeTriesRemaining", () => {
    beforeEach(async () => {
        x509 = await import("./x509.js");
    });

    it("decodes flags correctly", () => {
        expect(x509.decodeTriesRemaining(3)).toBe(3);
        expect(x509.decodeTriesRemaining(CKF_USER_PIN_COUNT_LOW)).toBe(2);
        expect(x509.decodeTriesRemaining(CKF_USER_PIN_FINAL_TRY)).toBe(1);
        expect(x509.decodeTriesRemaining(CKF_USER_PIN_LOCKED)).toBe(0);
    });

    it("considers the most severe flag", () => {
        expect(x509.decodeTriesRemaining(CKF_USER_PIN_COUNT_LOW | CKF_USER_PIN_FINAL_TRY)).toBe(1);
        expect(x509.decodeTriesRemaining(CKF_USER_PIN_COUNT_LOW | CKF_USER_PIN_FINAL_TRY | CKF_USER_PIN_LOCKED)).toBe(
            0,
        );
    });

    it("ignores other flags", () => {
        expect(x509.decodeTriesRemaining(CKF_RNG | CKF_USER_PIN_FINAL_TRY)).toBe(1);
    });
});

describe("getUserCertificate", () => {
    beforeEach(() => loadX509WithConfig({ ...PKCS11_LIBRARY, certs_path: testDir }));

    it("returns the single non-CA certificate and its chain", async () => {
        await writeCerts(rootPem, intermediatePem, leafPem);

        const result = await x509.getUserCertificate();
        assert(result.ok);

        expect(result.data.certificate.subject).toContain("CN=alice");
        expect(result.data.certificate.validTo).toBeInstanceOf(Date);
        // Leaf then intermediate - the self-signed root is excluded.
        expect(result.data.chain).toBe(leafPem + intermediatePem);
    });

    it("stops the chain at the first missing issuer", async () => {
        await writeCerts(rootPem, leafPem);

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: true,
            data: { chain: leafPem },
        });
    });

    it("ignores files that are not certificates", async () => {
        await writeCerts(leafPem);
        await writeFile(path.join(testDir, "notes.txt"), "coyotes!");
        // A private key sharing the directory has a .pem extension but will not parse.
        await writeFile(
            path.join(testDir, "key.pem"),
            "-----BEGIN PRIVATE KEY-----\ncoyotes!\n-----END PRIVATE KEY-----\n",
        );

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: true,
            data: { chain: leafPem },
        });
    });

    it("fails when no certificate directory is configured", async () => {
        mockX509Config(PKCS11_LIBRARY);

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: false,
            error: { code: "CERTIFICATE_NOT_FOUND" },
        });
    });

    it("fails when the certificate directory cannot be read", async () => {
        mockX509Config({ ...PKCS11_LIBRARY, certs_path: path.join(testDir, "missing") });

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: false,
            error: { code: "CERTIFICATE_NOT_FOUND" },
        });
    });

    it("fails when the directory holds no leaf", async () => {
        await writeCerts(rootPem);

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: false,
            error: { code: "CERTIFICATE_NOT_FOUND" },
        });
    });

    it("fails when the directory holds more than one leaf", async () => {
        await writeCerts(leafPem, otherLeafPem);

        await expect(x509.getUserCertificate()).resolves.toMatchObject({
            ok: false,
            error: { code: "CERTIFICATE_AMBIGUOUS" },
        });
    });
});

describe("IPC", () => {
    beforeEach(async () => {
        // `graphene-pk11` and `pkcs11js` are imported lazily, so can be mocked here rather
        // than at import time via `vi.mock`.
        vi.doMock("graphene-pk11", () => ({
            Module: { load: moduleLoad },
            ObjectClass: { PUBLIC_KEY: "public", PRIVATE_KEY: "private" },
            MechanismEnum: { SHA512: "SHA512" },
            RsaMgf: { MGF1_SHA512: "MGF1_SHA512" },
            RsaPssParams,
        }));
        vi.doMock("pkcs11js", () => ({ default: { Pkcs11Error } }));
        await loadX509WithConfig({ ...PKCS11_LIBRARY, certs_path: testDir });
        await writeCerts(leafPem);
    });

    it("routes the on-disk certificate command", async () => {
        const { certificate } = await callIpcAndUnwrap<UserCertificate>("getUserCertificate");
        expect(certificate.subject).toContain("CN=alice");
    });

    describe("listHardwareKeys", () => {
        it("reports the tokens in the module's slots", async () => {
            mockModuleLoad(new MockHardwareToken("SERIAL1"), new MockHardwareToken("SERIAL2"));

            await expect(callIpcAndUnwrap<HardwareKey[]>("listHardwareKeys")).resolves.toEqual([
                {
                    label: "Token SERIAL1",
                    serialNumber: "SERIAL1",
                    manufacturerID: "Coyote Inc.",
                    model: "PIV",
                    maxPinLength: 8,
                    minPinLength: 6,
                },
                expect.objectContaining({ serialNumber: "SERIAL2" }),
            ]);
        });

        it("reloads the module when it reports no slots, in case it cached an empty list", async () => {
            const stale = mockModuleLoad();
            mockModuleLoad(new MockHardwareToken("SERIAL1"));

            const keys = await callIpcAndUnwrap<HardwareKey[]>("listHardwareKeys");
            expect(stale.finalize).toHaveBeenCalled();
            expect(moduleLoad).toHaveBeenCalledTimes(2);
            expect(keys).toMatchObject([{ serialNumber: "SERIAL1" }]);
        });

        it("fails when X.509 is not configured", async () => {
            mockX509Config(undefined);

            await expect(callIpc("listHardwareKeys")).resolves.toMatchObject({
                ok: false,
                error: { code: "MODULE_NOT_LOADED" },
            });
            expect(moduleLoad).not.toHaveBeenCalled();
        });

        it("fails when the PKCS#11 library cannot be loaded", async () => {
            moduleLoad.mockImplementationOnce(() => {
                throw new Error("no such file");
            });

            await expect(callIpc("listHardwareKeys")).resolves.toMatchObject({
                ok: false,
                error: { code: "MODULE_NOT_LOADED" },
            });
        });
    });

    describe("with a token plugged in", () => {
        let token: MockHardwareToken;
        const login = () => callIpcAndUnwrap<void>("logIntoKey", "SERIAL1", "123456");
        const keyState = (serialNumber = "SERIAL1") => callIpcAndUnwrap<HardwareKeyState>("getKeyState", serialNumber);

        beforeEach(() => {
            token = new MockHardwareToken("SERIAL1");
            mockModuleLoad(token);
        });

        describe("getKeyState", () => {
            it("reports an unknown serial number as absent", async () => {
                await expect(keyState("OTHER")).resolves.toBe("absent");
            });

            // The only test of getSession's module-not-loaded pass-through; the other commands share the branch.
            it("fails when X.509 is not configured", async () => {
                mockX509Config(undefined);

                await expect(callIpc("getKeyState", "SERIAL1")).resolves.toMatchObject({
                    ok: false,
                    error: { code: "MODULE_NOT_LOADED" },
                });
            });

            it("reports a token holding no keys", async () => {
                await expect(keyState()).resolves.toBe("noSigningKey");
            });

            it("reports a token holding only keys for other certificates", async () => {
                token.insertKeyPair(otherLeafPem);

                await expect(keyState()).resolves.toBe("noSigningKey");
            });

            it("reports a token holding the key for the configured certificate", async () => {
                token.insertKeyPair(leafPem);

                await expect(keyState()).resolves.toBe("open");
            });

            it("reports a token that has been logged into", async () => {
                token.insertKeyPair(leafPem);

                await login();
                await expect(keyState()).resolves.toBe("authenticated");
            });

            it("fails when no certificate is configured on disk", async () => {
                token.insertKeyPair(leafPem);
                mockX509Config(PKCS11_LIBRARY);

                await expect(callIpc("getKeyState", "SERIAL1")).resolves.toMatchObject({
                    ok: false,
                    error: { code: "CERTIFICATE_NOT_FOUND" },
                });
            });
        });

        describe("logIntoKey", () => {
            it("logs into the token", async () => {
                await expect(login()).resolves.toBeUndefined();
                expect(token.session.login).toHaveBeenCalledWith("123456");
            });

            it("reports the remaining tries when the PIN is wrong", async () => {
                token.info.flags = CKF_USER_PIN_COUNT_LOW | CKF_USER_PIN_FINAL_TRY;
                token.session.login.mockImplementation(() => {
                    throw new Pkcs11Error(CKR_PIN_INCORRECT, "CKR_PIN_INCORRECT");
                });

                await expect(callIpc<X509LoginResult>("logIntoKey", "SERIAL1", "wrong")).resolves.toMatchObject({
                    ok: false,
                    error: { code: "UPSTREAM_PKCS11", pkcs11Code: CKR_PIN_INCORRECT, triesRemaining: 1 },
                });
            });

            it("reports a non-PKCS#11 failure as unknown, still with the remaining tries", async () => {
                token.session.login.mockImplementation(() => {
                    throw new Error("token on fire");
                });

                await expect(callIpc<X509LoginResult>("logIntoKey", "SERIAL1", "123456")).resolves.toMatchObject({
                    ok: false,
                    error: { code: "UNKNOWN", message: "token on fire", triesRemaining: 3 },
                });
            });

            it("fails when no token has the given serial number", async () => {
                await expect(callIpc<X509LoginResult>("logIntoKey", "OTHER", "123456")).resolves.toMatchObject({
                    ok: false,
                    error: { code: "KEY_NOT_FOUND" },
                });
            });
        });

        describe("signData", () => {
            const data = new Uint8Array([1, 2, 3]);

            it("refuses to sign before logging in", async () => {
                token.insertKeyPair(leafPem);

                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "LOGIN_REQUIRED" },
                });
            });

            it("signs with the private key matching the configured certificate", async () => {
                // The token also holds someone else's key pair, which must not be picked.
                token.insertKeyPair(otherLeafPem).insertKeyPair(leafPem);

                await login();
                await expect(callIpcAndUnwrap<Uint8Array>("signData", "SERIAL1", data)).resolves.toEqual(
                    Buffer.from("signature"),
                );
                // The private key is looked up by the CKA_ID of the matching public key.
                expect(token.session.find).toHaveBeenCalledWith({ class: "private", id: keyId(leafPem) });
                // RSA-PSS with SHA-512 throughout, and a salt as long as the digest.
                expect(RsaPssParams).toHaveBeenCalledWith("SHA512", "MGF1_SHA512", 64);
                expect(token.session.createSign).toHaveBeenCalledWith(
                    expect.objectContaining({ name: "SHA512_RSA_PKCS_PSS" }),
                    { id: keyId(leafPem) },
                );
                expect(token.signer.once).toHaveBeenCalledWith(Buffer.from(data));
            });

            it("fails when the token holds only keys for other certificates", async () => {
                token.insertKeyPair(otherLeafPem);

                await login();
                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "PRIVATE_KEY_NOT_FOUND" },
                });
                expect(token.session.createSign).not.toHaveBeenCalled();
            });

            it("fails when the token holds no private key for the certificate", async () => {
                token.insertKeyPair(leafPem, { privateKey: false });

                await login();
                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "PRIVATE_KEY_NOT_FOUND" },
                });
            });

            it("fails when no certificate is configured on disk", async () => {
                mockX509Config(PKCS11_LIBRARY);
                token.insertKeyPair(leafPem);

                await login();
                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "CERTIFICATE_NOT_FOUND" },
                });
            });

            it("drops the cached session on a PKCS#11 error so the next call reopens it", async () => {
                token.insertKeyPair(leafPem);
                token.session.createSign.mockImplementation(() => {
                    throw new Pkcs11Error(CKR_SESSION_HANDLE_INVALID, "CKR_SESSION_HANDLE_INVALID");
                });

                await login();
                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "UPSTREAM_PKCS11", pkcs11Code: CKR_SESSION_HANDLE_INVALID },
                });
                expect(token.slot.open).toHaveBeenCalledTimes(1);

                // The reopened session hasn't been logged into, so we'll need to put in the PIN again.
                await expect(callIpc("signData", "SERIAL1", data)).resolves.toMatchObject({
                    ok: false,
                    error: { code: "LOGIN_REQUIRED" },
                });
                expect(token.slot.open).toHaveBeenCalledTimes(2);
            });
        });
    });
});
