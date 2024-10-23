/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { createCrossSigning } from "../../../../../src/CreateCrossSigning";
import CreateCrossSigningDialog from "../../../../../src/components/views/dialogs/security/CreateCrossSigningDialog";
import { createTestClient } from "../../../../test-utils";

jest.mock("../../../../../src/CreateCrossSigning", () => ({
    createCrossSigning: jest.fn(),
}));

describe("CreateCrossSigningDialog", () => {
    let client: MatrixClient;
    let createCrossSigningResolve: () => void;
    let createCrossSigningReject: (e: Error) => void;

    beforeEach(() => {
        client = createTestClient();
        mocked(createCrossSigning).mockImplementation(() => {
            return new Promise((resolve, reject) => {
                createCrossSigningResolve = resolve;
                createCrossSigningReject = reject;
            });
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("should call createCrossSigning and show a spinner while it runs", async () => {
        const onFinished = jest.fn();

        render(
            <CreateCrossSigningDialog
                matrixClient={client}
                accountPassword="hunter2"
                tokenLogin={false}
                onFinished={onFinished}
            />,
        );

        expect(createCrossSigning).toHaveBeenCalledWith(client, false, "hunter2");
        expect(screen.getByTestId("spinner")).toBeInTheDocument();

        createCrossSigningResolve!();

        await waitFor(() => expect(onFinished).toHaveBeenCalledWith(true));
    });

    it("should display an error if createCrossSigning fails", async () => {
        render(
            <CreateCrossSigningDialog
                matrixClient={client}
                accountPassword="hunter2"
                tokenLogin={false}
                onFinished={jest.fn()}
            />,
        );

        createCrossSigningReject!(new Error("generic error message"));

        await expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("ignores failures when tokenLogin is true", async () => {
        const onFinished = jest.fn();

        render(
            <CreateCrossSigningDialog
                matrixClient={client}
                accountPassword="hunter2"
                tokenLogin={true}
                onFinished={onFinished}
            />,
        );

        createCrossSigningReject!(new Error("generic error message"));

        await waitFor(() => expect(onFinished).toHaveBeenCalledWith(false));
    });

    it("cancels the dialog when the cancel button is clicked", async () => {
        const onFinished = jest.fn();

        render(
            <CreateCrossSigningDialog
                matrixClient={client}
                accountPassword="hunter2"
                tokenLogin={false}
                onFinished={onFinished}
            />,
        );

        createCrossSigningReject!(new Error("generic error message"));

        const cancelButton = await screen.findByRole("button", { name: "Cancel" });
        cancelButton.click();

        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("should retry when the retry button is clicked", async () => {
        render(
            <CreateCrossSigningDialog
                matrixClient={client}
                accountPassword="hunter2"
                tokenLogin={false}
                onFinished={jest.fn()}
            />,
        );

        createCrossSigningReject!(new Error("generic error message"));

        const retryButton = await screen.findByRole("button", { name: "Retry" });
        retryButton.click();

        expect(createCrossSigning).toHaveBeenCalledTimes(2);
    });
});
