/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeAll, beforeEach, vi } from "vitest";
import { safeStorage } from "electron";

import Store, { SafeStorageDecryptionError } from "./store.js";

// In-memory ElectronStore replacement so the tests don't touch the filesystem or real config.
const backing = new Map<string, unknown>();
vi.mock("electron-store", () => {
    class MockElectronStore {
        public constructor(_opts: unknown) {}
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
        // process.platform is darwin in CI/dev on this repo, exercising the "system" backend path.
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
    });
});
