/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import { RecoveryPanelOutOfSync } from "../../../../../../src/components/views/settings/encryption/RecoveryPanelOutOfSync";
import { accessSecretStorage } from "../../../../../../src/SecurityManager";

jest.mock("../../../../../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("<RecoveyPanelOutOfSync />", () => {
    function renderComponent(onFinish = jest.fn(), onForgotRecoveryKey = jest.fn()) {
        return render(<RecoveryPanelOutOfSync onFinish={onFinish} onForgotRecoveryKey={onForgotRecoveryKey} />);
    }

    it("should render", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should call onForgotRecoveryKey when the 'Forgot recovery key?' is clicked", async () => {
        const user = userEvent.setup();

        const onForgotRecoveryKey = jest.fn();
        renderComponent(jest.fn(), onForgotRecoveryKey);

        await user.click(screen.getByRole("button", { name: "Forgot recovery key?" }));
        expect(onForgotRecoveryKey).toHaveBeenCalled();
    });

    it("should access to 4S and call onFinish when 'Enter recovery key' is clicked", async () => {
        const user = userEvent.setup();
        mocked(accessSecretStorage).mockClear().mockResolvedValue();

        const onFinish = jest.fn();
        renderComponent(onFinish);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();
    });
});
