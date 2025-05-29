/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { RecoveryPanel } from "../../../../../../src/components/views/settings/encryption/RecoveryPanel";

describe("<RecoveryPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    function renderRecoverPanel(onChangeRecoveryKeyClick = jest.fn()) {
        return render(
            <RecoveryPanel onChangeRecoveryKeyClick={onChangeRecoveryKeyClick} />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    it("should be in loading state when checking the recovery key and the cached keys", () => {
        jest.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockImplementation(() => new Promise(() => {}));

        const { asFragment } = renderRecoverPanel();
        expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should ask to set up a recovery key when there is no recovery key", async () => {
        const user = userEvent.setup();

        const onChangeRecoveryKeyClick = jest.fn();
        const { asFragment } = renderRecoverPanel(onChangeRecoveryKeyClick);

        await waitFor(() => screen.getByRole("button", { name: "Set up recovery" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Set up recovery" }));
        expect(onChangeRecoveryKeyClick).toHaveBeenCalledWith(true);
    });

    it("should allow to change the recovery key when everything is good", async () => {
        jest.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue("default key");
        jest.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });
        const user = userEvent.setup();

        const onChangeRecoveryKeyClick = jest.fn();
        const { asFragment } = renderRecoverPanel(onChangeRecoveryKeyClick);
        await waitFor(() => screen.getByRole("button", { name: "Change recovery key" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Change recovery key" }));
        expect(onChangeRecoveryKeyClick).toHaveBeenCalledWith(false);
    });
});
