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
        render(<BaseDialog onFinished={onFinished} />);
        await userEvent.keyboard("{Escape}");
        expect(onFinished).toHaveBeenCalled();
    });
});
