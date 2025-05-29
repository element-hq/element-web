/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { ResetIdentityPanel } from "../../../../../../src/components/views/settings/encryption/ResetIdentityPanel";
import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";

describe("<ResetIdentityPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    it("should reset the encryption when the continue button is clicked", async () => {
        const user = userEvent.setup();

        const onReset = jest.fn();
        const { asFragment } = render(
            <ResetIdentityPanel variant="compromised" onReset={onReset} onCancelClick={jest.fn()} />,
            withClientContextRenderOptions(matrixClient),
        );
        expect(asFragment()).toMatchSnapshot();

        // We need to pause the reset so that we can check that it's providing
        // feedback to the user that something is happening.
        const { promise: resetEncryptionPromise, resolve: resolveResetEncryption } = Promise.withResolvers<void>();
        jest.spyOn(matrixClient.getCrypto()!, "resetEncryption").mockReturnValue(resetEncryptionPromise);

        const continueButton = screen.getByRole("button", { name: "Continue" });
        await user.click(continueButton);
        expect(asFragment()).toMatchSnapshot();
        resolveResetEncryption!();
        await sleep(0);

        expect(matrixClient.getCrypto()!.resetEncryption).toHaveBeenCalled();
        expect(onReset).toHaveBeenCalled();
    });

    it("should display the 'forgot recovery key' variant correctly", async () => {
        const onReset = jest.fn();
        const { asFragment } = render(
            <ResetIdentityPanel variant="forgot" onReset={onReset} onCancelClick={jest.fn()} />,
            withClientContextRenderOptions(matrixClient),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the 'sync failed' variant correctly", async () => {
        const onReset = jest.fn();
        const { asFragment } = render(
            <ResetIdentityPanel variant="sync_failed" onReset={onReset} onCancelClick={jest.fn()} />,
            withClientContextRenderOptions(matrixClient),
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
