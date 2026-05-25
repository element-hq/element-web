/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useState } from "react";
import { InlineSpinner } from "@vector-im/compound-web";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { _t } from "../../../../languageHandler";
import { copyPlaintext } from "../../../../utils/strings";
import {
    computeKeyBackupDiagnostics,
    buildSanitizedDiagnosticSummary,
    DiagnosticSeverity,
    type KeyBackupDiagnosticResult,
    type DiagnosticCheck,
    type ServerBackupInfo,
} from "../../../../utils/crypto/KeyBackupDiagnostics";

function assertNever(value: never): never {
    throw new Error(`Unexpected diagnostic severity: ${String(value)}`);
}

/**
 * Returns the CSS class name suffix for a given diagnostic severity.
 */
function severityClass(severity: DiagnosticSeverity): string {
    switch (severity) {
        case DiagnosticSeverity.OK:
            return "mx_KeyBackupDiagnosticsPanel_ok";
        case DiagnosticSeverity.Warning:
            return "mx_KeyBackupDiagnosticsPanel_warning";
        case DiagnosticSeverity.Error:
            return "mx_KeyBackupDiagnosticsPanel_error";
        case DiagnosticSeverity.Unknown:
            return "mx_KeyBackupDiagnosticsPanel_unknown";
        default:
            return assertNever(severity);
    }
}

/**
 * Returns a display icon for a given diagnostic severity.
 */
function severityIcon(severity: DiagnosticSeverity): string {
    switch (severity) {
        case DiagnosticSeverity.OK:
            return "✓";
        case DiagnosticSeverity.Warning:
            return "⚠";
        case DiagnosticSeverity.Error:
            return "✗";
        case DiagnosticSeverity.Unknown:
            return "?";
        default:
            return assertNever(severity);
    }
}

/**
 * Returns a translated label for a given diagnostic severity.
 */
function severityLabel(severity: DiagnosticSeverity): string {
    switch (severity) {
        case DiagnosticSeverity.OK:
            return _t("devtools|crypto|diagnostics_severity_ok");
        case DiagnosticSeverity.Warning:
            return _t("devtools|crypto|diagnostics_severity_warning");
        case DiagnosticSeverity.Error:
            return _t("devtools|crypto|diagnostics_severity_error");
        case DiagnosticSeverity.Unknown:
            return _t("devtools|crypto|diagnostics_severity_unknown");
        default:
            return assertNever(severity);
    }
}

function serverBackupExistsLabel(serverBackup: ServerBackupInfo): string {
    if (serverBackup.fetchError) {
        return _t("devtools|crypto|diagnostics_fetch_error");
    }

    if (serverBackup.exists) {
        return `${_t("devtools|crypto|diagnostics_value_yes")} (${serverBackup.version})`;
    }

    return _t("devtools|crypto|diagnostics_no_server_backup");
}

function serverPublicKeyLabel(serverBackup: ServerBackupInfo): string {
    if (!serverBackup.algorithmSupported) {
        return _t("devtools|crypto|diagnostics_not_applicable");
    }

    return serverBackup.publicKeyPresent
        ? _t("devtools|crypto|diagnostics_server_public_key_present")
        : _t("devtools|crypto|diagnostics_server_public_key_absent");
}

/**
 * Renders a single row in the consistency checks table.
 */
function CheckRow({ check }: Readonly<{ check: DiagnosticCheck }>): JSX.Element {
    return (
        <tr className={severityClass(check.severity)}>
            <td>{check.label}</td>
            <td>
                <span className={severityClass(check.severity)}>
                    {severityIcon(check.severity)} {severityLabel(check.severity)}
                </span>
            </td>
            <td>{check.detail ?? ""}</td>
        </tr>
    );
}

/**
 * Renders the overall status banner at the top of the diagnostics panel.
 */
function StatusBanner({ severity }: Readonly<{ severity: DiagnosticSeverity }>): JSX.Element {
    return (
        <output
            className={`mx_KeyBackupDiagnosticsPanel_statusBanner ${severityClass(severity)}`}
            aria-label={_t("devtools|crypto|diagnostics_overall_status")}
        >
            <span className="mx_KeyBackupDiagnosticsPanel_statusIcon">{severityIcon(severity)}</span>
            <span>
                {_t("devtools|crypto|diagnostics_overall_status")}: {severityLabel(severity)}
            </span>
        </output>
    );
}

/**
 * A read-only diagnostic dashboard for key backup state in the E2EE DevTools.
 *
 * Shows server-side and local backup information, runs consistency checks,
 * and allows copying a sanitized diagnostic summary for bug reports.
 *
 * This component is strictly read-only: it does not repair, delete, create,
 * or modify any backup state. It never exposes private keys, recovery keys,
 * access tokens, or secret storage private material.
 */
