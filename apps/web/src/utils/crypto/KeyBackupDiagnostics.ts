/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type CryptoApi, type KeyBackupInfo, type Curve25519AuthData } from "matrix-js-sdk/src/crypto-api";

import { _td } from "../../languageHandler";

/** The supported backup algorithm for diagnostics. */
const SUPPORTED_ALGORITHM = "m.megolm_backup.v1.curve25519-aes-sha2";

/**
 * Severity levels for diagnostic checks, ordered from best to worst.
 */
export enum DiagnosticSeverity {
    OK = "ok",
    Warning = "warning",
    Error = "error",
    Unknown = "unknown",
}

/**
 * A single diagnostic check result.
 */
export interface DiagnosticCheck {
    /** A machine-readable identifier for this check. */
    id: string;
    /** Translation key describing what this check verifies. */
    label: TranslationKey;
    /** The severity result for this check. */
    severity: DiagnosticSeverity;
    /** Optional translated message providing more information about the result. */
    detail?: DiagnosticMessage;
}

/**
 * A translatable diagnostic message and its string-safe interpolation variables.
 */
export interface DiagnosticMessage {
    /** Translation key for the message. */
    key: TranslationKey;
    /** Optional variables to interpolate into the translated message. */
    variables?: Record<string, string | number>;
}

/**
 * Server-side backup information gathered during diagnostics.
 * Never contains private key material.
 */
export interface ServerBackupInfo {
    /** Whether a backup exists on the server. */
    exists: boolean;
    /** Whether fetching backup info failed, leaving server state unknown. */
    fetchError: boolean;
    /** The current backup version, if available. */
    version?: string;
    /** The backup algorithm, if available. */
    algorithm?: string;
    /** Whether the algorithm is supported by the diagnostics code. */
    algorithmSupported: boolean;
    /** Whether the server backup has a public key in auth_data. */
    publicKeyPresent: boolean;
    /** The server-published backup public key. Safe to display. */
    publicKey?: string;
}

/**
 * Local backup information gathered during diagnostics.
 * Never contains private key material — only whether the key exists
 * and whether it derives a matching public key.
 */
export interface LocalBackupInfo {
    /** Whether a local backup private key is available in the cache. */
    privateKeyAvailable: boolean;
    /** Whether the local private key matches the server public key. */
    matchesServerKey: boolean | null;
}

/**
 * Complete diagnostic result for key backup state.
 */
export interface KeyBackupDiagnosticResult {
    /** The worst severity across all checks. */
    overallSeverity: DiagnosticSeverity;
    /** Information about the server-side backup. */
    serverBackup: ServerBackupInfo;
    /** Information about the locally cached backup key. */
    localBackup: LocalBackupInfo;
    /** Individual diagnostic checks with their results. */
    checks: DiagnosticCheck[];
    /** Timestamp (ms since epoch) when the diagnostics were computed. */
    timestamp: number;
}

/**
 * Computes the overall severity as the worst severity found in a list of checks.
 *
 * Severity ordering (worst to best): Error > Warning > Unknown > OK.
 * Unknown ranks below Warning because it represents an inconclusive check,
 * while Warning represents a known degraded backup state.
 *
 * @param checks - The list of diagnostic checks.
 * @returns The worst severity across all checks, or OK if the list is empty.
 */
function computeOverallSeverity(checks: DiagnosticCheck[]): DiagnosticSeverity {
    const severityOrder: Record<DiagnosticSeverity, number> = {
        [DiagnosticSeverity.OK]: 0,
        [DiagnosticSeverity.Unknown]: 1,
        [DiagnosticSeverity.Warning]: 2,
        [DiagnosticSeverity.Error]: 3,
    };

    let worst = DiagnosticSeverity.OK;
    for (const check of checks) {
        if (severityOrder[check.severity] > severityOrder[worst]) {
            worst = check.severity;
        }
    }
    return worst;
}

/**
 * Extracts the Curve25519 public key from the server backup info, if present.
 *
 * @param backupInfo - The server's key backup info.
 * @returns The public key string, or undefined if not present or not a Curve25519 backup.
 */
function extractServerPublicKey(backupInfo: KeyBackupInfo): string | undefined {
    const authData = backupInfo.auth_data as Curve25519AuthData | undefined;
    return authData?.public_key;
}

async function fetchServerBackupInfo(crypto: CryptoApi): Promise<{
    backupInfo: KeyBackupInfo | null;
    fetchError: boolean;
}> {
    try {
        return {
            backupInfo: await crypto.getKeyBackupInfo(),
            fetchError: false,
        };
    } catch {
        return {
            backupInfo: null,
            fetchError: true,
        };
    }
}

