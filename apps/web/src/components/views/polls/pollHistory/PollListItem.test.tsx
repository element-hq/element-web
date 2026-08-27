/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";
import React from "react";
import { fireEvent, render } from "test-utils-rtl";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { makePollStartEvent } from "test-utils";

import { PollListItem } from "./PollListItem";

describe("<PollListItem />", () => {
    const event = makePollStartEvent("Question?", "@me:domain.org");
    const defaultProps = { event, onClick: vi.fn() };
    const getComponent = (props = {}) => render(<PollListItem {...defaultProps} {...props} />);

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
        const onClick = vi.fn();
        const { getByText } = getComponent({ onClick });

        fireEvent.click(getByText("Question?"));

        expect(onClick).toHaveBeenCalled();
    });
});
