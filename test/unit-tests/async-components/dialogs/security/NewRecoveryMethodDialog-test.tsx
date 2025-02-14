/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, act } from "jest-matrix-react";
import { waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import NewRecoveryMethodDialog from "../../../../../src/async-components/views/dialogs/security/NewRecoveryMethodDialog";
import { createTestClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext.tsx";
import dis from "../../../../../src/dispatcher/dispatcher.ts";
import { Action } from "../../../../../src/dispatcher/actions.ts";
import Modal from "../../../../../src/Modal.tsx";

describe("<NewRecoveryMethodDialog />", () => {
    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = createTestClient();
        jest.spyOn(dis, "fire");
        jest.spyOn(Modal, "createDialog");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent(onFinished: () => void = jest.fn()) {
        return render(
            <MatrixClientContext.Provider value={matrixClient}>
                <NewRecoveryMethodDialog onFinished={onFinished} />
            </MatrixClientContext.Provider>,
        );
    }

    test("when cancel is clicked", async () => {
        const onFinished = jest.fn();
        act(() => {
            renderComponent(onFinished);
        });

        await userEvent.click(screen.getByRole("button", { name: "Go to Settings" }));
        expect(onFinished).toHaveBeenCalled();
        expect(dis.fire).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    test("when key backup is enabled", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("version");

        const onFinished = jest.fn();

        const { asFragment } = renderComponent(onFinished);
        await waitFor(() =>
            expect(
                screen.getByText("This session is encrypting history using the new recovery method."),
            ).toBeInTheDocument(),
        );
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        expect(onFinished).toHaveBeenCalled();
    });

    test("when key backup is disabled", async () => {
        const onFinished = jest.fn();

        const { asFragment } = renderComponent(onFinished);
        expect(asFragment()).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "Set up Secure Messages" }));
        await waitFor(() => expect(Modal.createDialog).toHaveBeenCalled());
    });
});
