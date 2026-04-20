/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { CreateSectionDialog } from "../../../../../src/components/views/dialogs/CreateSectionDialog";

describe("CreateSectionDialog", () => {
    const onFinished: jest.Mock = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
    });

    function renderComponent(): void {
        render(<CreateSectionDialog onFinished={onFinished} />);
    }

    it("renders the dialog", () => {
        const { container } = render(<CreateSectionDialog onFinished={onFinished} />);
        expect(container).toMatchSnapshot();
    });

    it("has the create section button disabled when the input is empty", () => {
        renderComponent();
        const createButton = screen.getByRole("button", { name: "Create section" });
        expect(createButton).toBeDisabled();
    });

    it("calls onFinished with true and the section name when create section is clicked", async () => {
        renderComponent();
        const input = screen.getByRole("textbox");
        await userEvent.type(input, "My section");
        const createButton = screen.getByRole("button", { name: "Create section" });
        await userEvent.click(createButton);
        expect(onFinished).toHaveBeenCalledWith(true, "My section");
    });

    it("calls onFinished with false when the dialog is cancelled", async () => {
        renderComponent();
        const cancelButton = screen.getByRole("button", { name: "Cancel" });
        await userEvent.click(cancelButton);
        expect(onFinished).toHaveBeenCalledWith(false, "");
    });

    it("calls onFinished with true and the section name when the form is submitted", async () => {
        renderComponent();
        const input = screen.getByRole("textbox");
        await userEvent.type(input, "My section");
        await userEvent.keyboard("{Enter}");
        expect(onFinished).toHaveBeenCalledWith(true, "My section");
    });
});
