/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render } from "test-utils-rtl";

import LearnMore from "./LearnMore";
import Modal from "../../../Modal";
import InfoDialog from "../dialogs/InfoDialog";

describe("<LearnMore />", () => {
    const defaultProps = {
        "title": "Test",
        "description": "test test test",
        ["data-testid"]: "testid",
    };
    const getComponent = (props = {}) => <LearnMore {...defaultProps} {...props} />;

    const modalSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({
        finished: new Promise(() => {}),
        close: vi.fn(),
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders button", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("opens modal on click", async () => {
        const { getByTestId } = render(getComponent());
        fireEvent.click(getByTestId("testid"));

        expect(modalSpy).toHaveBeenCalledWith(InfoDialog, {
            button: "Got it",
            description: defaultProps.description,
            hasCloseButton: true,
            title: defaultProps.title,
        });
    });
});
