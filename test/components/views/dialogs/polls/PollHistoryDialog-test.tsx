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
import { Room } from "matrix-js-sdk/src/matrix";

import { PollHistoryDialog } from "../../../../../src/components/views/dialogs/polls/PollHistoryDialog";
import {
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollStartEvent,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    setupRoomWithPollEvents,
    unmockIntlDateTimeFormat,
} from "../../../../test-utils";

describe("<PollHistoryDialog />", () => {
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        relations: jest.fn(),
        decryptEventIfNeeded: jest.fn(),
    });
    const room = new Room(roomId, mockClient, userId);

    const defaultProps = {
        roomId,
        matrixClient: mockClient,
        onFinished: jest.fn(),
    };
    const getComponent = () => render(<PollHistoryDialog {...defaultProps} />);

    beforeAll(() => {
        mockIntlDateTimeFormat();
    });

    beforeEach(() => {
        mockClient.getRoom.mockReturnValue(room);
        mockClient.relations.mockResolvedValue({ events: [] });
        const timeline = room.getLiveTimeline();
        jest.spyOn(timeline, "getEvents").mockReturnValue([]);
    });

    afterAll(() => {
        unmockIntlDateTimeFormat();
    });

    it("throws when room is not found", () => {
        mockClient.getRoom.mockReturnValue(null);

        expect(() => getComponent()).toThrow("Cannot find room");
    });

    it("renders a no polls message when there are no active polls in the timeline", () => {
        const { getByText } = getComponent();

        expect(getByText("There are no active polls in this room")).toBeTruthy();
    });

    it("renders a no past polls message when there are no past polls in the timeline", () => {
        const { getByText } = getComponent();

        fireEvent.click(getByText("Past polls"));

        expect(getByText("There are no past polls in this room")).toBeTruthy();
    });

    it("renders a list of active polls when there are polls in the timeline", async () => {
        const timestamp = 1675300825090;
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: timestamp, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: timestamp + 10000, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: timestamp + 70000, id: "$3" });
        const pollEnd3 = makePollEndEvent(pollStart3.getId()!, roomId, userId, timestamp + 1);
        await setupRoomWithPollEvents([pollStart2, pollStart3, pollStart1], [], [pollEnd3], mockClient, room);

        const { container, queryByText, getByTestId } = getComponent();

        expect(getByTestId("filter-tab-PollHistoryDialog_filter-ACTIVE").firstElementChild).toBeChecked();

        expect(container).toMatchSnapshot();
        // this poll is ended, and default filter is ACTIVE
        expect(queryByText("What?")).not.toBeInTheDocument();
    });

    it("filters ended polls", async () => {
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: 1675300825090, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: 1675300725090, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: 1675200725090, id: "$3" });
        const pollEnd3 = makePollEndEvent(pollStart3.getId()!, roomId, userId, 1675200725090 + 1);
        await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

        const { getByText, queryByText, getByTestId } = getComponent();

        expect(getByText("Question?")).toBeInTheDocument();
        expect(getByText("Where?")).toBeInTheDocument();
        // this poll is ended, and default filter is ACTIVE
        expect(queryByText("What?")).not.toBeInTheDocument();

        fireEvent.click(getByText("Past polls"));
        expect(getByTestId("filter-tab-PollHistoryDialog_filter-ENDED").firstElementChild).toBeChecked();

        // active polls no longer shown
        expect(queryByText("Question?")).not.toBeInTheDocument();
        expect(queryByText("Where?")).not.toBeInTheDocument();
        // this poll is ended
        expect(getByText("What?")).toBeInTheDocument();
    });
});
