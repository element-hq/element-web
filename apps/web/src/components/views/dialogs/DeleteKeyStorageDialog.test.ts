/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { createTestClient, flushPromises } from "test-utils";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import Modal from "../../../Modal";
import { openDeleteKeyStorageDialog } from "./DeleteKeyStorageDialog";

describe("openDeleteKeyStorageDialog", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        Modal.forceCloseAllModals();
    });

    async function open(): Promise<HTMLElement> {
        openDeleteKeyStorageDialog(matrixClient);
        return screen.findByRole("dialog");
    }

    it("should stay open and locked until key storage is deleted", async () => {
        const user = userEvent.setup();
        const { promise, resolve } = Promise.withResolvers<void>();
        vi.mocked(matrixClient.getCrypto()!.disableKeyStorage).mockReturnValue(promise);
        const dialog = await open();

        await user.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("aria-disabled", "true"),
        );
        expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");

        await user.keyboard("{Escape}");
        await user.click(document.querySelector(".mx_Dialog_background")!);
        await user.click(screen.getByRole("button", { name: "Close dialog" }));
        await flushPromises();
        expect(dialog).toBeInTheDocument();

        resolve();
        await waitFor(() => expect(dialog).not.toBeInTheDocument());
    });

    it("should close on a background click when idle, without deleting", async () => {
        const user = userEvent.setup();
        const dialog = await open();

        await user.click(document.querySelector(".mx_Dialog_background")!);

        await waitFor(() => expect(dialog).not.toBeInTheDocument());
        expect(matrixClient.getCrypto()!.disableKeyStorage).not.toHaveBeenCalled();
    });

    it("should close without deleting when cancelled", async () => {
        const user = userEvent.setup();
        const dialog = await open();

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(dialog).not.toBeInTheDocument());
        expect(matrixClient.getCrypto()!.disableKeyStorage).not.toHaveBeenCalled();
    });
});
