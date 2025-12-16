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
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { RecoveryPanelOutOfSync } from "../../../../../../src/components/views/settings/encryption/RecoveryPanelOutOfSync";
import { accessSecretStorage } from "../../../../../../src/SecurityManager";
import DeviceListener from "../../../../../../src/DeviceListener";
import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";

jest.mock("../../../../../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("<RecoveyPanelOutOfSync />", () => {
    let matrixClient: MatrixClient;

    function renderComponent(onFinish = jest.fn(), onForgotRecoveryKey = jest.fn()) {
        matrixClient = createTestClient();
        return render(
            <RecoveryPanelOutOfSync onFinish={onFinish} onForgotRecoveryKey={onForgotRecoveryKey} />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    afterEach(() => {
        jest.clearAllMocks();
    });

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
        jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(false);

        const user = userEvent.setup();
        mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            return await func();
        });

        const onFinish = jest.fn();
        renderComponent(onFinish);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();

        expect(matrixClient.getCrypto()!.resetKeyBackup).not.toHaveBeenCalled();
    });

    it("should reset key backup if needed", async () => {
        jest.spyOn(DeviceListener.sharedInstance(), "keyStorageOutOfSyncNeedsBackupReset").mockResolvedValue(true);

        const user = userEvent.setup();
        mocked(accessSecretStorage).mockImplementation(async (func = async (): Promise<void> => {}) => {
            return await func();
        });

        const onFinish = jest.fn();
        renderComponent(onFinish);

        await user.click(screen.getByRole("button", { name: "Enter recovery key" }));
        expect(accessSecretStorage).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();

        expect(matrixClient.getCrypto()!.resetKeyBackup).toHaveBeenCalled();
    });
});
