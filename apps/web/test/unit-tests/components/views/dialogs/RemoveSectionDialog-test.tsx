/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { RemoveSectionDialog } from "../../../../../src/components/views/dialogs/RemoveSectionDialog";

describe("RemoveSectionDialog", () => {
    const onFinished: jest.Mock = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
    });

    function renderComponent(): void {
        render(<RemoveSectionDialog onFinished={onFinished} />);
    }

    it("renders the dialog", () => {
        const { container } = render(<RemoveSectionDialog onFinished={onFinished} />);
        expect(container).toMatchSnapshot();
    });

    it("calls onFinished with true when remove section is clicked", async () => {
        renderComponent();
        await userEvent.click(screen.getByRole("button", { name: "Remove section" }));
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("calls onFinished with false when the dialog is cancelled", async () => {
        renderComponent();
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
