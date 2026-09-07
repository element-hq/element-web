/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { DeleteKeyStoragePanel } from "./DeleteKeyStoragePanel";
import { useKeyStoragePanelViewModel } from "../../../viewmodels/settings/encryption/KeyStoragePanelViewModel";

vi.mock("../../../viewmodels/settings/encryption/KeyStoragePanelViewModel", () => ({
    useKeyStoragePanelViewModel: vi
        .fn()
        .mockReturnValue({ setEnabled: vi.fn(), isEnabled: true, loading: false, busy: false }),
}));

describe("<DeleteKeyStoragePanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should match snapshot", async () => {
        const { asFragment } = render(
            <DeleteKeyStoragePanel onFinish={() => {}} />,
            withClientContextRenderOptions(matrixClient),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should call onFinished when cancel pressed", async () => {
        const user = userEvent.setup();

        const onFinish = vi.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onFinish).toHaveBeenCalled();
    });

    it("should call disable key storage when confirm pressed", async () => {
        const setEnabled = vi.fn();

        vi.mocked(useKeyStoragePanelViewModel).mockReturnValue({
            setEnabled,
            isEnabled: true,
            loading: false,
            busy: false,
        });

        const user = userEvent.setup();

        const onFinish = vi.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Delete key storage" }));

        expect(setEnabled).toHaveBeenCalledWith(false);
    });

    it("should wait with button disabled while setEnabled runs", async () => {
        const setEnabledDefer = Promise.withResolvers<void>();

        vi.mocked(useKeyStoragePanelViewModel).mockReturnValue({
            setEnabled: vi.fn().mockReturnValue(setEnabledDefer.promise),
            isEnabled: true,
            loading: false,
            busy: false,
        });

        const user = userEvent.setup();

        const onFinish = vi.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Delete key storage" }));

        expect(onFinish).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Delete key storage" })).toHaveAttribute("aria-disabled", "true");
        setEnabledDefer.resolve();
        await waitFor(() => expect(onFinish).toHaveBeenCalled());
    });
});
