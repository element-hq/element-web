/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { vi, describe, test, beforeEach, afterEach, expect } from "vitest";
import { render, screen, act } from "test-utils-rtl";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createTestClient } from "test-utils";

import NewRecoveryMethodDialog from "./NewRecoveryMethodDialog";
import MatrixClientContext from "../../../../contexts/MatrixClientContext.tsx";
import dis from "../../../../dispatcher/dispatcher.ts";
import { Action } from "../../../../dispatcher/actions.ts";
import Modal from "../../../../Modal.tsx";

describe("<NewRecoveryMethodDialog />", () => {
    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = createTestClient();
        vi.spyOn(dis, "fire");
        vi.spyOn(Modal, "createDialog");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderComponent(onFinished: () => void = vi.fn()) {
        return render(
            <MatrixClientContext.Provider value={matrixClient}>
                <NewRecoveryMethodDialog onFinished={onFinished} />
            </MatrixClientContext.Provider>,
        );
    }

    test("when cancel is clicked", async () => {
        const onFinished = vi.fn();
        act(() => {
            renderComponent(onFinished);
        });

        await userEvent.click(screen.getByRole("button", { name: "Go to Settings" }));
        expect(onFinished).toHaveBeenCalled();
        expect(dis.fire).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    test("when key backup is enabled", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("version");

        const onFinished = vi.fn();

        const { asFragment } = renderComponent(onFinished);
        await waitFor(() =>
            expect(
                screen.getByText("This device is encrypting history using the new recovery method."),
            ).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        expect(onFinished).toHaveBeenCalled();
    });

    test("when key backup is disabled", async () => {
        const onFinished = vi.fn();

        const { asFragment } = renderComponent(onFinished);
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        await waitFor(() => expect(Modal.createDialog).toHaveBeenCalled());
    });
});
