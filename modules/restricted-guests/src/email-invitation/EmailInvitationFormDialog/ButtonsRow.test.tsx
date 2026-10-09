/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import { ButtonsRow } from "./ButtonsRow";
import { mockApi } from "../../tests/mockApi";

type ButtonsRowProps = ComponentProps<typeof ButtonsRow>;

const renderButtonsRow = (props: Partial<ButtonsRowProps> = {}): RenderResult & ButtonsRowProps => {
    const allProps = {
        api: mockApi,
        canSendInvitations: true,
        canCopyLinkToClipboard: false,
        copyLinkToClipboard: vi.fn(),
        closeDialog: vi.fn(),
        displayCopyTooltip: false,
        ...props,
    };
    // Element Web provides the tooltip provider for the whole app
    const result = render(
        <TooltipProvider>
            <ButtonsRow {...allProps} />
        </TooltipProvider>,
    );
    return { ...result, ...allProps };
};

describe("ButtonsRow", () => {
    it.each<{ name: string; props: Partial<ButtonsRowProps> }>([
        { name: "the cancel button", props: {} },
        { name: "the copy link button", props: { canCopyLinkToClipboard: true } },
        { name: "the copied tooltip", props: { canCopyLinkToClipboard: true, displayCopyTooltip: true } },
        { name: "a disabled send button", props: { canSendInvitations: false } },
    ])("renders $name", ({ props }) => {
        // The tooltip is rendered outside the container, so snapshot the whole body
        const { baseElement } = renderButtonsRow(props);
        expect(baseElement).toMatchSnapshot();
    });

    it("closes the dialog with the cancel button", async () => {
        const { closeDialog } = renderButtonsRow();

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(closeDialog).toHaveBeenCalled();
    });

    it("copies the link with the copy button", async () => {
        const { copyLinkToClipboard } = renderButtonsRow({ canCopyLinkToClipboard: true });

        await userEvent.click(screen.getByRole("button", { name: "Copy invite link" }));
        expect(copyLinkToClipboard).toHaveBeenCalled();
    });
});
