/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type CryptoApi, type KeyBackupInfo, type Curve25519AuthData } from "matrix-js-sdk/src/crypto-api";

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
    /** A human-readable description of what this check verifies. */
    label: string;
    /** The severity result for this check. */
    severity: DiagnosticSeverity;
    /** Optional detail string providing more information about the result. */
    detail?: string;
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
            label: "Server backup exists",
            severity: DiagnosticSeverity.Unknown,
            detail: "Unable to fetch backup info",
        };
    }

    return {
        id: "server-backup-exists",
        label: "Server backup exists",
        severity: serverExists ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: serverExists ? `Version: ${serverVersion}` : "No backup found on server",
    };
}

function buildAlgorithmCheck(algorithmSupported: boolean, serverAlgorithm: string | undefined): DiagnosticCheck {
    return {
        id: "algorithm-supported",
        label: "Backup algorithm supported",
        severity: algorithmSupported ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: serverAlgorithm ?? "Unknown algorithm",
    };
}

function buildServerPublicKeyCheck(algorithmSupported: boolean, publicKeyPresent: boolean): DiagnosticCheck {
    if (!algorithmSupported) {
        return {
            id: "server-public-key-present",
            label: "Server public key present",
            severity: DiagnosticSeverity.Unknown,
            detail: "Not applicable for unsupported backup algorithm",
        };
    }

    return {
        id: "server-public-key-present",
        label: "Server public key present",
        severity: publicKeyPresent ? DiagnosticSeverity.OK : DiagnosticSeverity.Error,
        detail: publicKeyPresent ? "Present in auth_data" : "Missing from auth_data",
    };
}

function buildLocalPrivateKeyCheck(localPrivateKeyAvailable: boolean): DiagnosticCheck {
    return {
        id: "local-private-key-exists",
        label: "Local backup private key available",
        severity: localPrivateKeyAvailable ? DiagnosticSeverity.OK : DiagnosticSeverity.Warning,
        detail: localPrivateKeyAvailable ? "Cached locally" : "Not found locally",
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
                label: "Local key matches server key",
                severity: DiagnosticSeverity.Unknown,
                detail: "Cannot verify - unsupported algorithm",
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
                label: "Local key matches server key",
                severity: matchesServerKey ? DiagnosticSeverity.OK : DiagnosticSeverity.Error,
                detail: matchesServerKey
                    ? "Local private key matches server public key"
                    : "Local private key does NOT match server public key - backup state is inconsistent",
            },
        };
    } catch {
        return {
            matchesServerKey: null,
            check: {
                id: "keys-match",
                label: "Local key matches server key",
                severity: DiagnosticSeverity.Error,
                detail: "Failed to verify key match",
            },
        };
    }
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

    const localPrivateKey = await crypto.getSessionBackupPrivateKey();
    const localPrivateKeyAvailable = localPrivateKey !== null;
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
 * @returns A plain-text summary string.
 */
export function buildSanitizedDiagnosticSummary(result: KeyBackupDiagnosticResult): string {
    const consistencyChecks = result.checks.map((check) => {
        const status = check.severity.toUpperCase();
        const detail = check.detail ? ` - ${check.detail}` : "";
        return `[${status}] ${check.label}${detail}`;
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
