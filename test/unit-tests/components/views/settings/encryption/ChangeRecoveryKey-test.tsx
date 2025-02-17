/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import { ChangeRecoveryKey } from "../../../../../../src/components/views/settings/encryption/ChangeRecoveryKey";
import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { copyPlaintext } from "../../../../../../src/utils/strings";

jest.mock("../../../../../../src/utils/strings", () => ({
    copyPlaintext: jest.fn(),
}));

afterEach(() => {
    jest.restoreAllMocks();
});

describe("<ChangeRecoveryKey />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    function renderComponent(userHasRecoveryKey = true, onFinish = jest.fn(), onCancelClick = jest.fn()) {
        return render(
            <ChangeRecoveryKey
                userHasRecoveryKey={userHasRecoveryKey}
                onFinish={onFinish}
                onCancelClick={onCancelClick}
            />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    describe("flow to set up a recovery key", () => {
        it("should display information about the recovery key", async () => {
            const user = userEvent.setup();

            const onCancelClick = jest.fn();
            const { asFragment } = renderComponent(false, jest.fn(), onCancelClick);
            await waitFor(() =>
                expect(
                    screen.getByText(
                        "Your key storage is protected by a recovery key. If you need a new recovery key after setup, you can recreate it by selecting ‘Change recovery key’.",
                    ),
                ).toBeInTheDocument(),
            );
            expect(asFragment()).toMatchSnapshot();

            await user.click(screen.getByRole("button", { name: "Cancel" }));
            expect(onCancelClick).toHaveBeenCalled();
        });

        it("should display the recovery key", async () => {
            const user = userEvent.setup();

            const onCancelClick = jest.fn();
            const { asFragment } = renderComponent(false, jest.fn(), onCancelClick);
            await waitFor(() => user.click(screen.getByRole("button", { name: "Continue" })));

            expect(screen.getByText("Save your recovery key somewhere safe")).toBeInTheDocument();
            expect(screen.getByText("encoded private key")).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();

            // Test copy button
            await user.click(screen.getByRole("button", { name: "Copy" }));
            expect(copyPlaintext).toHaveBeenCalled();

            await user.click(screen.getByRole("button", { name: "Cancel" }));
            expect(onCancelClick).toHaveBeenCalled();
        });

        it("should ask the user to enter the recovery key", async () => {
            const user = userEvent.setup();

            const onFinish = jest.fn();
            const { asFragment } = renderComponent(false, onFinish);
            // Display the recovery key to save
            await waitFor(() => user.click(screen.getByRole("button", { name: "Continue" })));
            // Display the form to confirm the recovery key
            await waitFor(() => user.click(screen.getByRole("button", { name: "Continue" })));

            await waitFor(() => expect(screen.getByText("Enter your recovery key to confirm")).toBeInTheDocument());
            expect(asFragment()).toMatchSnapshot();

            // The finish button should be disabled by default
            const finishButton = screen.getByRole("button", { name: "Finish set up" });
            expect(finishButton).toHaveAttribute("aria-disabled", "true");

            const input = screen.getByRole("textbox");
            // If the user enters an incorrect recovery key, the finish button should be disabled
            // and we display an error message
            await userEvent.type(input, "wrong recovery key");
            expect(finishButton).toHaveAttribute("aria-disabled", "true");
            expect(screen.getByText("The recovery key you entered is not correct.")).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();

            await userEvent.clear(input);
            // If the user enters the correct recovery key, the finish button should be enabled
            await userEvent.type(input, "encoded private key");
            await waitFor(() => expect(finishButton).not.toHaveAttribute("aria-disabled", "true"));

            await user.click(finishButton);
            expect(onFinish).toHaveBeenCalledWith();
        });

        it("should display errors from bootstrapSecretStorage", async () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockReturnValue(undefined);
            mocked(matrixClient.getCrypto()!).bootstrapSecretStorage.mockRejectedValue(new Error("can't bootstrap"));

            const user = userEvent.setup();
            renderComponent(false);

            // Display the recovery key to save
            await waitFor(() => user.click(screen.getByRole("button", { name: "Continue" })));
            // Display the form to confirm the recovery key
            await waitFor(() => user.click(screen.getByRole("button", { name: "Continue" })));

            await waitFor(() => expect(screen.getByText("Enter your recovery key to confirm")).toBeInTheDocument());

            const finishButton = screen.getByRole("button", { name: "Finish set up" });
            const input = screen.getByRole("textbox");
            await userEvent.type(input, "encoded private key");
            await user.click(finishButton);

            await screen.findByText("Failed to set up secret storage");
            await screen.findByText("Error: can't bootstrap");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to set up secret storage:",
                new Error("can't bootstrap"),
            );
        });
    });

    describe("flow to change the recovery key", () => {
        it("should display the recovery key", async () => {
            const { asFragment } = renderComponent();

            await waitFor(() => expect(screen.getByText("Change recovery key?")).toBeInTheDocument());
            expect(screen.getByText("encoded private key")).toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
