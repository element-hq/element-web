/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { PollListItem } from "../../../../../src/components/views/polls/pollHistory/PollListItem";
import { makePollStartEvent, mockIntlDateTimeFormat, unmockIntlDateTimeFormat } from "../../../../test-utils";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("<PollListItem />", () => {
    const event = makePollStartEvent("Question?", "@me:domain.org");
    event.getContent().origin;
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
});
