/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { fireEvent, render } from "@testing-library/react";

import LearnMore from "../../../../src/components/views/elements/LearnMore";
import Modal from "../../../../src/Modal";
import InfoDialog from "../../../../src/components/views/dialogs/InfoDialog";

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
