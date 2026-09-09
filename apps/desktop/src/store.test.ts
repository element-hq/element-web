/*
Copyright 2026 New Vector Ltd.
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, afterEach, beforeAll, beforeEach, vi, type MockInstance } from "vitest";
import { app, safeStorage } from "electron";

import Store, { Mode, SafeStorageDecryptionError } from "./store.js";

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
        isAsyncEncryptionAvailable: vi.fn(() => Promise.resolve(true)),
        getSelectedStorageBackend: vi.fn(() => "basic_text"),
        setUsePlainTextEncryption: vi.fn(),
        encryptStringAsync: vi.fn((plaintext: string) => Promise.resolve(Buffer.from(PREFIX + plaintext, "utf8"))),
        decryptStringAsync: vi.fn((buf: Buffer) => {
            const s = buf.toString("utf8");
            if (!s.startsWith(PREFIX)) return Promise.reject(new Error("Failed to decrypt"));
            return Promise.resolve({ result: s.slice(PREFIX.length), shouldReEncrypt: false });
        }),
    },
}));

const KEY = "@alice:example.org|DEVICEID";
// The key `KEY` is stored under: dots are not legal in an electron-store path segment.
const STORED_KEY = "safeStorage.@alice:example-org|DEVICEID";
const SESSION = {} as unknown as Electron.Session;

const encrypted = (secret: string): string => Buffer.from(PREFIX + secret, "utf8").toString("base64");

/**
 * Drop the Store singleton so a test can build one with a different mode, platform or on-disk
 * state. Store.initialize refuses to run twice, and prepareSafeStorage is what we want to exercise.
 */
const freshStore = (mode?: Mode): Store => {
    (Store as unknown as { internalInstance?: Store }).internalInstance = undefined;
    return Store.initialize(mode);
};

let platformSpy: MockInstance<() => NodeJS.Platform> | undefined;

/**
 * Pin what process.platform reports for the rest of the test.
 *
 * Every test which builds a Store must do this rather than inherit the host's platform:
 * chooseBackend takes a completely different path on Linux, so an inherited platform makes a test
 * pass on a macOS dev machine and fail on a Linux CI runner. The ambient value is not trustworthy
 * either - other test files in this project mock process.platform without restoring it, and vitest
 * shares one process between the files in a worker.
 */
const usePlatform = (platform: NodeJS.Platform): void => {
    restorePlatform();
    platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue(platform);
};

const restorePlatform = (): void => {
    platformSpy?.mockRestore();
    platformSpy = undefined;
};

