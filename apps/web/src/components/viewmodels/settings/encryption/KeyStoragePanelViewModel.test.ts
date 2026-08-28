/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "test-utils-rtl";
import { act } from "react";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { BackupTrustInfo, KeyBackupCheck, KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { useKeyStoragePanelViewModel } from "./KeyStoragePanelViewModel";

describe("KeyStoragePanelViewModel", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should update the pending value immediately", async () => {
        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );
        act(() => {
            result.current.setEnabled(true);
        });
        expect(result.current.isEnabled).toBe(true);
        expect(result.current.busy).toBe(true);
    });

    it("should update if a KeyBackupStatus event is received", async () => {
        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );
        await waitFor(() => expect(result.current.isEnabled).toBe(false));

        const mock = vi.mocked(matrixClient.getCrypto()!.getActiveSessionBackupVersion);
        mock.mockResolvedValue("1");
        matrixClient.emit(CryptoEvent.KeyBackupStatus, true);
        await waitFor(() => expect(result.current.isEnabled).toBe(true));

        mock.mockResolvedValue(null);
        matrixClient.emit(CryptoEvent.KeyBackupStatus, false);
        await waitFor(() => expect(result.current.isEnabled).toBe(false));
    });

    it("should call resetKeyBackup if there is no backup currently", async () => {
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue(null);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(vi.mocked(matrixClient.getCrypto()!.resetKeyBackup)).toHaveBeenCalled();
    });

    it.each<BackupTrustInfo>([
        { trusted: true, matchesDecryptionKey: false },
        { trusted: false, matchesDecryptionKey: true },
        { trusted: true, matchesDecryptionKey: true },
    ])("should not call resetKeyBackup if there is a backup currently and it is trusted", async (trustInfo) => {
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue({
            backupInfo: {
                version: "1",
                algorithm: "foobar",
                auth_data: {
                    public_key: "foobar",
                },
                count: 0,
                etag: "",
            },
            trustInfo,
        });

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(vi.mocked(matrixClient.getCrypto()!.resetKeyBackup)).not.toHaveBeenCalled();
    });

    it("should call resetKeyBackup if there is a backup currently but it is not trusted", async () => {
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue({
            backupInfo: {
                version: "1",
                algorithm: "foobar",
                auth_data: {
                    public_key: "foobar",
                },
                count: 0,
                etag: "",
            },
            trustInfo: {
                trusted: false,
                matchesDecryptionKey: false,
            },
        });

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(vi.mocked(matrixClient.getCrypto()!.resetKeyBackup)).toHaveBeenCalled();
    });

    it("should set account data flag when enabling", async () => {
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue(null);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(vi.mocked(matrixClient.setAccountData)).toHaveBeenCalledWith("m.org.matrix.custom.backup_disabled", {
            disabled: false,
        });

        expect(vi.mocked(matrixClient.setAccountData)).toHaveBeenCalledWith("m.key_backup", {
            enabled: true,
        });
    });

    it("should delete key storage when disabling", async () => {
        vi.mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue({} as KeyBackupCheck);
        vi.mocked(matrixClient.getCrypto()!.getKeyBackupInfo).mockResolvedValue({ version: "99" } as KeyBackupInfo);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(false);

        expect(vi.mocked(matrixClient.getCrypto()!.disableKeyStorage)).toHaveBeenCalled();
        expect(vi.mocked(matrixClient.setAccountData)).toHaveBeenCalledWith("m.org.matrix.custom.backup_disabled", {
            disabled: true,
        });
        expect(vi.mocked(matrixClient.setAccountData)).toHaveBeenCalledWith("m.key_backup", {
            enabled: false,
        });
    });
});
