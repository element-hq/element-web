/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import { logger } from "matrix-js-sdk/src/logger";
import type { X509ClientInitOpts } from "@element-hq/element-web-module-api";
import type {
    HardwareKey,
    HardwareKeyState,
    UserCertificate,
    X509IpcCommand,
    X509LoginResult,
    X509Result,
} from "shared-types";

import { IPCManager } from "./IPCManager";
import Modal from "../../Modal";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import InfoDialog from "../../components/views/dialogs/InfoDialog";
import TextInputDialog from "../../components/views/dialogs/TextInputDialog";
import { _t } from "../../languageHandler";

/**
 * How often the insertion dialog re-checks for an attached hardware key.
 */
const KEY_POLL_INTERVAL_MS = 1000;

/**
 * How many times to re-resolve the hardware key before giving up on a signature.
 */
const MAX_SIGN_ROUNDS = 3;

/**
 * Drives X.509 identity signing over Electron IPC with a PKCS#11 hardware key.
 */
export class X509Manager {
    private readonly ipc = new IPCManager<X509IpcCommand>("x509", "x509Reply");
    private clientInitOptsPromise?: Promise<X509ClientInitOpts | null>;
    /**
     * Stores the Promise of any in-flight calls to {@link sign} to prevent concurrent signs from
     * causing issues.
     */
    private signPromise: Promise<unknown> = Promise.resolve();

    /**
     * The options to pass to `MatrixClient.initRustCrypto`. These are memoised so the PIN is only asked
     * for once on startup.
     *
     * @returns null when X.509 isn't configured or no usable certificate is provisioned.
     */
    public getClientInitOpts(): Promise<X509ClientInitOpts | null> {
        this.clientInitOptsPromise ??= this.buildClientInitOpts();
        return this.clientInitOptsPromise;
    }

    /**
     * Finds the user's certificate and wraps it as an X.509 signer, and supplies the CA certificates used
     * to verify other users.
     */
    private async buildClientInitOpts(): Promise<X509ClientInitOpts | null> {
        const user = await this.getUserCertificate();
        if (!user.ok) {
            // No user certificate was configured, but we can still verify other users
            // if we have a valid CA chain.
            if (user.error.code !== "CERTIFICATE_NOT_FOUND") {
                logger.warn("X.509: no usable certificate, continuing without identity signing", user.error);
            }
            const anchors = await this.getCaCertificates();
            return anchors ? { userVerificationCaCertsPem: anchors } : null;
        }
        const { certificate, chain, caCertsPem } = user.data;

        return {
            userVerificationCaCertsPem: caCertsPem || undefined,
            signer: (item) => {
                // Ensure we only have one sign running at a time, regardless of whether it was successful.
                const result = this.signPromise.then(
                    () => this.sign(chain, item),
                    () => this.sign(chain, item),
                );
                this.signPromise = result.catch(() => {});
                return result;
            },
            validity: () => certificate.validTo.getTime(),
        };
    }

    /**
     * Finds an attached hardware key holding the private key for our certificate, and its place in the sequence.
     *
     * @returns null when no attached key holds our private key, including when the module isn't loaded.
     */
    private async findSigningKey(): Promise<{ key: HardwareKey; state: HardwareKeyState } | null> {
        const keys = await this.listHardwareKeys();
        if (!keys.ok) {
            logger.warn("X.509: failed to list hardware keys", keys.error);
            return null;
        }
        // TODO: This picks the first hardware key - what if we have multiple?
        for (const key of keys.data) {
            const state = await this.getKeyState(key.serialNumber);
            if (!state.ok) {
                continue;
            }
            if (state.data === "noSigningKey") {
                logger.info(`X.509: ${key.label} holds no key for the configured certificate, skipping`);
                continue;
            }
            if (state.data === "open" || state.data === "authenticated") {
                return { key, state: state.data };
            }
        }
        return null;
    }

    /**
     * Asks the user to insert a hardware key holding our private key, and returns a
     * Promise that resolves when one appears.
     *
     * @returns null if the user dismisses the dialog.
     */
    private waitForSigningKey(): Promise<{ key: HardwareKey; state: HardwareKeyState } | null> {
        const { close, finished } = Modal.createDialog(InfoDialog, {
            title: _t("auth|x509_insert_key_title"),
            description: _t("auth|x509_insert_key_description"),
            button: _t("action|cancel"),
        });

        let found: { key: HardwareKey; state: HardwareKeyState } | null = null;
        let checking = false;
        const timer = setInterval(async () => {
            if (checking) {
                return;
            }
            checking = true;
            try {
                found = await this.findSigningKey();
                if (found) {
                    close();
                }
            } catch (e) {
                logger.warn("X.509: error while waiting for a hardware key", e);
            } finally {
                checking = false;
            }
        }, KEY_POLL_INTERVAL_MS);

        return finished.then(() => {
            clearInterval(timer);
            return found;
        });
    }

