/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmailInvitationSuccessDialog } from "./EmailInvitationSuccessDialog";
import { mockApi } from "../../tests/mockApi";

const renderDialog = (onCancel = vi.fn()): RenderResult =>
    render(
        <EmailInvitationSuccessDialog
            api={mockApi}
            emails={["alice@example.com", "bob@example.com"]}
            onSubmit={vi.fn()}
            onCancel={onCancel}
        />,
    );

describe("EmailInvitationSuccessDialog", () => {
    it("renders the invited emails", () => {
        const { container } = renderDialog();
        expect(container).toMatchSnapshot();
    });

    it("closes with the done button", async () => {
        const onCancel = vi.fn();
        renderDialog(onCancel);

        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(onCancel).toHaveBeenCalled();
    });
});
