/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen } from "test-utils-rtl";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { RecoveryPanel } from "./RecoveryPanel";

describe("<RecoveryPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    function renderRecoverPanel(onChangeRecoveryKeyClick = vi.fn()) {
        return render(
            <RecoveryPanel onChangeRecoveryKeyClick={onChangeRecoveryKeyClick} />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    it("should be in loading state when checking the recovery key and the cached keys", () => {
        vi.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockImplementation(() => new Promise(() => {}));

        const { asFragment } = renderRecoverPanel();
        expect(screen.getByLabelText("Loading…")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should ask to set up a recovery key when there is no recovery key", async () => {
        const user = userEvent.setup();

        const onChangeRecoveryKeyClick = vi.fn();
        const { asFragment } = renderRecoverPanel(onChangeRecoveryKeyClick);

        await waitFor(() => screen.getByRole("button", { name: "Get recovery key" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Get recovery key" }));
        expect(onChangeRecoveryKeyClick).toHaveBeenCalledWith(true);
    });

    it("should allow to change the recovery key when everything is good", async () => {
        vi.spyOn(matrixClient.secretStorage, "getDefaultKeyId").mockResolvedValue("default key");
        vi.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
            privateKeysInSecretStorage: true,
            publicKeysOnDevice: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        });
        const user = userEvent.setup();

        const onChangeRecoveryKeyClick = vi.fn();
        const { asFragment } = renderRecoverPanel(onChangeRecoveryKeyClick);
        await waitFor(() => screen.getByRole("button", { name: "Change recovery key" }));
        expect(asFragment()).toMatchSnapshot();

        await user.click(screen.getByRole("button", { name: "Change recovery key" }));
        expect(onChangeRecoveryKeyClick).toHaveBeenCalledWith(false);
    });
});