    /**
     * Signs `item` with a hardware key for our certificate, handling pin input and unlocking.
     */
    private async sign(
        chain: string,
        item: Uint8Array,
    ): Promise<{ signature_bytes: Uint8Array; certificate_chain: string; signature_scheme: "RsaPssSha512" }> {
        for (let round = 0; round < MAX_SIGN_ROUNDS; round++) {
            const resolved = (await this.findSigningKey()) ?? (await this.waitForSigningKey());
            if (!resolved) {
                throw new Error("X.509 signing cancelled");
            }
            const { key, state } = resolved;

            if (state !== "authenticated") {
                const login = await this.logIntoKeyWithPrompt(key);
                if (login === "refused") {
                    throw new Error("X.509 signing cancelled");
                }
                if (login === "unresponsive") {
                    // Go around again and see if we re-find the key.
                    continue;
                }
            }

            const signature = await this.signData(key.serialNumber, item);
            if (signature.ok) {
                return {
                    signature_bytes: new Uint8Array(signature.data),
                    certificate_chain: chain,
                    signature_scheme: "RsaPssSha512",
                };
            }
            // The session died between the state check and the signature, so start over.
            if (signature.error.code === "LOGIN_REQUIRED") {
                logger.warn("X.509: session was no longer authenticated, retrying");
                continue;
            }
            throw new Error(`X.509 signing failed: ${signature.error.message ?? signature.error.code}`);
        }
        throw new Error("X.509 signing failed: the hardware key kept failing");
    }

    /**
     * Prompt and wait for the target key's PIN until it unlocks, the user cancels, or it locks itself.
     */
    private async logIntoKeyWithPrompt(key: HardwareKey): Promise<"loggedIn" | "refused" | "unresponsive"> {
        let triesRemaining: number | undefined;
        while (true) {
            const { finished } = Modal.createDialog(TextInputDialog, {
                title: _t("auth|x509_pin_title"),
                description:
                    triesRemaining === undefined
                        ? _t("auth|x509_pin_description", { label: key.label })
                        : _t("auth|x509_pin_incorrect", { count: triesRemaining }),
                type: "password",
                button: _t("action|continue"),
            });
            const [ok, pin] = await finished;
            if (!ok) {
                return "refused";
            }
            const result = await this.logIntoKey(key.serialNumber, pin!);
            if (result.ok) {
                return "loggedIn";
            }
            triesRemaining = result.error.triesRemaining;
            // A PKCS#11 failure with attempts left is a wrong PIN, so ask again.
            if (result.error.code === "PKCS11" && triesRemaining !== 0) {
                continue;
            }
            logger.warn("X.509: failed to unlock hardware key", result.error);
            if (triesRemaining === 0) {
                Modal.createDialog(ErrorDialog, {
                    title: _t("auth|x509_unlock_failed_title"),
                    description: _t("auth|x509_pin_locked_description"),
                });
                return "refused";
            }
            // No error dialog: the caller asks for the hardware key back instead, which is the actionable prompt.
            return "unresponsive";
        }
    }

    // --- IPC wrappers ---

    private listHardwareKeys(): Promise<X509Result<HardwareKey[]>> {
        return this.ipc.call("listHardwareKeys");
    }

    private getKeyState(serialNumber: string): Promise<X509Result<HardwareKeyState>> {
        return this.ipc.call("getKeyState", serialNumber);
    }

    private logIntoKey(serialNumber: string, pin: string): Promise<X509LoginResult> {
        return this.ipc.call("logIntoKey", serialNumber, pin);
    }

    private getUserCertificate(): Promise<X509Result<UserCertificate>> {
        return this.ipc.call("getUserCertificate");
    }

    /** @returns the CA bundle, or undefined when none is configured. */
    private async getCaCertificates(): Promise<string | undefined> {
        const result = await this.ipc.call<X509Result<string>>("getCaCertificates");
        return result.ok && result.data ? result.data : undefined;
    }

    private signData(keySerialNumber: string, data: Uint8Array): Promise<X509Result<Uint8Array>> {
        return this.ipc.call("signData", keySerialNumber, data);
    }
}
