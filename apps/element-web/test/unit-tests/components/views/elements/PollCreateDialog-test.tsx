/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult } from "jest-matrix-react";
import {
    Room,
    MatrixEvent,
    M_POLL_KIND_DISCLOSED,
    M_POLL_KIND_UNDISCLOSED,
    M_POLL_START,
    M_TEXT,
} from "matrix-js-sdk/src/matrix";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { type ReplacementEvent } from "matrix-js-sdk/src/types";

import { getMockClientWithEventEmitter } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import PollCreateDialog from "../../../../../src/components/views/elements/PollCreateDialog";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

// Fake date to give a predictable snapshot
const realDateNow = Date.now;
const realDateToISOString = Date.prototype.toISOString;
Date.now = jest.fn(() => 2345678901234);
// eslint-disable-next-line no-extend-native
Date.prototype.toISOString = jest.fn(() => "2021-11-23T14:35:14.240Z");

afterAll(() => {
    Date.now = realDateNow;
    // eslint-disable-next-line no-extend-native
    Date.prototype.toISOString = realDateToISOString;
});

describe("PollCreateDialog", () => {
    const mockClient = getMockClientWithEventEmitter({
        sendEvent: jest.fn().mockResolvedValue({ event_id: "1" }),
    });

    beforeEach(() => {
        mockClient.sendEvent.mockClear();
    });

    it("renders a blank poll", () => {
        const dialog = render(
            <MatrixClientContext.Provider value={mockClient}>
                <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />
            </MatrixClientContext.Provider>,
        );
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("autofocuses the poll topic on mount", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expect(dialog.container.querySelector("#poll-topic-input")).toHaveFocus();
    });

    it("autofocuses the new poll option field after clicking add option button", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expect(dialog.container.querySelector("#poll-topic-input")).toHaveFocus();

        fireEvent.click(dialog.container.querySelector("div.mx_PollCreateDialog_addOption")!);

        expect(dialog.container.querySelector("#poll-topic-input")).not.toHaveFocus();
        expect(dialog.container.querySelector("#pollcreate_option_1")).not.toHaveFocus();
        expect(dialog.container.querySelector("#pollcreate_option_2")).toHaveFocus();
    });

    it("renders a question and some options", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expectSubmitToBeDisabled(dialog, true);

        // When I set some values in the boxes
        changeValue(dialog, "Question or topic", "How many turnips is the optimal number?");
        changeValue(dialog, "Option 1", "As many as my neighbour");
        changeValue(dialog, "Option 2", "The question is meaningless");
        fireEvent.click(dialog.container.querySelector("div.mx_PollCreateDialog_addOption")!);
        changeValue(dialog, "Option 3", "Mu");
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("renders info from a previous event", () => {
        const previousEvent: MatrixEvent = new MatrixEvent(
            PollStartEvent.from("Poll Q", ["Answer 1", "Answer 2"], M_POLL_KIND_DISCLOSED).serialize(),
        );

        const dialog = render(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} editingMxEvent={previousEvent} />,
        );

        expectSubmitToBeDisabled(dialog, false);
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("doesn't allow submitting until there are options", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expectSubmitToBeDisabled(dialog, true);
    });

    it("does allow submitting when there are options and a question", () => {
        // Given a dialog with no info in (which I am unable to submit)
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expectSubmitToBeDisabled(dialog, true);

        // When I set some values in the boxes
        changeValue(dialog, "Question or topic", "Q");
        changeValue(dialog, "Option 1", "A1");
        changeValue(dialog, "Option 2", "A2");

        // Then I am able to submit
        expectSubmitToBeDisabled(dialog, false);
    });

    it("shows the open poll description at first", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        expect(dialog.container.querySelector("select")).toHaveValue(M_POLL_KIND_DISCLOSED.name);
        expect(dialog.container.querySelector("p")).toHaveTextContent("Voters see results as soon as they have voted");
    });

    it("shows the closed poll description if we choose it", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        changeKind(dialog, M_POLL_KIND_UNDISCLOSED.name);
        expect(dialog.container.querySelector("select")).toHaveValue(M_POLL_KIND_UNDISCLOSED.name);
        expect(dialog.container.querySelector("p")).toHaveTextContent(
            "Results are only revealed when you end the poll",
        );
    });

    it("shows the open poll description if we choose it", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        changeKind(dialog, M_POLL_KIND_UNDISCLOSED.name);
        changeKind(dialog, M_POLL_KIND_DISCLOSED.name);
        expect(dialog.container.querySelector("select")).toHaveValue(M_POLL_KIND_DISCLOSED.name);
        expect(dialog.container.querySelector("p")).toHaveTextContent("Voters see results as soon as they have voted");
    });

    it("shows the closed poll description when editing a closed poll", () => {
        const previousEvent: MatrixEvent = new MatrixEvent(
            PollStartEvent.from("Poll Q", ["Answer 1", "Answer 2"], M_POLL_KIND_UNDISCLOSED).serialize(),
        );
        previousEvent.event.event_id = "$prevEventId";

        const dialog = render(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} editingMxEvent={previousEvent} />,
        );

        expect(dialog.container.querySelector("select")).toHaveValue(M_POLL_KIND_UNDISCLOSED.name);
        expect(dialog.container.querySelector("p")).toHaveTextContent(
            "Results are only revealed when you end the poll",
        );
    });

    it("displays a spinner after submitting", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        changeValue(dialog, "Question or topic", "Q");
        changeValue(dialog, "Option 1", "A1");
        changeValue(dialog, "Option 2", "A2");
        expect(dialog.container.querySelector(".mx_Spinner")).toBeFalsy();

        fireEvent.click(dialog.container.querySelector("button")!);
        expect(dialog.container.querySelector(".mx_Spinner")).toBeDefined();
    });

    it("sends a poll create event when submitted", () => {
        const dialog = render(<PollCreateDialog room={createRoom()} onFinished={jest.fn()} />);
        changeValue(dialog, "Question or topic", "Q");
        changeValue(dialog, "Option 1", "A1");
        changeValue(dialog, "Option 2", "A2");

        fireEvent.click(dialog.container.querySelector("button")!);
        const [, , eventType, sentEventContent] = mockClient.sendEvent.mock.calls[0];
        expect(M_POLL_START.matches(eventType)).toBeTruthy();
        expect(sentEventContent).toEqual({
            [M_TEXT.name]: "Q\n1. A1\n2. A2",
            [M_POLL_START.name]: {
                answers: [
                    {
                        id: expect.any(String),
                        [M_TEXT.name]: "A1",
                    },
                    {
                        id: expect.any(String),
                        [M_TEXT.name]: "A2",
                    },
                ],
                kind: M_POLL_KIND_DISCLOSED.name,
                max_selections: 1,
                question: {
                    body: "Q",
                    format: undefined,
                    formatted_body: undefined,
                    msgtype: "m.text",
                    [M_TEXT.name]: "Q",
                },
            },
        });
    });

    it("sends a poll edit event when editing", () => {
        const previousEvent: MatrixEvent = new MatrixEvent(
            PollStartEvent.from("Poll Q", ["Answer 1", "Answer 2"], M_POLL_KIND_DISCLOSED).serialize(),
        );
        previousEvent.event.event_id = "$prevEventId";

        const dialog = render(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} editingMxEvent={previousEvent} />,
        );

        changeValue(dialog, "Question or topic", "Poll Q updated");
        changeValue(dialog, "Option 2", "Answer 2 updated");
        changeKind(dialog, M_POLL_KIND_UNDISCLOSED.name);
        fireEvent.click(dialog.container.querySelector("button")!);

        const [, , eventType, sentEventContent] = mockClient.sendEvent.mock.calls[0];
        expect(M_POLL_START.matches(eventType)).toBeTruthy();
        expect(sentEventContent).toEqual({
            "m.new_content": {
                [M_TEXT.name]: "Poll Q updated\n1. Answer 1\n2. Answer 2 updated",
                [M_POLL_START.name]: {
                    answers: [
                        {
                            id: expect.any(String),
                            [M_TEXT.name]: "Answer 1",
                        },
                        {
                            id: expect.any(String),
                            [M_TEXT.name]: "Answer 2 updated",
                        },
                    ],
                    kind: M_POLL_KIND_UNDISCLOSED.name,
                    max_selections: 1,
                    question: {
                        body: "Poll Q updated",
                        format: undefined,
                        formatted_body: undefined,
                        msgtype: "m.text",
                        [M_TEXT.name]: "Poll Q updated",
                    },
                },
            },
            "m.relates_to": {
                event_id: previousEvent.getId(),
                rel_type: "m.replace",
            },
        });
    });

    it("retains poll disclosure type when editing", () => {
        const previousEvent: MatrixEvent = new MatrixEvent(
            PollStartEvent.from("Poll Q", ["Answer 1", "Answer 2"], M_POLL_KIND_DISCLOSED).serialize(),
        );
        previousEvent.event.event_id = "$prevEventId";

        const dialog = render(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} editingMxEvent={previousEvent} />,
        );

        changeValue(dialog, "Question or topic", "Poll Q updated");
        fireEvent.click(dialog.container.querySelector("button")!);

        const [, , eventType, sentEventContent] = mockClient.sendEvent.mock.calls[0];
        expect(M_POLL_START.matches(eventType)).toBeTruthy();
        // didnt change
        expect((sentEventContent as ReplacementEvent<any>)["m.new_content"][M_POLL_START.name].kind).toEqual(
            M_POLL_KIND_DISCLOSED.name,
        );
    });
});

function createRoom(): Room {
    return new Room("roomid", MatrixClientPeg.safeGet(), "@name:example.com", {});
}

function changeValue(wrapper: RenderResult, labelText: string, value: string) {
    fireEvent.change(wrapper.container.querySelector(`input[label="${labelText}"]`)!, {
        target: { value: value },
    });
}

function changeKind(wrapper: RenderResult, value: string) {
    fireEvent.change(wrapper.container.querySelector("select")!, { target: { value: value } });
}

function expectSubmitToBeDisabled(wrapper: RenderResult, disabled: boolean) {
    if (disabled) {
        expect(wrapper.container.querySelector('button[type="submit"]')).toHaveAttribute("aria-disabled", "true");
    } else {
        expect(wrapper.container.querySelector('button[type="submit"]')).not.toHaveAttribute("aria-disabled", "true");
    }
}