export function KeyBackupDiagnosticsPanel(): JSX.Element {
    const matrixClient = useMatrixClientContext();
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);

    // Compute diagnostics asynchronously, re-running when refresh is triggered
    const diagnosticResult = useAsyncMemo(async (): Promise<KeyBackupDiagnosticResult | null> => {
        const crypto = matrixClient.getCrypto();
        if (!crypto) return null;

        return computeKeyBackupDiagnostics(crypto);
    }, [matrixClient, refreshCounter]);

    const onRefresh = useCallback((): void => {
        setRefreshCounter((c) => c + 1);
        setCopyStatus(null);
    }, []);

    const onCopy = useCallback(async (): Promise<void> => {
        if (!diagnosticResult) return;
        const summary = buildSanitizedDiagnosticSummary(diagnosticResult);
        let success = false;
        try {
            success = await copyPlaintext(summary);
        } catch {
            success = false;
        }
        setCopyStatus(
            success ? _t("devtools|crypto|diagnostics_copy_success") : _t("devtools|crypto|diagnostics_copy_failure"),
        );
    }, [diagnosticResult]);

    // Loading state
    if (diagnosticResult === undefined) {
        return <InlineSpinner aria-label={_t("devtools|crypto|key_backup_diagnostics")} />;
    }

    // Crypto not available
    if (diagnosticResult === null) {
        return <span>{_t("devtools|crypto|crypto_not_available")}</span>;
    }

    return (
        <div className="mx_KeyBackupDiagnosticsPanel">
            <h3>{_t("devtools|crypto|key_backup_diagnostics")}</h3>

            <StatusBanner severity={diagnosticResult.overallSeverity} />

            {/* Server Backup Section */}
            <table aria-label={_t("devtools|crypto|diagnostics_server_backup")}>
                <thead>
                    <tr>
                        <th colSpan={2}>{_t("devtools|crypto|diagnostics_server_backup")}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th scope="row">{_t("devtools|crypto|diagnostics_server_exists")}</th>
                        <td>{serverBackupExistsLabel(diagnosticResult.serverBackup)}</td>
                    </tr>
                    {diagnosticResult.serverBackup.exists && (
                        <>
                            <tr>
                                <th scope="row">{_t("devtools|crypto|diagnostics_server_algorithm")}</th>
                                <td>
                                    {diagnosticResult.serverBackup.algorithm ??
                                        _t("devtools|crypto|diagnostics_severity_unknown")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("devtools|crypto|diagnostics_algorithm_supported")}</th>
                                <td>
                                    {diagnosticResult.serverBackup.algorithmSupported
                                        ? _t("devtools|crypto|diagnostics_value_yes")
                                        : _t("devtools|crypto|diagnostics_algorithm_not_supported")}
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">{_t("devtools|crypto|diagnostics_server_public_key")}</th>
                                <td>{serverPublicKeyLabel(diagnosticResult.serverBackup)}</td>
                            </tr>
                        </>
                    )}
                </tbody>
            </table>

            {/* Local Backup Section */}
            <table aria-label={_t("devtools|crypto|diagnostics_local_backup")}>
                <thead>
                    <tr>
                        <th colSpan={2}>{_t("devtools|crypto|diagnostics_local_backup")}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th scope="row">{_t("devtools|crypto|diagnostics_local_private_key")}</th>
                        <td>
                            {diagnosticResult.localBackup.privateKeyAvailable
                                ? _t("devtools|crypto|diagnostics_local_private_key_available")
                                : _t("devtools|crypto|diagnostics_local_private_key_unavailable")}
                        </td>
                    </tr>
                    {diagnosticResult.localBackup.matchesServerKey !== null && (
                        <tr>
                            <th scope="row">{_t("devtools|crypto|diagnostics_keys_match")}</th>
                            <td
                                className={
                                    diagnosticResult.localBackup.matchesServerKey
                                        ? severityClass(DiagnosticSeverity.OK)
                                        : severityClass(DiagnosticSeverity.Error)
                                }
                            >
                                {diagnosticResult.localBackup.matchesServerKey
                                    ? _t("devtools|crypto|diagnostics_keys_match_yes")
                                    : _t("devtools|crypto|diagnostics_keys_match_no")}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Consistency Checks Table */}
            <table aria-label={_t("devtools|crypto|diagnostics_consistency_checks")}>
                <thead>
                    <tr>
                        <th>{_t("devtools|crypto|diagnostics_check")}</th>
                        <th>{_t("devtools|crypto|diagnostics_status")}</th>
                        <th>{_t("devtools|crypto|diagnostics_detail")}</th>
                    </tr>
                </thead>
                <tbody>
                    {diagnosticResult.checks.map((check) => (
                        <CheckRow key={check.id} check={check} />
                    ))}
                </tbody>
            </table>

            {/* Action buttons */}
            <div className="mx_KeyBackupDiagnosticsPanel_actions">
                <button type="button" onClick={onRefresh}>
                    {_t("devtools|crypto|diagnostics_refresh")}
                </button>
                <button type="button" onClick={onCopy}>
                    {_t("devtools|crypto|diagnostics_copy_summary")}
                </button>
                {copyStatus && <span className="mx_KeyBackupDiagnosticsPanel_copyStatus">{copyStatus}</span>}
            </div>
        </div>
    );
}
