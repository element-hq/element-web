/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";

import LearnMore from "../../../../../src/components/views/elements/LearnMore";
import Modal from "../../../../../src/Modal";
import InfoDialog from "../../../../../src/components/views/dialogs/InfoDialog";

describe("<LearnMore />", () => {
    const defaultProps = {
        title: "Test",
        description: "test test test",
        ["data-testid"]: "testid",
    };
    const getComponent = (props = {}) => <LearnMore {...defaultProps} {...props} />;

    const modalSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
        finished: new Promise(() => {}),
        close: jest.fn(),
    });

    beforeEach(() => {
        jest.clearAllMocks();
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
