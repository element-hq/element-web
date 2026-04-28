/*
Copyright 2022-2025 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import ElectronStore from "electron-store";
import { app, safeStorage, dialog, type SafeStorage, type Session } from "electron";

import { _t } from "./language-helper.js";

/**
 * String union type representing all the safeStorage backends.
 * + The "unknown" backend shouldn't exist in practice once the app is ready
 * + The "plaintext" is the temporarily-unencrypted backend for migration, data is wholly unencrypted - uses PlaintextStorageWriter
 * + The "basic_text" backend is the 'plaintext' backend on Linux, data is encrypted but not using the keychain
 * + The "system" backend is the encrypted backend on Windows & macOS, data is encrypted using system keychain
 * + All other backends are linux-specific and are encrypted using the keychain
 */
type SafeStorageBackend = ReturnType<SafeStorage["getSelectedStorageBackend"]> | "system" | "plaintext";
/**
 * The "unknown" backend is not a valid backend, so we exclude it from the type.
 */
type SaneSafeStorageBackend = Exclude<SafeStorageBackend, "unknown">;

/**
 * Map of safeStorage backends to their command line arguments.
 * kwallet6 cannot be specified via command line
 * https://www.electronjs.org/docs/latest/api/safe-storage#safestoragegetselectedstoragebackend-linux
 */
const safeStorageBackendMap: Omit<Record<SaneSafeStorageBackend, string>, "system" | "plaintext"> = {
    basic_text: "basic",
    gnome_libsecret: "gnome-libsecret",
    kwallet: "kwallet",
    kwallet5: "kwallet5",
    kwallet6: "kwallet6",
};

function relaunchApp(): void {
    console.info("Relaunching app...");
    app.relaunch();
    app.exit();
}

/**
 * Clear all data and relaunch the app.
 */
export async function clearDataAndRelaunch(electronSession: Session): Promise<void> {
    Store.instance?.clear();
    electronSession.flushStorageData();
    await electronSession.clearStorageData();
    relaunchApp();
}

interface StoreData {
    warnBeforeExit: boolean;
    minimizeToTray: boolean;
    spellCheckerEnabled: boolean;
    autoHideMenuBar: boolean;
    locale?: string | string[];
    disableHardwareAcceleration: boolean;
    enableContentProtection: boolean;
    safeStorage?: Record<string, string>;
    /** the safeStorage backend used for the safeStorage data as written */
    safeStorageBackend?: SafeStorageBackend;
    /** whether to explicitly override the safeStorage backend, used for migration */
    safeStorageBackendOverride?: boolean;
    /** whether to perform a migration of the safeStorage data */
    safeStorageBackendMigrate?: boolean;
    /** whether to open the app at login minimised, only valid when app.openAtLogin is true */
    openAtLoginMinimised: boolean;
}

/**
 * Fallback storage writer for secrets, mainly used for automated tests and systems without any safeStorage support.
 */
class StorageWriter {
    public constructor(protected readonly store: ElectronStore<StoreData>) {}

    public getKey(key: string): `safeStorage.${string}` {
        return `safeStorage.${key.replaceAll(".", "-")}`;
    }

    public set(key: string, secret: string): void {
        this.store.set(this.getKey(key), secret);
    }

    public get(key: string): string | undefined {
        return this.store.get(this.getKey(key));
    }

    public delete(key: string): void {
        this.store.delete(this.getKey(key));
    }
}

/**
 * Storage writer for secrets using safeStorage.
 */
class SafeStorageWriter extends StorageWriter {
    public set(key: string, secret: string): void {
        this.store.set(this.getKey(key), safeStorage.encryptString(secret).toString("base64"));
    }

    public get(key: string): string | undefined {
        const ciphertext = this.store.get<string, string | undefined>(this.getKey(key));
        if (ciphertext) {
            try {
                return safeStorage.decryptString(Buffer.from(ciphertext, "base64"));
            } catch (e) {
                console.error("Failed to decrypt secret", e);
                console.error("...ciphertext:", JSON.stringify(ciphertext));
            }
        }
        return undefined;
    }
}

