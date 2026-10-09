/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Room } from "@element-hq/element-web-module-api";

import { EmailInvitationFormDialog } from "./EmailInvitationFormDialog";
import { mockApi } from "../../tests/mockApi";
import { type ModuleConfig } from "../../config";

const renderDialog = (): RenderResult & { onSubmit: () => void; onCancel: () => void } => {
    const room = {
        joinRule: { value: "invite", watch: vi.fn(), unwatch: vi.fn() },
        getPermalink: vi.fn(),
    } as unknown as Room;
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    const result = render(
        <EmailInvitationFormDialog
            api={mockApi}
            room={room}
            config={{ allow_copy_invite_link: false } as ModuleConfig}
            onSubmit={onSubmit}
            onCancel={onCancel}
        />,
    );
    return { ...result, onSubmit, onCancel };
};

describe("EmailInvitationFormDialog", () => {
    it("renders the form with the join rule confirmation", () => {
        const { container } = renderDialog();
        expect(container).toMatchSnapshot();
    });

    it("submits the entered emails and the join rule change", async () => {
        const { container, onSubmit } = renderDialog();
        const input = screen.getByPlaceholderText("Enter an email address");
        const sendButton = screen.getByRole("button", { name: "Send invite to guest" });

        await userEvent.type(input, "alice@example.com{Enter}");
        expect(input).toHaveValue("");

        // An invalid email blocks sending until it is removed
        await userEvent.type(input, "not-an-email{Enter}");
        await userEvent.type(input, "bob@example.com ");
        expect(container).toMatchSnapshot();
        expect(sendButton).toHaveAttribute("aria-disabled", "true");
        await userEvent.click(screen.getAllByRole("button", { name: "action|delete" })[1]);

        // The join rule change must be confirmed too
        expect(sendButton).toHaveAttribute("aria-disabled", "true");
        await userEvent.click(screen.getByRole("checkbox", { name: "Change room access to Ask to join" }));
        expect(sendButton).toHaveAttribute("aria-disabled", "false");

        await userEvent.click(sendButton);
        expect(onSubmit).toHaveBeenCalledWith({
            emails: ["alice@example.com", "bob@example.com"],
            hasToChangeJoinRule: true,
        });
    });

    it("closes the dialog with the cancel button", async () => {
        const { onCancel } = renderDialog();

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalled();
    });
});
