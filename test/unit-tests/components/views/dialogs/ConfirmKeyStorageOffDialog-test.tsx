/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import ConfirmKeyStorageOffDialog from "../../../../../src/components/views/dialogs/ConfirmKeyStorageOffDialog";

describe("ConfirmKeyStorageOffDialog", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("renders", () => {
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={jest.fn()} />);
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("calls onFinished with dismissed=true if we dismiss", () => {
        const onFinished = jest.fn();
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={onFinished} />);

        dialog.getByRole("button", { name: "Yes, dismiss" }).click();

        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("calls onFinished with dismissed=true if we continue", () => {
        const onFinished = jest.fn();
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={onFinished} />);

        dialog.getByRole("button", { name: "Go to Settings" }).click();

        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
