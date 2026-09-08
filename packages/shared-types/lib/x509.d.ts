/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

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
 */
export type X509IpcCommand =
    | "getUserCertificate"
    | "getCaCertificates"
    | "listHardwareKeys"
    | "getKeyState"
    | "logIntoKey"
    | "signData";

/**
 * Convenient result type for IPC communication.
 */
export type X509Result<T, E extends X509IpcError = X509IpcError> = { ok: true; data: T } | { ok: false; error: E };

/**
 * The error half of a {@link X509Result}.
 */
export type X509Failure<E extends X509IpcError = X509IpcError> = Extract<X509Result<never, E>, { ok: false }>;

/**
 * X.509 IPC error codes.
 */
export type X509IpcErrorCode =
    | "MODULE_NOT_LOADED"
    | "KEY_NOT_FOUND"
    | "CERTIFICATE_NOT_FOUND"
    | "CERTIFICATE_AMBIGUOUS"
    | "PRIVATE_KEY_NOT_FOUND"
    /** `signData` was called before `logIntoKey`, or the session was invalidated since. */
    | "LOGIN_REQUIRED"
    | "PKCS11"
    | "UNKNOWN";

export interface X509IpcError {
    code: X509IpcErrorCode;
    /**
     * `CKR_*` return value from the hardware key, present when `code` is `IpcErrorCode.Pkcs11`.
     */
    pkcs11Code?: number;
    message?: string;
}

export interface X509LoginError extends X509IpcError {
    /**
     * Number of attemps remaining after the last attempt.
     */
    triesRemaining?: number;
}

export type X509LoginResult = X509Result<void, X509LoginError>;

/**
 * A PCKS#11 hardware key.
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
 * An IPC-friendly version of `X509Certificate` we can surface to Element Web.
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
 *   so it is the wrong hardware key. Asking for a PIN would be pointless.
 * - `open` - the key holds our private key but has not been logged into yet.
 * - `authenticated` - logged in; `signData` will work.
 */
export type HardwareKeyState = "absent" | "noSigningKey" | "open" | "authenticated";

/**
 * The current user's signing certificate and the chain built up from it.
 */
export interface UserCertificate {
    certificate: CertificateInfo;
    /**
     * PEM-encoded certificate chain.
     */
    chain: string;
    /**
     * PEM-encoded CA certificates from the same directory, used to verify X.509 signatures on *other*
     * users' identities.
     *
     * Unlike {@link chain} this includes the root, because these are trust anchors rather than a chain to
     * present. Empty when the directory holds no CA certificates.
     */
    caCertsPem: string;
}
