/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { createTestClient, flushPromises } from "test-utils";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { DeleteKeyStorageViewModel } from "./DeleteKeyStorageViewModel";

describe("DeleteKeyStorageViewModel", () => {
    let matrixClient: MatrixClient;
    let onFinished: Mock<() => void>;

    beforeEach(() => {
        matrixClient = createTestClient();
        onFinished = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts idle", () => {
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        expect(vm.getSnapshot()).toEqual({ busy: false, failed: false });
    });

    it("stays busy until key storage is deleted, then finishes", async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        vi.mocked(matrixClient.getCrypto()!.disableKeyStorage).mockReturnValue(promise);
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        const confirmed = vm.confirm();
        expect(vm.getSnapshot().busy).toBe(true);
        expect(onFinished).not.toHaveBeenCalled();

        resolve();
        await confirmed;

        expect(matrixClient.setAccountData).toHaveBeenCalledWith("m.key_backup", { enabled: false });
        expect(matrixClient.setAccountData).toHaveBeenCalledWith("m.org.matrix.custom.backup_disabled", {
            disabled: true,
        });
        // Not busy any more, so the dialog's close guard lets it close
        expect(vm.getSnapshot().busy).toBe(false);
        expect(onFinished).toHaveBeenCalled();
    });

    it("fails without finishing if there is no crypto module", async () => {
        vi.spyOn(matrixClient, "getCrypto").mockReturnValue(undefined);
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        await vm.confirm();

        expect(vm.getSnapshot()).toEqual({ busy: false, failed: true });
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("ignores cancel and a second confirm while busy", async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        const disable = vi.mocked(matrixClient.getCrypto()!.disableKeyStorage).mockReturnValue(promise);
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        const confirmed = vm.confirm();
        vm.cancel();
        await vm.confirm();
        await flushPromises();
        expect(onFinished).not.toHaveBeenCalled();
        expect(disable).toHaveBeenCalledTimes(1);

        resolve();
        await confirmed;
    });

    it("shows the failure and stays open if deleting key storage fails", async () => {
        vi.mocked(matrixClient.getCrypto()!.disableKeyStorage).mockRejectedValue(new Error("boom"));
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        await vm.confirm();

        // Account data is written first, so key storage is still recorded as wanted off
        expect(matrixClient.setAccountData).toHaveBeenCalledWith("m.key_backup", { enabled: false });
        expect(vm.getSnapshot()).toEqual({ busy: false, failed: true });
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("leaves key storage alone if recording the choice fails", async () => {
        vi.mocked(matrixClient.setAccountData).mockRejectedValue(new Error("boom"));
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        await vm.confirm();

        expect(matrixClient.getCrypto()!.disableKeyStorage).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toEqual({ busy: false, failed: true });
    });

    it("finishes without deleting when cancelled", () => {
        const vm = new DeleteKeyStorageViewModel({ matrixClient, onFinished });

        vm.cancel();

        expect(matrixClient.getCrypto()!.disableKeyStorage).not.toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();
    });
});
