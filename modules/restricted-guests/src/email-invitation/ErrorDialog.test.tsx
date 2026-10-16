/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ErrorDialog } from "./ErrorDialog";
import { mockApi } from "../tests/mockApi";

const lines = ["An error occurred when attempting to send the invite.", "Please try again."];

describe("ErrorDialog", () => {
    it("renders the lines", () => {
        const { container } = render(<ErrorDialog api={mockApi} lines={lines} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(container).toMatchSnapshot();
    });

    it("closes with the OK button", async () => {
        const onSubmit = vi.fn();
        render(<ErrorDialog api={mockApi} lines={lines} onSubmit={onSubmit} onCancel={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: "OK" }));
        expect(onSubmit).toHaveBeenCalled();
    });
});