const enum Mode {
    Encrypted = "encrypted", // default
    AllowPlaintext = "allow-plaintext",
    ForcePlaintext = "force-plaintext",
}

/**
 * JSON-backed store for settings which need to be accessible by the main process.
 * Secrets are stored within the `safeStorage` object, encrypted with safeStorage.
 * Any secrets operations are blocked on Electron app ready emit.
 */
class Store extends ElectronStore<StoreData> {
    private static internalInstance?: Store;

    public static get instance(): Store | undefined {
        return Store.internalInstance;
    }

    /**
     * Prepare the store, does not prepare safeStorage, which needs to be done after the app is ready.
     * Must be executed in the first tick of the event loop so that it can call Electron APIs before ready state.
     */
    public static initialize(mode: Mode | undefined): Store {
        if (Store.internalInstance) {
            throw new Error("Store already initialized");
        }

        const store = new Store(mode ?? Mode.Encrypted);
        Store.internalInstance = store;

        if (
            process.platform === "linux" &&
            (store.get("safeStorageBackendOverride") || store.get("safeStorageBackendMigrate"))
        ) {
            const backend = store.get("safeStorageBackend")!;
            if (backend in safeStorageBackendMap) {
                // If the safeStorage backend which was used to write the data is one we can specify via the commandLine
                // then do so to ensure we use the same backend for reading the data.
                app.commandLine.appendSwitch(
                    "password-store",
                    safeStorageBackendMap[backend as keyof typeof safeStorageBackendMap],
                );
            }
        }

        return store;
    }

    // Provides "raw" access to the underlying secrets storage,
    // should be avoided in favour of the getSecret/setSecret/deleteSecret methods.
    private secrets?: StorageWriter;

    private constructor(private mode: Mode) {
        super({
            name: "electron-config",
            clearInvalidConfig: false,
            schema: {
                warnBeforeExit: {
                    type: "boolean",
                    default: true,
                },
                minimizeToTray: {
                    type: "boolean",
                    default: true,
                },
                spellCheckerEnabled: {
                    type: "boolean",
                    default: true,
                },
                autoHideMenuBar: {
                    type: "boolean",
                    default: true,
                },
                locale: {
                    anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                },
                disableHardwareAcceleration: {
                    type: "boolean",
                    default: false,
                },
                enableContentProtection: {
                    type: "boolean",
                    default: false,
                },
                safeStorage: {
                    type: "object",
                },
                safeStorageBackend: {
                    type: "string",
                },
                safeStorageBackendOverride: {
                    type: "boolean",
                },
                safeStorageBackendMigrate: {
                    type: "boolean",
                },
                openAtLoginMinimised: {
                    type: "boolean",
                    default: true,
                },
            },
        });
    }

    private safeStorageReadyPromise?: Promise<boolean>;
    public async safeStorageReady(): Promise<void> {
        if (!this.safeStorageReadyPromise) {
            throw new Error("prepareSafeStorage must be called before using storage methods");
        }
        await this.safeStorageReadyPromise;
    }

    /**
     * Normalise the backend to a sane value (exclude `unknown`), respect forcePlaintext mode,
     * and ensure that if an encrypted backend is picked that encryption is available, falling back to plaintext if not.
     * @param forcePlaintext - whether to force plaintext mode
     * @private
     */
    private chooseBackend(forcePlaintext: boolean): SaneSafeStorageBackend {
        if (forcePlaintext) {
            return "plaintext";
        }

        if (process.platform === "linux") {
            // The following enables plain text encryption if the backend used is basic_text.
            // It has no significance for any other backend.
            // We do this early so that in case we end up using the basic_text backend (either because that's the only one available
            // or as a fallback when the configured backend lacks encryption support), encryption is already turned on.
            safeStorage.setUsePlainTextEncryption(true);

            // Linux safeStorage support is hellish, the support varies on the Desktop Environment used rather than the store itself.
            // https://github.com/electron/electron/issues/39789 https://github.com/microsoft/vscode/issues/185212
            const selectedBackend = safeStorage.getSelectedStorageBackend();

            if (selectedBackend === "unknown" || !safeStorage.isEncryptionAvailable()) {
                return "plaintext";
            }
            return selectedBackend;
        }

        return safeStorage.isEncryptionAvailable() ? "system" : "plaintext";
    }

