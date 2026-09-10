/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import { vi, describe, it, expect, afterEach } from "vitest";

import ConfirmKeyStorageOffDialog from "./ConfirmKeyStorageOffDialog";

describe("ConfirmKeyStorageOffDialog", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    it("renders", () => {
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={vi.fn()} />);
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("calls onFinished with dismissed=true if we dismiss", () => {
        const onFinished = vi.fn();
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={onFinished} />);

        dialog.getByRole("button", { name: "Yes, dismiss" }).click();

        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("calls onFinished with dismissed=true if we continue", () => {
        const onFinished = vi.fn();
        const dialog = render(<ConfirmKeyStorageOffDialog onFinished={onFinished} />);

        dialog.getByRole("button", { name: "Go to Settings" }).click();

        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
