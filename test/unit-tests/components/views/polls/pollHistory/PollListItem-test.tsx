/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { PollListItem } from "../../../../../../src/components/views/polls/pollHistory/PollListItem";
import { makePollStartEvent, mockIntlDateTimeFormat, unmockIntlDateTimeFormat } from "../../../../../test-utils";

describe("<PollListItem />", () => {
    const event = makePollStartEvent("Question?", "@me:domain.org");
    const defaultProps = { event, onClick: jest.fn() };
    const getComponent = (props = {}) => render(<PollListItem {...defaultProps} {...props} />);

    beforeAll(() => {
        // mock default locale to en-GB and set timezone
        // so these tests run the same everywhere
        mockIntlDateTimeFormat();
    });

    afterAll(() => {
        unmockIntlDateTimeFormat();
    });

    it("renders a poll", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("renders null when event does not have an extensible poll start event", () => {
        const event = new MatrixEvent({
            type: "m.room.message",
            content: {},
        });
        const { container } = getComponent({ event });
        expect(container.firstElementChild).toBeFalsy();
    });

    it("calls onClick handler on click", () => {
        const onClick = jest.fn();
        const { getByText } = getComponent({ onClick });

        fireEvent.click(getByText("Question?"));

        expect(onClick).toHaveBeenCalled();
    });

    it("shows and hides tooltip on hover", async () => {
        const user = userEvent.setup();
        const { getByRole, getByText } = getComponent();
        const listItem = getByRole("listitem", { name: "01/01/70 Question?" });

        // Verify tooltip content is present
        const tooltip = getByText("View poll");
        expect(tooltip).toBeInTheDocument();

        // Test that hover and unhover interactions work
        await user.hover(listItem);
        await user.unhover(listItem);

        expect(tooltip).toBeInTheDocument();
    });
});