    /**
     * Prepare the safeStorage backend for use.
     *
     * This will relaunch the app in some cases, in which case it will return false and the caller should abort startup.
     *
     * @param electronSession - The Electron session to use for storage (will be used to clear storage if necessary).
     * @returns true if safeStorage was initialised successfully or false if the app will be relaunched
     */
    public async prepareSafeStorage(electronSession: Session): Promise<boolean> {
        this.safeStorageReadyPromise = this.reallyPrepareSafeStorage(electronSession);
        return this.safeStorageReadyPromise;
    }

    private async reallyPrepareSafeStorage(electronSession: Session): Promise<boolean> {
        await app.whenReady();

        // The backend the existing data is written with if any
        let existingSafeStorageBackend = this.get("safeStorageBackend");
        // The backend and encryption status of the currently loaded backend
        const backend = this.chooseBackend(this.mode === Mode.ForcePlaintext);

        // Handle migrations
        if (existingSafeStorageBackend) {
            if (existingSafeStorageBackend === "basic_text" && backend !== "plaintext" && backend !== "basic_text") {
                this.prepareMigrateBasicTextToPlaintext();
                return false;
            }

            if (this.get("safeStorageBackendMigrate") && backend === "basic_text") {
                this.migrateBasicTextToPlaintext();
                return false;
            }

            if (existingSafeStorageBackend === "plaintext" && backend !== "plaintext") {
                this.migratePlaintextToEncrypted();
                // Ensure we update existingSafeStorageBackend so we don't fall into the "backend changed" clause below
                existingSafeStorageBackend = this.get("safeStorageBackend");
            }
        }

        if (!existingSafeStorageBackend) {
            // First launch of the app or first launch since the update
            if (this.mode === Mode.Encrypted && (backend === "plaintext" || backend === "basic_text")) {
                // Ask the user for consent to use a degraded mode
                await this.consultUserConsentDegradedMode(backend);
            }
            // Store the backend used for the safeStorage data so we can detect if it changes, and we know how the data is encoded
            this.recordSafeStorageBackend(backend);
        } else if (existingSafeStorageBackend !== backend) {
            // We already appear to have started using a backend other than the one that we picked, so
            // set the override flag and relaunch with the backend we were previously using, unless we
            // already have the override flag, in which case we must assume the previous backend is no
            // longer usable, in which case we should fall into the next block and warn the user we can't
            // migrate.
            console.warn(`safeStorage backend changed from ${existingSafeStorageBackend} to ${backend}`);

            if (existingSafeStorageBackend in safeStorageBackendMap && !this.get("safeStorageBackendOverride")) {
                this.set("safeStorageBackendOverride", true);
                relaunchApp();
                return false;
            } else {
                // This will either relaunch the app or throw an execption
                await this.consultUserBackendChangedUnableToMigrate(electronSession);
                return false;
            }
        }

        console.info(`Using storage mode '${this.mode}' with backend '${backend}'`);
        if (backend !== "plaintext") {
            this.secrets = new SafeStorageWriter(this);
        } else {
            this.secrets = new StorageWriter(this);
        }

        return true;
    }

    private async consultUserBackendChangedUnableToMigrate(electronSession: Session): Promise<void> {
        const { response } = await dialog.showMessageBox({
            title: _t("store|error|backend_changed_title"),
            message: _t("store|error|backend_changed"),
            detail: _t("store|error|backend_changed_detail"),
            type: "question",
            buttons: [_t("common|no"), _t("common|yes")],
            defaultId: 0,
            cancelId: 0,
        });
        if (response === 0) {
            throw new Error("safeStorage backend changed and cannot migrate");
        }
        return clearDataAndRelaunch(electronSession);
    }

