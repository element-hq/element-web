/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import { createTestClient } from "../../../test-utils";
import { _t } from "../../../../src/languageHandler";
import {
    computeKeyBackupDiagnostics,
    buildSanitizedDiagnosticSummary,
    DiagnosticSeverity,
    type DiagnosticMessage,
} from "../../../../src/utils/crypto/KeyBackupDiagnostics";

/** A realistic Curve25519 backup info object for tests. */
const MOCK_BACKUP_INFO: KeyBackupInfo = {
    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
    version: "3",
    auth_data: {
        public_key: "abc123publickey",
        signatures: {},
    },
};

/** A backup info with an unsupported algorithm. */
const UNSUPPORTED_BACKUP_INFO: KeyBackupInfo = {
    algorithm: "m.some.unknown.algorithm",
    version: "2",
    auth_data: {
        signatures: {},
    } as KeyBackupInfo["auth_data"],
};

/** A backup info missing the public key in auth_data. */
const NO_PUBLIC_KEY_BACKUP_INFO: KeyBackupInfo = {
    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
    version: "1",
    auth_data: {
        signatures: {},
    } as KeyBackupInfo["auth_data"],
};

function translateDiagnosticMessage(message: DiagnosticMessage): string {
    return _t(message.key, message.variables);
}

describe("KeyBackupDiagnostics", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    describe("computeKeyBackupDiagnostics", () => {
        it("should return Warning overall severity when server backup is missing", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            expect(result.overallSeverity).toBe(DiagnosticSeverity.Warning);
            expect(result.serverBackup.exists).toBe(false);
        });

        it("should include a failing check for missing server backup", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const existsCheck = result.checks.find((c) => c.id === "server-backup-exists");
            expect(existsCheck).toBeDefined();
            expect(existsCheck!.severity).toBe(DiagnosticSeverity.Warning);
        });

        it("should report Unknown when server backup info cannot be fetched", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockRejectedValue(new Error("network failure"));
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const existsCheck = result.checks.find((c) => c.id === "server-backup-exists");
            expect(result.serverBackup.exists).toBe(false);
            expect(result.serverBackup.fetchError).toBe(true);
            expect(existsCheck!.severity).toBe(DiagnosticSeverity.Unknown);
            expect(existsCheck!.detail).toEqual({
                key: "devtools|crypto|diagnostics_fetch_error",
            });
        });

        it("should return OK for server-backup-exists check when backup exists", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const existsCheck = result.checks.find((c) => c.id === "server-backup-exists");
            expect(existsCheck!.severity).toBe(DiagnosticSeverity.OK);
            expect(result.serverBackup.version).toBe("3");
        });

        it("should return Warning for unsupported backup algorithm", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(UNSUPPORTED_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const algorithmCheck = result.checks.find((c) => c.id === "algorithm-supported");
            expect(algorithmCheck).toBeDefined();
            expect(algorithmCheck!.severity).toBe(DiagnosticSeverity.Warning);
            expect(result.serverBackup.algorithmSupported).toBe(false);
        });

        it("should not error when an unsupported backup algorithm has no public key", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(UNSUPPORTED_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const publicKeyCheck = result.checks.find((c) => c.id === "server-public-key-present");
            expect(result.serverBackup.publicKeyPresent).toBe(false);
            expect(publicKeyCheck!.severity).toBe(DiagnosticSeverity.Unknown);
            expect(publicKeyCheck!.detail).toEqual({
                key: "devtools|crypto|diagnostics_check_detail|unsupported_algorithm",
            });
            expect(result.overallSeverity).not.toBe(DiagnosticSeverity.Error);
        });

        it("should return OK for supported algorithm", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const algorithmCheck = result.checks.find((c) => c.id === "algorithm-supported");
            expect(algorithmCheck!.severity).toBe(DiagnosticSeverity.OK);
            expect(result.serverBackup.algorithmSupported).toBe(true);
        });

        it("should return Error when server public key is missing from auth_data", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(NO_PUBLIC_KEY_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const publicKeyCheck = result.checks.find((c) => c.id === "server-public-key-present");
            expect(publicKeyCheck!.severity).toBe(DiagnosticSeverity.Error);
            expect(result.serverBackup.publicKeyPresent).toBe(false);
        });

        it("should return OK when server public key is present in auth_data", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const publicKeyCheck = result.checks.find((c) => c.id === "server-public-key-present");
            expect(publicKeyCheck!.severity).toBe(DiagnosticSeverity.OK);
            expect(result.serverBackup.publicKeyPresent).toBe(true);
            expect(result.serverBackup.publicKey).toBe("abc123publickey");
        });

        it("should return Warning when local backup private key is missing", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(null);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const localKeyCheck = result.checks.find((c) => c.id === "local-private-key-exists");
            expect(localKeyCheck!.severity).toBe(DiagnosticSeverity.Warning);
            expect(result.localBackup.privateKeyAvailable).toBe(false);
        });

        it("should return OK when local backup private key is available", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: true,
                matchesDecryptionKey: true,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const localKeyCheck = result.checks.find((c) => c.id === "local-private-key-exists");
            expect(localKeyCheck!.severity).toBe(DiagnosticSeverity.OK);
            expect(result.localBackup.privateKeyAvailable).toBe(true);
        });

        it("should return OK and matchesServerKey=true when local key matches server key", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: true,
                matchesDecryptionKey: true,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const matchCheck = result.checks.find((c) => c.id === "keys-match");
            expect(matchCheck!.severity).toBe(DiagnosticSeverity.OK);
            expect(result.localBackup.matchesServerKey).toBe(true);
        });

        it("should return Error and matchesServerKey=false when local key does not match server key (critical case)", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: false,
                matchesDecryptionKey: false,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const matchCheck = result.checks.find((c) => c.id === "keys-match");
            expect(matchCheck!.severity).toBe(DiagnosticSeverity.Error);
            expect(result.localBackup.matchesServerKey).toBe(false);
            // The mismatch is the critical inconsistency case — overall severity should be Error
            expect(result.overallSeverity).toBe(DiagnosticSeverity.Error);
        });

        it("should return Error when isKeyBackupTrusted throws during key match check", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockRejectedValue(new Error("crypto failure"));

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const matchCheck = result.checks.find((c) => c.id === "keys-match");
            expect(matchCheck!.severity).toBe(DiagnosticSeverity.Error);
            expect(result.localBackup.matchesServerKey).toBeNull();
        });

        it("should return Unknown for key match check when algorithm is unsupported", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(UNSUPPORTED_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const matchCheck = result.checks.find((c) => c.id === "keys-match");
            expect(matchCheck!.severity).toBe(DiagnosticSeverity.Unknown);
        });

        it("should compute overallSeverity as the worst severity across all checks", async () => {
            // Setup: backup exists (OK), algorithm OK, public key present (OK), local key missing (Warning)
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(null);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            // One Warning check (local key missing) should make overall Warning
            expect(result.overallSeverity).toBe(DiagnosticSeverity.Warning);
        });

        it("should return OK overall when all checks pass", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: true,
                matchesDecryptionKey: true,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            expect(result.overallSeverity).toBe(DiagnosticSeverity.OK);
        });

        it("should include a timestamp in the result", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);
            const before = Date.now();

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const after = Date.now();
            expect(result.timestamp).toBeGreaterThanOrEqual(before);
            expect(result.timestamp).toBeLessThanOrEqual(after);
        });

        it("should not include keys-match check when no server backup exists", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            const matchCheck = result.checks.find((c) => c.id === "keys-match");
            // No match check when there is no server backup to compare against
            expect(matchCheck).toBeUndefined();
        });

        it("should not expose publicKey in serverBackup when public key is absent", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(NO_PUBLIC_KEY_BACKUP_INFO);

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);

            expect(result.serverBackup.publicKey).toBeUndefined();
        });
    });

    describe("buildSanitizedDiagnosticSummary", () => {
        it("should contain expected metadata in the summary", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: true,
                matchesDecryptionKey: true,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);
            const summary = buildSanitizedDiagnosticSummary(result, translateDiagnosticMessage);

            expect(summary).toContain("Version: 3");
            expect(summary).toContain("m.megolm_backup.v1.curve25519-aes-sha2");
            expect(summary).toContain("Matches Server Key: Yes");
            expect(summary).toContain("Overall Status: OK");
        });

        it("should NOT expose any private key material in the sanitized summary", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: true,
                matchesDecryptionKey: true,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);
            const summary = buildSanitizedDiagnosticSummary(result, translateDiagnosticMessage);

            // The summary must never include the raw private key bytes or recovery keys
            // The Uint8Array(32) is all zeros — check that raw numeric values from the key are not present
            expect(summary).not.toContain("0,0,0,0");
            // No access token
            expect(summary).not.toContain("access_token");
            // No secret storage material marker
            expect(summary).not.toContain("secret_storage");
        });

        it("should indicate key mismatch in the sanitized summary when keys do not match", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(MOCK_BACKUP_INFO);
            jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
                trusted: false,
                matchesDecryptionKey: false,
            });

            const result = await computeKeyBackupDiagnostics(matrixClient.getCrypto()!);
            const summary = buildSanitizedDiagnosticSummary(result, translateDiagnosticMessage);

            expect(summary).toContain("Matches Server Key: No");
            expect(summary).toContain("Overall Status: ERROR");
        });
    });
});
