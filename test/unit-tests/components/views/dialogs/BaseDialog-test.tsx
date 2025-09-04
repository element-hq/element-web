/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import BaseDialog from "../../../../../src/components/views/dialogs/BaseDialog.tsx";

describe("BaseDialog", () => {
    it("calls onFinished when Escape is pressed", async () => {
        const onFinished = jest.fn();
        const { container } = render(<BaseDialog onFinished={onFinished} />);
        // Autolock's autofocus in the empty dialog is focusing on the close button and bringing up the tooltip
        // So we either need to call escape twice(one for the tooltip and one for the dialog) or focus
        // on the dialog first.
        const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
        dialog?.focus();
        await userEvent.keyboard("{Escape}");
        expect(onFinished).toHaveBeenCalled();
    });
});
