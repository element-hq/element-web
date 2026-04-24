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

    it("renders the dialog when section is not empty", () => {
        const { container } = render(<RemoveSectionDialog onFinished={onFinished} isEmpty={false} />);
        expect(container).toMatchSnapshot();
        expect(
            screen.getByText("The chats in this section will still be available in your chats list."),
        ).toBeInTheDocument();
    });

    it("renders the dialog when section is empty", () => {
        const { container } = render(<RemoveSectionDialog onFinished={onFinished} isEmpty={true} />);
        expect(container).toMatchSnapshot();
        expect(
            screen.queryByText("The chats in this section will still be available in your chats list."),
        ).not.toBeInTheDocument();
    });

    it("calls onFinished with true when remove section is clicked", async () => {
        render(<RemoveSectionDialog onFinished={onFinished} isEmpty={false} />);
        await userEvent.click(screen.getByRole("button", { name: "Remove section" }));
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("calls onFinished with false when the dialog is cancelled", async () => {
        render(<RemoveSectionDialog onFinished={onFinished} isEmpty={false} />);
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
