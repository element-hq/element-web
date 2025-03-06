/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";
import { act } from "react";
import { mocked } from "jest-mock";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { KeyBackupCheck, KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { useKeyStoragePanelViewModel } from "../../../../../../src/components/viewmodels/settings/encryption/KeyStoragePanelViewModel";
import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";

describe("KeyStoragePanelViewModel", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

    it("should call resetKeyBackup if there is no backup currently", async () => {
        mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue(null);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(mocked(matrixClient.getCrypto()!.resetKeyBackup)).toHaveBeenCalled();
    });

    it("should not call resetKeyBackup if there is a backup currently", async () => {
        mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue({} as KeyBackupCheck);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(mocked(matrixClient.getCrypto()!.resetKeyBackup)).not.toHaveBeenCalled();
    });

    it("should set account data flag when enabling", async () => {
        mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue(null);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(true);
        expect(mocked(matrixClient.setAccountData)).toHaveBeenCalledWith("m.org.matrix.custom.backup_disabled", {
            disabled: false,
        });
    });

    it("should delete key storage when disabling", async () => {
        mocked(matrixClient.getCrypto()!.checkKeyBackupAndEnable).mockResolvedValue({} as KeyBackupCheck);
        mocked(matrixClient.getCrypto()!.getKeyBackupInfo).mockResolvedValue({ version: "99" } as KeyBackupInfo);

        const { result } = renderHook(
            () => useKeyStoragePanelViewModel(),
            withClientContextRenderOptions(matrixClient),
        );

        await result.current.setEnabled(false);

        expect(mocked(matrixClient.getCrypto()!.disableKeyStorage)).toHaveBeenCalled();
    });
});
