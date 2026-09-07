/*
Copyright 2026 New Vector Ltd.
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeAll, beforeEach, vi } from "vitest";
import { app, safeStorage } from "electron";

import Store, { SafeStorageDecryptionError } from "./store.js";

// In-memory ElectronStore replacement so the tests don't touch the filesystem or real config.
const backing = new Map<string, unknown>();
vi.mock("electron-store", () => {
    // No constructor: the options ElectronStore is handed are irrelevant to this fake, so an empty
    // one would exist only to swallow them — which oxlint's no-useless-constructor rejects.
    class MockElectronStore {
        public get(key: string, defaultValue?: unknown): unknown {
            return backing.has(key) ? backing.get(key) : defaultValue;
        }
        public set(key: string, value: unknown): void {
            backing.set(key, value);
        }
        public has(key: string): boolean {
            return backing.has(key);
        }
        public delete(key: string): void {
            backing.delete(key);
        }
        public clear(): void {
            backing.clear();
        }
    }
    return { default: MockElectronStore };
});

vi.mock("./language-helper.js", () => ({
    _t: (key: string): string => key,
}));

// store.ts reads getConfig().brand for the degraded-mode dialogs. The real config module only
// populates itself in loadConfig(), which these tests never run, so stub it out.
vi.mock("./config.js", () => ({
    getConfig: (): { brand: string } => ({ brand: "Element" }),
}));

// A reversible "encryption" so we control exactly when decryption fails.
const PREFIX = "enc:";
vi.mock("electron", () => ({
    app: {
        whenReady: vi.fn(() => Promise.resolve()),
        getPath: vi.fn(() => "/tmp/element-test"),
        relaunch: vi.fn(),
        exit: vi.fn(),
        commandLine: { appendSwitch: vi.fn() },
    },
    dialog: {
        showMessageBox: vi.fn(() => Promise.resolve({ response: 1 })),
    },
    safeStorage: {
        isEncryptionAvailable: vi.fn(() => true),
        getSelectedStorageBackend: vi.fn(() => "basic_text"),
        setUsePlainTextEncryption: vi.fn(),
        encryptString: vi.fn((plaintext: string) => Buffer.from(PREFIX + plaintext, "utf8")),
        decryptString: vi.fn((buf: Buffer) => {
            const s = buf.toString("utf8");
            if (!s.startsWith(PREFIX)) throw new Error("Failed to decrypt");
            return s.slice(PREFIX.length);
        }),
    },
}));

const KEY = "@alice:example.org|DEVICEID";

describe("Store secret encryption (safeStorage)", () => {
    let store: Store;

    beforeAll(async () => {
        store = Store.initialize(undefined);
        // getSelectedStorageBackend is mocked to "basic_text", so this walks the degraded-mode
        // path and takes the mocked dialog's "use basic_text" answer.
        await store.prepareSafeStorage({} as unknown as Electron.Session);
    });

    beforeEach(() => {
        backing.clear();
        vi.mocked(safeStorage.decryptString).mockClear();
        // Restore the default reversible decrypt implementation between tests.
        vi.mocked(safeStorage.decryptString).mockImplementation((buf: Buffer) => {
            const s = buf.toString("utf8");
            if (!s.startsWith(PREFIX)) throw new Error("Failed to decrypt");
            return s.slice(PREFIX.length);
        });
    });

    it("round-trips a stored secret", async () => {
        await store.setSecret(KEY, "s3cr3t");
        await expect(store.getSecret(KEY)).resolves.toBe("s3cr3t");
    });

    it("returns undefined when no secret is stored", async () => {
        await expect(store.getSecret(KEY)).resolves.toBeUndefined();
    });

    it("throws SafeStorageDecryptionError when the stored secret cannot be decrypted", async () => {
        await store.setSecret(KEY, "s3cr3t");
        // Simulate a transient keychain failure (e.g. keychain locked / ACL invalidated by re-sign).
        vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
            throw new Error("keychain unavailable");
        });

        await expect(store.getSecret(KEY)).rejects.toBeInstanceOf(SafeStorageDecryptionError);
    });

    describe("isSecretUndecryptable", () => {
        it("is false when no secret is stored", async () => {
            await expect(store.isSecretUndecryptable(KEY)).resolves.toBe(false);
        });

        it("is false when the stored secret decrypts correctly", async () => {
            await store.setSecret(KEY, "s3cr3t");
            await expect(store.isSecretUndecryptable(KEY)).resolves.toBe(false);
        });

        it("is true when a stored secret exists but cannot be decrypted", async () => {
            await store.setSecret(KEY, "s3cr3t");
            vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
                throw new Error("keychain unavailable");
            });
            await expect(store.isSecretUndecryptable(KEY)).resolves.toBe(true);
        });

        it("fails closed: is true when reading an existing secret fails with an unexpected error", async () => {
            await store.setSecret(KEY, "s3cr3t");
            // An error from the storage layer itself, not a decryption failure: the guard must not
            // report the secret as safe to overwrite when it cannot prove it is.
            const getSpy = vi.spyOn(store, "get").mockImplementationOnce(() => {
                throw new Error("storage layer exploded");
            });
            try {
                await expect(store.isSecretUndecryptable(KEY)).resolves.toBe(true);
            } finally {
                getSpy.mockRestore();
            }
        });
    });

    describe("basic_text -> plaintext migration", () => {
        // The private migration step normally runs via prepareSafeStorage on a relaunch with
        // safeStorageBackendMigrate set; drive it directly to keep the singleton harness simple.
        const migrate = (): void =>
            (store as unknown as { migrateBasicTextToPlaintext(): void }).migrateBasicTextToPlaintext();

        const GOOD_CIPHERTEXT = Buffer.from(`${PREFIX}goodsecret`, "utf8").toString("base64");
        const BAD_CIPHERTEXT = Buffer.from("not-decryptable", "utf8").toString("base64");

        beforeEach(() => {
            backing.set("safeStorageBackend", "basic_text");
            backing.set("safeStorageBackendMigrate", true);
        });

        it("migrates all secrets to plaintext and records the plaintext backend", () => {
            backing.set("safeStorage", { good: GOOD_CIPHERTEXT });
            backing.set("safeStorage.good", GOOD_CIPHERTEXT);

            migrate();

            expect(backing.get("safeStorage.good")).toBe("goodsecret");
            expect(backing.get("safeStorageBackend")).toBe("plaintext");
            expect(backing.get("safeStorageBackendOverride")).toBeUndefined();
            expect(backing.has("safeStorageBackendMigrate")).toBe(false);
            expect(app.relaunch).toHaveBeenCalled();
        });

        it("defers the whole migration when any secret cannot be decrypted", () => {
            backing.set("safeStorage", { good: GOOD_CIPHERTEXT, bad: BAD_CIPHERTEXT });
            backing.set("safeStorage.good", GOOD_CIPHERTEXT);
            backing.set("safeStorage.bad", BAD_CIPHERTEXT);

            migrate();

            // Nothing may be rewritten: recording "plaintext" while `bad` is still ciphertext would
            // make the next launch re-encrypt the ciphertext as though it were the secret itself,
            // silently corrupting it and defeating the do-not-overwrite protection.
            expect(backing.get("safeStorage.good")).toBe(GOOD_CIPHERTEXT);
            expect(backing.get("safeStorage.bad")).toBe(BAD_CIPHERTEXT);
            expect(backing.get("safeStorageBackend")).toBe("basic_text");
            // Sticks with the working basic_text backend instead of retrying the migration forever.
            expect(backing.get("safeStorageBackendOverride")).toBe(true);
            expect(backing.has("safeStorageBackendMigrate")).toBe(false);
            expect(app.relaunch).toHaveBeenCalled();
        });
    });
});