function buildServerBackupExistsCheck(
    serverExists: boolean,
    serverVersion: string | undefined,
    fetchError: boolean,
): DiagnosticCheck {
    if (fetchError) {
        return {
            id: "server-backup-exists",
            label: _td("devtools|crypto|diagnostics_check_label|server_backup_exists"),
            severity: DiagnosticSeverity.Unknown,
            detail: {
                key: _td("devtools|crypto|diagnostics_fetch_error"),
            },
        };
    }

    return {
        id: "server-backup-exists",
        label: _td("devtools|crypto|diagnostics_check_label|server_backup_exists"),
        severity: serverExists ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: serverExists
            ? {
                  key: _td("devtools|crypto|diagnostics_check_detail|version"),
                  variables: { version: serverVersion ?? "" },
              }
            : {
                  key: _td("devtools|crypto|diagnostics_no_server_backup"),
              },
    };
}

function buildAlgorithmCheck(algorithmSupported: boolean, serverAlgorithm: string | undefined): DiagnosticCheck {
    return {
        id: "algorithm-supported",
        label: _td("devtools|crypto|diagnostics_check_label|algorithm_supported"),
        severity: algorithmSupported ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: serverAlgorithm
            ? {
                  key: _td("devtools|crypto|diagnostics_check_detail|algorithm"),
                  variables: { algorithm: serverAlgorithm },
              }
            : {
                  key: _td("devtools|crypto|diagnostics_check_detail|unknown_algorithm"),
              },
    };
}

function buildServerPublicKeyCheck(algorithmSupported: boolean, publicKeyPresent: boolean): DiagnosticCheck {
    if (!algorithmSupported) {
        return {
            id: "server-public-key-present",
            label: _td("devtools|crypto|diagnostics_check_label|server_public_key_present"),
            severity: DiagnosticSeverity.Unknown,
            detail: {
                key: _td("devtools|crypto|diagnostics_check_detail|unsupported_algorithm"),
            },
        };
    }

    return {
        id: "server-public-key-present",
        label: _td("devtools|crypto|diagnostics_check_label|server_public_key_present"),
        severity: publicKeyPresent ? DiagnosticSeverity.OK : DiagnosticSeverity.Error,
        detail: {
            key: publicKeyPresent
                ? _td("devtools|crypto|diagnostics_check_detail|present_in_auth_data")
                : _td("devtools|crypto|diagnostics_check_detail|missing_from_auth_data"),
        },
    };
}

function buildLocalPrivateKeyCheck(localPrivateKeyAvailable: boolean): DiagnosticCheck {
    return {
        id: "local-private-key-exists",
        label: _td("devtools|crypto|diagnostics_check_label|local_private_key_available"),
        severity: localPrivateKeyAvailable ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: {
            key: localPrivateKeyAvailable
                ? _td("devtools|crypto|diagnostics_check_detail|cached_locally")
                : _td("devtools|crypto|diagnostics_check_detail|not_found_locally"),
        },
    };
}

async function buildKeyMatchCheck(
    crypto: CryptoApi,
    backupInfo: KeyBackupInfo | null,
    localPrivateKeyAvailable: boolean,
    algorithmSupported: boolean,
    publicKeyPresent: boolean,
): Promise<{
    matchesServerKey: boolean | null;
    check?: DiagnosticCheck;
}> {
    if (!backupInfo || !localPrivateKeyAvailable) {
        return { matchesServerKey: null };
    }

    if (!algorithmSupported) {
        return {
            matchesServerKey: null,
            check: {
                id: "keys-match",
                label: _td("devtools|crypto|diagnostics_check_label|keys_match"),
                severity: DiagnosticSeverity.Unknown,
                detail: {
                    key: _td("devtools|crypto|diagnostics_check_detail|cannot_verify_unsupported_algorithm"),
                },
            },
        };
    }

    if (!publicKeyPresent) {
        return { matchesServerKey: null };
    }

    try {
        const trustInfo = await crypto.isKeyBackupTrusted(backupInfo);
        const matchesServerKey = trustInfo.matchesDecryptionKey;

        return {
            matchesServerKey,
            check: {
                id: "keys-match",
                label: _td("devtools|crypto|diagnostics_check_label|keys_match"),
                severity: matchesServerKey ? DiagnosticSeverity.OK : DiagnosticSeverity.Error,
                detail: {
                    key: matchesServerKey
                        ? _td("devtools|crypto|diagnostics_check_detail|keys_match")
                        : _td("devtools|crypto|diagnostics_check_detail|keys_mismatch"),
                },
            },
        };
    } catch {
        return {
            matchesServerKey: null,
            check: {
                id: "keys-match",
                label: _td("devtools|crypto|diagnostics_check_label|keys_match"),
                severity: DiagnosticSeverity.Error,
                detail: {
                    key: _td("devtools|crypto|diagnostics_check_detail|key_match_failed"),
                },
            },
        };
    }
}

/**
 * Checks whether a local backup private key is cached without retaining the key
 * material in the diagnostics result or the caller's scope.
 */