describe("Store secret encryption (safeStorage)", () => {
    let store: Store;

    beforeAll(async () => {
        // On Linux with getSelectedStorageBackend mocked to "basic_text" this walks the
        // degraded-mode path and takes the mocked dialog's "use basic_text" answer.
        usePlatform("linux");
        try {
            store = Store.initialize(undefined);
            await store.prepareSafeStorage(SESSION);
        } finally {
            restorePlatform();
        }
    });

    beforeEach(() => {
        // Default to a non-Linux platform; the tests which exercise the Linux paths say so.
        usePlatform("darwin");
        backing.clear();
        vi.mocked(safeStorage.decryptStringAsync).mockClear();
        vi.mocked(safeStorage.encryptStringAsync).mockClear();
        vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
        vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(true);
        vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue("basic_text");
        // Restore the default reversible decrypt implementation between tests.
        vi.mocked(safeStorage.decryptStringAsync).mockImplementation((buf: Buffer) => {
            const s = buf.toString("utf8");
            if (!s.startsWith(PREFIX)) return Promise.reject(new Error("Failed to decrypt"));
            return Promise.resolve({ result: s.slice(PREFIX.length), shouldReEncrypt: false });
        });
    });

    afterEach(() => {
        restorePlatform();
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
        vi.mocked(safeStorage.decryptStringAsync).mockImplementationOnce(() =>
            Promise.reject(new Error("keychain unavailable")),
        );

        await expect(store.getSecret(KEY)).rejects.toBeInstanceOf(SafeStorageDecryptionError);
    });

    it("re-encrypts a secret when safeStorage reports the key has been rotated", async () => {
        await store.setSecret(KEY, "s3cr3t");
        const stored = backing.get("safeStorage.@alice:example-org|DEVICEID");

        // safeStorage decrypted with the old key and wants the secret written back under the new one.
        vi.mocked(safeStorage.decryptStringAsync).mockImplementationOnce(() =>
            Promise.resolve({ result: "s3cr3t", shouldReEncrypt: true }),
        );
        vi.mocked(safeStorage.encryptStringAsync).mockImplementationOnce(() =>
            Promise.resolve(Buffer.from(`${PREFIX}rotated:s3cr3t`, "utf8")),
        );

        await expect(store.getSecret(KEY)).resolves.toBe("s3cr3t");
        expect(backing.get("safeStorage.@alice:example-org|DEVICEID")).not.toBe(stored);
        await expect(store.getSecret(KEY)).resolves.toBe("rotated:s3cr3t");
    });

    it("still returns the secret when re-encrypting it fails", async () => {
        await store.setSecret(KEY, "s3cr3t");
        vi.mocked(safeStorage.decryptStringAsync).mockImplementationOnce(() =>
            Promise.resolve({ result: "s3cr3t", shouldReEncrypt: true }),
        );
        vi.mocked(safeStorage.encryptStringAsync).mockImplementationOnce(() =>
            Promise.reject(new Error("keychain unavailable")),
        );

        await expect(store.getSecret(KEY)).resolves.toBe("s3cr3t");
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
            vi.mocked(safeStorage.decryptStringAsync).mockImplementationOnce(() =>
                Promise.reject(new Error("keychain unavailable")),
            );
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

    describe("backend selection", () => {
        it("uses the encrypted system backend when async encryption is available", async () => {
            usePlatform("darwin");

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);
            expect(backing.get("safeStorageBackend")).toBe("system");
        });

        it("falls back to plaintext when async encryption is unavailable", async () => {
            usePlatform("darwin");
            vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(false);

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("plaintext");
        });

        // A machine with no usable keychain - a GitHub Actions macOS runner, for instance - reports
        // false here while the async probe does not, so both have to be consulted. Picking an
        // encrypted backend on such a machine leaves every secret unstorable.
        it("falls back to plaintext when the OS reports no encryption at all", async () => {
            usePlatform("darwin");
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("plaintext");
            await store.setSecret(KEY, "s3cr3t");
            await expect(store.getSecret(KEY)).resolves.toBe("s3cr3t");
        });

        it("falls back to plaintext when the async encryptor fails to initialise", async () => {
            usePlatform("darwin");
            vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockRejectedValue(new Error("no keychain"));

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("plaintext");
        });

        it("uses the keyring Linux reports when it supports async encryption", async () => {
            usePlatform("linux");
            vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue("gnome_libsecret");

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("gnome_libsecret");
            // Set up front so that a fallback to basic_text is already encrypted, see chooseBackend.
            expect(safeStorage.setUsePlainTextEncryption).toHaveBeenCalledWith(true);
        });

        it("falls back to plaintext when Linux reports an unknown keyring", async () => {
            usePlatform("linux");
            vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue("unknown");

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("plaintext");
        });

        it("falls back to plaintext when the Linux keyring cannot encrypt", async () => {
            usePlatform("linux");
            vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue("gnome_libsecret");
            vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(false);

            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("plaintext");
        });
    });

    describe("plaintext storage", () => {
        it("round-trips a secret without going near safeStorage", async () => {
            const store = freshStore(Mode.ForcePlaintext);
            await store.prepareSafeStorage(SESSION);

            await store.setSecret(KEY, "s3cr3t");

            expect(backing.get(STORED_KEY)).toBe("s3cr3t");
            await expect(store.getSecret(KEY)).resolves.toBe("s3cr3t");
            expect(safeStorage.encryptStringAsync).not.toHaveBeenCalled();
            expect(safeStorage.decryptStringAsync).not.toHaveBeenCalled();
        });

        it("reports a missing secret as absent rather than undecryptable", async () => {
            const store = freshStore(Mode.ForcePlaintext);
            await store.prepareSafeStorage(SESSION);

            await expect(store.getSecret(KEY)).resolves.toBeUndefined();
            await expect(store.isSecretUndecryptable(KEY)).resolves.toBe(false);
        });
    });

    describe("plaintext -> encrypted migration", () => {
        beforeEach(() => {
            usePlatform("linux");
            vi.mocked(safeStorage.getSelectedStorageBackend).mockReturnValue("gnome_libsecret");
            backing.set("safeStorageBackend", "plaintext");
        });

        it("encrypts existing plaintext secrets once an encrypted backend is available", async () => {
            backing.set("safeStorage", { good: "goodsecret" });
            backing.set("safeStorage.good", "goodsecret");

            const store = freshStore();
            // Migrating in place, so startup continues rather than relaunching.
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorage.good")).toBe(encrypted("goodsecret"));
            expect(backing.get("safeStorageBackend")).toBe("gnome_libsecret");
            await expect(store.getSecret("good")).resolves.toBe("goodsecret");
        });

        it("does nothing when there are no secrets to migrate", async () => {
            const store = freshStore();
            await expect(store.prepareSafeStorage(SESSION)).resolves.toBe(true);

            expect(backing.get("safeStorageBackend")).toBe("gnome_libsecret");
            expect(safeStorage.encryptStringAsync).not.toHaveBeenCalled();
        });
    });

    describe("basic_text -> plaintext migration", () => {
        // The migration runs on a relaunch into the basic_text backend with safeStorageBackendMigrate
        // set, so drive it through prepareSafeStorage exactly as that relaunch does.
        const migrate = async (): Promise<void> => {
            const migrating = freshStore();
            // The migration always ends in a relaunch, so startup is told to abort.
            await expect(migrating.prepareSafeStorage(SESSION)).resolves.toBe(false);
        };

        const GOOD_CIPHERTEXT = encrypted("goodsecret");
        const BAD_CIPHERTEXT = Buffer.from("not-decryptable", "utf8").toString("base64");

        beforeEach(() => {
            usePlatform("linux");
            backing.set("safeStorageBackend", "basic_text");
            backing.set("safeStorageBackendMigrate", true);
        });

        it("migrates all secrets to plaintext and records the plaintext backend", async () => {
            backing.set("safeStorage", { good: GOOD_CIPHERTEXT });
            backing.set("safeStorage.good", GOOD_CIPHERTEXT);

            await migrate();

            expect(backing.get("safeStorage.good")).toBe("goodsecret");
            expect(backing.get("safeStorageBackend")).toBe("plaintext");
            expect(backing.get("safeStorageBackendOverride")).toBeUndefined();
            expect(backing.has("safeStorageBackendMigrate")).toBe(false);
            expect(app.relaunch).toHaveBeenCalled();
        });

        it("defers the whole migration when any secret cannot be decrypted", async () => {
            backing.set("safeStorage", { good: GOOD_CIPHERTEXT, bad: BAD_CIPHERTEXT });
            backing.set("safeStorage.good", GOOD_CIPHERTEXT);
            backing.set("safeStorage.bad", BAD_CIPHERTEXT);

            await migrate();

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
