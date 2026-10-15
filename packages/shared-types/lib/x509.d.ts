/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// This file contains types for the X.509 IPC API, used to pass information about hardware keys and
// certificates between the main and render processes.

/**
 * X.509 IPC commands.
 *
 * These form a sequence, and each command documents the state it requires. The main process owns the
 * PKCS#11 session for each key, so it - rather than the renderer - is the authority on whether a login
 * has happened:
 *
 * ```
 * listHardwareKeys()  ->  getKeyState(serial)  ->  logIntoKey(serial, pin)  ->  signData(serial, data)
 * ```
 *
 * `getUserCertificate()` is the only IPC command that operates outside this sequence. It reads the
 * provisioned certificate chain from disk which it passes back to the renderer, and hence needs
 * no hardware key to be attached or logged into.
 */
export type X509IpcCommand = "getUserCertificate" | "listHardwareKeys" | "getKeyState" | "logIntoKey" | "signData";

/**
 * Convenient result type for IPC communication.
 * @alpha
 */
export type X509Result<T, E extends X509IpcError = X509IpcError> = { ok: true; data: T } | { ok: false; error: E };

/**
 * The error half of a {@link X509Result}.
 */
export type X509Failure<E extends X509IpcError = X509IpcError> = Extract<X509Result<never, E>, { ok: false }>;

/**
 * X.509 IPC error codes.
 * @alpha
 */
export type X509IpcErrorCode =
    /**
     * No PKCS#11 library is configured or it could not be loaded.
     */
    | "MODULE_NOT_LOADED"
    | "KEY_NOT_FOUND"
    | "CERTIFICATE_NOT_FOUND"
    | "PRIVATE_KEY_NOT_FOUND"
    /**
     * `signData` was called before `logIntoKey`, or the session was invalidated since.
     */
    | "LOGIN_REQUIRED"
    /**
     * An upstream error from the PKCS#11 library. Carries a `CKR_*` code.
     */
    | "UPSTREAM_PKCS11"
    | "UNKNOWN";

/**
 * The error half of an {@link X509Result}.
 * @alpha
 */
export interface X509IpcError {
    code: X509IpcErrorCode;
    /**
     * `CKR_*` return value from the hardware key, present when `code` is `UPSTREAM_PKCS11`.
     */
    pkcs11Code?: number;
    message?: string;
}

/**
 * Error from {@link X509Api.logIntoKey}.
 * @alpha
 */
export interface X509LoginError extends X509IpcError {
    /**
     * Number of attempts remaining after the last attempt.
     */
    triesRemaining?: number;
}

/**
 * Result of {@link X509Api.logIntoKey}.
 * @alpha
 */
export type X509LoginResult = X509Result<void, X509LoginError>;

/**
 * A PKCS#11 hardware key.
 * @alpha
 */
export interface HardwareKey {
    label: string;
    serialNumber: string;
    manufacturerID: string;
    model: string;
    maxPinLength: number;
    minPinLength: number;
}

/**
 * Details of an X.509 certificate, in a format suitable for passing from the main process
 * to the renderer process over IPC.
 * @alpha
 */
export interface CertificateInfo {
    serialNumber: string;
    subject: string;
    subjectAltName?: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
}

/**
 * How far along the signing sequence a given hardware key is.
 *
 * - `absent` - no attached key reports this serial number.
 * - `noSigningKey` - the key is attached but holds no private key matching the configured certificate,
 *                    so it is the wrong hardware key. Asking for a PIN would be pointless.
 * - `open` - the key holds our private key but has not been logged into yet.
 * - `authenticated` - logged in; `signData` will work.
 * @alpha
 */
export type HardwareKeyState = "absent" | "noSigningKey" | "open" | "authenticated";

/**
 * The current user's signing certificate and the chain it was provisioned with.
 * @alpha
 */
export interface UserCertificate {
    certificate: CertificateInfo;
    /**
     * PEM-encoded certificate chain as provisioned in `certificate_path`, formatted as
     *  the leaf followed by its intermediates, omitting the root.
     */
    chain: string;
}

/**
 * Hardware-key signing with an X.509 certificate, backed by Element Desktop's main process.
 *
 * On configured builds of Element Desktop Pro, this is exposed as `window.electron.x509`, with one
 * method per command on the `x509` IPC channel. The module API hands this same object to modules.
 *
 * @alpha
 */
export interface X509Api {
    /**
     * Read the user's own certificate and chain from disk, as provisioned by the administrator.
     *
     * Operates outside the signing sequence and needs no hardware key. Fails with `CERTIFICATE_NOT_FOUND`
     * when no certificate is configured or the file cannot be read.
     */
    getUserCertificate(): Promise<X509Result<UserCertificate>>;
    /**
     * List the hardware keys currently attached.
     *
     * Fails with `MODULE_NOT_LOADED` when no PKCS#11 library is configured or it could not be loaded.
     */
    listHardwareKeys(): Promise<X509Result<HardwareKey[]>>;
    /**
     * Report how far along the signing sequence the given hardware key is.
     *
     * @param serialNumber - the key's serial number, as reported by {@link X509Api.listHardwareKeys}.
     */
    getKeyState(serialNumber: string): Promise<X509Result<HardwareKeyState>>;
    /**
     * Log in to the given hardware key so that {@link X509Api.signData} can use its private key.
     *
     * On an incorrect PIN the error additionally carries a `triesRemaining` field. If the key has
     * locked itself, this reports zero.
     *
     * @param serialNumber - the key's serial number, as reported by {@link X509Api.listHardwareKeys}.
     * @param pin - the user-provided PIN to attempt login with.
     */
    logIntoKey(serialNumber: string, pin: string): Promise<X509LoginResult>;
    /**
     * Sign the given data with the private key belonging to the configured certificate.
     *
     * Requires {@link X509Api.logIntoKey} to have succeeded first; otherwise fails with `LOGIN_REQUIRED`.
     *
     * @param serialNumber - the key's serial number, as reported by {@link X509Api.listHardwareKeys}.
     * @param data - the bytes to sign.
     * @returns the raw signature bytes.
     */
    signData(serialNumber: string, data: Uint8Array): Promise<X509Result<Uint8Array>>;
}