    private async consultUserConsentDegradedMode(backend: "plaintext" | "basic_text"): Promise<void> {
        if (backend === "plaintext") {
            // Sometimes we may have a working backend that for some reason does not support encryption at the moment.
            // This may be because electron reported an incorrect backend or because of some known issues with the keyring itself.
            // Or the environment specified `--storage-mode=force-plaintext`.
            // In any case, when this happens, we give the user an option to use a weaker form of encryption.
            const { response } = await dialog.showMessageBox({
                title: _t("store|error|backend_no_encryption_title"),
                message: _t("store|error|backend_no_encryption"),
                detail: _t("store|error|backend_no_encryption_detail", {
                    backend: safeStorage.getSelectedStorageBackend(),
                    brand: global.vectorConfig.brand || "Element",
                }),
                type: "error",
                buttons: [_t("action|cancel"), _t("store|error|unsupported_keyring_use_plaintext")],
                defaultId: 0,
                cancelId: 0,
            });
            if (response === 0) {
                throw new Error("isEncryptionAvailable=false and user rejected plaintext");
            }
        } else {
            // Electron did not identify a compatible encrypted backend, ask user for consent to degraded mode
            const { response } = await dialog.showMessageBox({
                title: _t("store|error|unsupported_keyring_title"),
                message: _t("store|error|unsupported_keyring"),
                detail: _t("store|error|unsupported_keyring_detail", {
                    brand: global.vectorConfig.brand || "Element",
                    link: "https://www.electronjs.org/docs/latest/api/safe-storage#safestoragegetselectedstoragebackend-linux",
                }),
                type: "error",
                buttons: [_t("action|cancel"), _t("store|error|unsupported_keyring_use_basic_text")],
                defaultId: 0,
                cancelId: 0,
            });
            if (response === 0) {
                throw new Error("safeStorage backend basic_text and user rejected it");
            }
        }
    }

    private recordSafeStorageBackend(backend: SafeStorageBackend): void {
        this.set("safeStorageBackend", backend);
    }

    /**
     * Linux support for upgrading the backend from basic_text to one of the encrypted backends,
     * this is quite a tricky process as the backend is not known until the app is ready & cannot be changed once it is.
     * 1. We restart the app in safeStorageBackendMigrate mode
     * 2. Now that we are in the mode which our data is written in we decrypt the data, write it back in plaintext
     *     & restart back in default backend mode,
     * 3. Finally, we load the plaintext data & encrypt it.
     */
    private prepareMigrateBasicTextToPlaintext(): void {
        console.info(`Starting safeStorage migration to ${safeStorage.getSelectedStorageBackend()}`);
        this.set("safeStorageBackendMigrate", true);
        relaunchApp();
    }
    private migrateBasicTextToPlaintext(): void {
        const secrets = new SafeStorageWriter(this);
        console.info("Performing safeStorage migration");
        const data = this.get("safeStorage");
        if (data) {
            for (const key in data) {
                this.set(secrets.getKey(key), secrets.get(key));
            }
            this.recordSafeStorageBackend("plaintext");
        }
        this.delete("safeStorageBackendMigrate");
        relaunchApp();
    }
    private migratePlaintextToEncrypted(): void {
        const secrets = new SafeStorageWriter(this);
        const selectedSafeStorageBackend = safeStorage.getSelectedStorageBackend();
        console.info(`Finishing safeStorage migration to ${selectedSafeStorageBackend}`);
        const data = this.get("safeStorage");
        if (data) {
            for (const key in data) {
                secrets.set(key, data[key]);
            }
        }
        this.recordSafeStorageBackend(selectedSafeStorageBackend);
    }

    /**
     * Get the stored secret for the key.
     *
     * @param key The string key name.
     *
     * @returns A promise for the secret string.
     */
    public async getSecret(key: string): Promise<string | undefined> {
        await this.safeStorageReady();
        return this.secrets!.get(key);
    }

    /**
     * Add the secret for the key to the keychain.
     *
     * @param key The string key name.
     * @param secret The string password.
     *
     * @returns A promise for the set password completion.
     */
    public async setSecret(key: string, secret: string): Promise<void> {
        await this.safeStorageReady();
        this.secrets!.set(key, secret);
    }

    /**
     * Delete the stored password for the key.
     *
     * @param key The string key name.
     */
    public async deleteSecret(key: string): Promise<void> {
        await this.safeStorageReady();
        this.secrets!.delete(key);
    }
}

export default Store;
