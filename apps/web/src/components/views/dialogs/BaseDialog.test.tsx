/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

import BaseDialog from "./BaseDialog.tsx";

describe("BaseDialog", () => {
    it("calls onFinished when Escape is pressed", async () => {
        const onFinished = vi.fn();
        const { container } = render(<BaseDialog onFinished={onFinished} />);
        // Autolock's autofocus in the empty dialog is focusing on the close button and bringing up the tooltip
        // So we either need to call escape twice(one for the tooltip and one for the dialog) or focus
        // on the dialog first.
        const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
        dialog?.focus();
        await userEvent.keyboard("{Escape}");
        expect(onFinished).toHaveBeenCalled();
    });
});
