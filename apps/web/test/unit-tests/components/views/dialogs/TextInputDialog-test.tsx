/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import TextInputDialog from "../../../../../src/components/views/dialogs/TextInputDialog";

describe("TextInputDialog", () => {
    const defaultProps = {
        title: "Test title",
        description: "Test description",
        value: "",
        button: "OK",
        focus: false,
        hasCancel: true,
        onFinished: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders title and description", () => {
        render(<TextInputDialog {...defaultProps} />);

        expect(screen.getByText("Test title")).toBeInTheDocument();
        expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("renders a field with the given placeholder", () => {
        render(<TextInputDialog {...defaultProps} placeholder="Enter value" />);

        expect(screen.getByLabelText("Enter value")).toBeInTheDocument();
    });

    it("renders the primary button with the given button text", () => {
        render(<TextInputDialog {...defaultProps} button="Submit" />);

        expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("applies primaryButtonClass to the primary button", () => {
        render(<TextInputDialog {...defaultProps} primaryButtonClass="danger" />);

        const primaryButton = screen.getByTestId("dialog-primary-button");
        expect(primaryButton).toHaveClass("mx_Dialog_primary");
        expect(primaryButton).toHaveClass("danger");
    });

    it("does not add extra class when primaryButtonClass is not provided", () => {
        render(<TextInputDialog {...defaultProps} />);

        const primaryButton = screen.getByTestId("dialog-primary-button");
        expect(primaryButton).toHaveClass("mx_Dialog_primary");
        expect(primaryButton).not.toHaveClass("danger");
    });

    it("calls onFinished(true, text) when the primary button is clicked", async () => {
        const onFinished = jest.fn();
        render(<TextInputDialog {...defaultProps} onFinished={onFinished} />);

        const input = screen.getByRole("textbox");
        await userEvent.type(input, "hello");

        const primaryButton = screen.getByTestId("dialog-primary-button");
        await userEvent.click(primaryButton);

        expect(onFinished).toHaveBeenCalledWith(true, "hello");
    });

    it("calls onFinished(false) when cancel is clicked", async () => {
        const onFinished = jest.fn();
        render(<TextInputDialog {...defaultProps} onFinished={onFinished} />);

        const cancelButton = screen.getByTestId("dialog-cancel-button");
        await userEvent.click(cancelButton);

        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("renders a cancel button when hasCancel is true", () => {
        render(<TextInputDialog {...defaultProps} hasCancel={true} />);

        expect(screen.getByTestId("dialog-cancel-button")).toBeInTheDocument();
    });

    it("does not render a cancel button when hasCancel is false", () => {
        render(<TextInputDialog {...defaultProps} hasCancel={false} />);

        expect(screen.queryByTestId("dialog-cancel-button")).not.toBeInTheDocument();
    });
});
