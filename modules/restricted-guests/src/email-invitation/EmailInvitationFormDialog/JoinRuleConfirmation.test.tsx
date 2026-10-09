/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "@vector-im/compound-web";

import { JoinRuleConfirmation } from "./JoinRuleConfirmation";
import { mockApi } from "../../tests/mockApi";

const renderJoinRuleConfirmation = (
    isJoinRuleChangeConfirmed: boolean,
    toggleJoinRuleConfirmed = vi.fn(),
): RenderResult =>
    // The checkbox is a form field, so it must be rendered inside a form
    render(
        <Form.Root>
            <JoinRuleConfirmation
                api={mockApi}
                isJoinRuleChangeConfirmed={isJoinRuleChangeConfirmed}
                toggleJoinRuleConfirmed={toggleJoinRuleConfirmed}
            />
        </Form.Root>,
    );

describe("JoinRuleConfirmation", () => {
    it.each([true, false])("renders when isJoinRuleChangeConfirmed=%s", (isJoinRuleChangeConfirmed) => {
        const { container } = renderJoinRuleConfirmation(isJoinRuleChangeConfirmed);
        expect(container).toMatchSnapshot();
    });

    it("toggles the confirmation when the checkbox is clicked", async () => {
        const toggleJoinRuleConfirmed = vi.fn();
        renderJoinRuleConfirmation(false, toggleJoinRuleConfirmed);

        await userEvent.click(screen.getByRole("checkbox", { name: "Change room access to Ask to join" }));
        expect(toggleJoinRuleConfirmed).toHaveBeenCalled();
    });
});