async function hasLocalPrivateKey(crypto: CryptoApi): Promise<boolean> {
    return (await crypto.getSessionBackupPrivateKey()) !== null;
}

/**
 * Runs all key backup diagnostic checks and returns a structured result.
 *
 * This function is strictly read-only: it does not repair, delete, create, or
 * modify any backup state. It never exposes private keys, recovery keys,
 * access tokens, or secret storage private material.
 *
 * @param crypto - The CryptoApi instance from the MatrixClient.
 * @returns A promise resolving to the complete diagnostic result.
 */
export async function computeKeyBackupDiagnostics(crypto: CryptoApi): Promise<KeyBackupDiagnosticResult> {
    const { backupInfo, fetchError } = await fetchServerBackupInfo(crypto);
    const serverExists = backupInfo !== null && backupInfo.version !== undefined;
    const serverVersion = backupInfo?.version;
    const serverAlgorithm = backupInfo?.algorithm;
    const algorithmSupported = serverAlgorithm === SUPPORTED_ALGORITHM;
    const serverPublicKey = backupInfo ? extractServerPublicKey(backupInfo) : undefined;
    const publicKeyPresent = serverPublicKey !== undefined && serverPublicKey.length > 0;

    const localPrivateKeyAvailable = await hasLocalPrivateKey(crypto);
    const keyMatch = await buildKeyMatchCheck(
        crypto,
        serverExists ? backupInfo : null,
        localPrivateKeyAvailable,
        algorithmSupported,
        publicKeyPresent,
    );
    const checks: DiagnosticCheck[] = [
        buildServerBackupExistsCheck(serverExists, serverVersion, fetchError),
        ...(serverExists ? [buildAlgorithmCheck(algorithmSupported, serverAlgorithm)] : []),
        ...(serverExists ? [buildServerPublicKeyCheck(algorithmSupported, publicKeyPresent)] : []),
        buildLocalPrivateKeyCheck(localPrivateKeyAvailable),
        ...(keyMatch.check ? [keyMatch.check] : []),
    ];
    const serverBackup: ServerBackupInfo = {
        exists: serverExists,
        fetchError,
        version: serverVersion,
        algorithm: serverAlgorithm,
        algorithmSupported,
        publicKeyPresent,
        publicKey: publicKeyPresent ? serverPublicKey : undefined,
    };

    const localBackup: LocalBackupInfo = {
        privateKeyAvailable: localPrivateKeyAvailable,
        matchesServerKey: keyMatch.matchesServerKey,
    };

    return {
        overallSeverity: computeOverallSeverity(checks),
        serverBackup,
        localBackup,
        checks,
        timestamp: Date.now(),
    };
}

/**
 * Builds a sanitized plain-text summary of the diagnostic result, suitable
 * for inclusion in bug reports.
 *
 * This summary never includes private keys, recovery keys, access tokens,
 * or secret storage private material.
 *
 * @param result - The diagnostic result to summarize.
 * @param translateMessage - Resolves a diagnostic message into localized text.
 * @returns A plain-text summary string.
 */
export function buildSanitizedDiagnosticSummary(
    result: KeyBackupDiagnosticResult,
    translateMessage: (message: DiagnosticMessage) => string,
): string {
    const consistencyChecks = result.checks.map((check) => {
        const status = check.severity.toUpperCase();
        const label = translateMessage({ key: check.label });
        const detail = check.detail ? ` - ${translateMessage(check.detail)}` : "";
        return `[${status}] ${label}${detail}`;
    });

    const lines: string[] = [
        "=== Key Backup Diagnostics ===",
        `Timestamp: ${new Date(result.timestamp).toISOString()}`,
        `Overall Status: ${result.overallSeverity.toUpperCase()}`,
        "",
        "--- Server Backup ---",
        `Fetch Error: ${result.serverBackup.fetchError ? "Yes" : "No"}`,
        `Exists: ${result.serverBackup.exists ? "Yes" : "No"}`,
        ...(result.serverBackup.exists
            ? [
                  `Version: ${result.serverBackup.version ?? "unknown"}`,
                  `Algorithm: ${result.serverBackup.algorithm ?? "unknown"}`,
                  `Algorithm Supported: ${result.serverBackup.algorithmSupported ? "Yes" : "No"}`,
                  `Public Key Present: ${result.serverBackup.publicKeyPresent ? "Yes" : "No"}`,
              ]
            : []),
        "",
        "--- Local Backup ---",
        `Private Key Available: ${result.localBackup.privateKeyAvailable ? "Yes" : "No"}`,
        ...(result.localBackup.matchesServerKey !== null
            ? [`Matches Server Key: ${result.localBackup.matchesServerKey ? "Yes" : "No"}`]
            : []),
        "",
        "--- Consistency Checks ---",
        ...consistencyChecks,
    ];

    return lines.join("\n");
}
