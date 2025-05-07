/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { defer } from "matrix-js-sdk/src/utils";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { DeleteKeyStoragePanel } from "../../../../../../src/components/views/settings/encryption/DeleteKeyStoragePanel";
import { useKeyStoragePanelViewModel } from "../../../../../../src/components/viewmodels/settings/encryption/KeyStoragePanelViewModel";

jest.mock("../../../../../../src/components/viewmodels/settings/encryption/KeyStoragePanelViewModel", () => ({
    useKeyStoragePanelViewModel: jest
        .fn()
        .mockReturnValue({ setEnabled: jest.fn(), isEnabled: true, loading: false, busy: false }),
}));

describe("<DeleteKeyStoragePanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

        const onFinish = jest.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onFinish).toHaveBeenCalled();
    });

    it("should call disable key storage when confirm pressed", async () => {
        const setEnabled = jest.fn();

        mocked(useKeyStoragePanelViewModel).mockReturnValue({
            setEnabled,
            isEnabled: true,
            loading: false,
            busy: false,
        });

        const user = userEvent.setup();

        const onFinish = jest.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Delete key storage" }));

        expect(setEnabled).toHaveBeenCalledWith(false);
    });

    it("should wait with button disabled while setEnabled runs", async () => {
        const setEnabledDefer = defer();

        mocked(useKeyStoragePanelViewModel).mockReturnValue({
            setEnabled: jest.fn().mockReturnValue(setEnabledDefer.promise),
            isEnabled: true,
            loading: false,
            busy: false,
        });

        const user = userEvent.setup();

        const onFinish = jest.fn();
        render(<DeleteKeyStoragePanel onFinish={onFinish} />, withClientContextRenderOptions(matrixClient));

        await user.click(screen.getByRole("button", { name: "Delete key storage" }));

        expect(onFinish).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Delete key storage" })).toHaveAttribute("aria-disabled", "true");
        setEnabledDefer.resolve();
        await waitFor(() => expect(onFinish).toHaveBeenCalled());
    });
});
