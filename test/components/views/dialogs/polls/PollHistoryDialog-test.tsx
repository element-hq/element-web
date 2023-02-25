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
import { Filter } from "matrix-js-sdk/src/filter";
import { EventTimeline, Room } from "matrix-js-sdk/src/matrix";
import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";

import { PollHistoryDialog } from "../../../../../src/components/views/dialogs/polls/PollHistoryDialog";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollStartEvent,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    setupRoomWithPollEvents,
    unmockIntlDateTimeFormat,
} from "../../../../test-utils";

describe("<PollHistoryDialog />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        relations: jest.fn(),
        decryptEventIfNeeded: jest.fn(),
        getOrCreateFilter: jest.fn(),
        paginateEventTimeline: jest.fn(),
    });
    let room = new Room(roomId, mockClient, userId);

    const expectedFilter = new Filter(userId);
    expectedFilter.setDefinition({
        room: {
            timeline: {
                types: [M_POLL_START.name, M_POLL_START.altName],
            },
        },
    });

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
        room = new Room(roomId, mockClient, userId);
        mockClient.getRoom.mockReturnValue(room);
        mockClient.relations.mockResolvedValue({ events: [] });
        const timeline = room.getLiveTimeline();
        jest.spyOn(timeline, "getEvents").mockReturnValue([]);
        jest.spyOn(room, "getOrCreateFilteredTimelineSet");
        mockClient.getOrCreateFilter.mockResolvedValue(expectedFilter.filterId!);
        mockClient.paginateEventTimeline.mockReset().mockResolvedValue(false);

        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    afterAll(() => {
        unmockIntlDateTimeFormat();
    });

    it("throws when room is not found", () => {
        mockClient.getRoom.mockReturnValue(null);

        expect(() => getComponent()).toThrow("Cannot find room");
    });

    it("renders a loading message while poll history is fetched", async () => {
        const timelineSet = room.getOrCreateFilteredTimelineSet(expectedFilter);
        const liveTimeline = timelineSet.getLiveTimeline();
        jest.spyOn(liveTimeline, "getPaginationToken").mockReturnValueOnce("test-pagination-token");

        const { queryByText, getByText } = getComponent();

        expect(mockClient.getOrCreateFilter).toHaveBeenCalledWith(
            `POLL_HISTORY_FILTER_${room.roomId}}`,
            expectedFilter,
        );
        // no results not shown until loading finished
        expect(queryByText("There are no active polls in this room")).not.toBeInTheDocument();
        expect(getByText("Loading polls")).toBeInTheDocument();

        // flush filter creation request
        await flushPromises();

        expect(liveTimeline.getPaginationToken).toHaveBeenCalledWith(EventTimeline.BACKWARDS);
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(liveTimeline, { backwards: true });
        // only one page
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(1);

        // finished loading
        expect(queryByText("Loading polls")).not.toBeInTheDocument();
        expect(getByText("There are no active polls in this room")).toBeInTheDocument();
    });

    it("fetches poll history until end of timeline is reached while within time limit", async () => {
        const timelineSet = room.getOrCreateFilteredTimelineSet(expectedFilter);
        const liveTimeline = timelineSet.getLiveTimeline();

        // mock three pages of timeline history
        jest.spyOn(liveTimeline, "getPaginationToken")
            .mockReturnValueOnce("test-pagination-token-1")
            .mockReturnValueOnce("test-pagination-token-2")
            .mockReturnValueOnce("test-pagination-token-3");

        const { queryByText, getByText } = getComponent();

        expect(mockClient.getOrCreateFilter).toHaveBeenCalledWith(
            `POLL_HISTORY_FILTER_${room.roomId}}`,
            expectedFilter,
        );

        // flush filter creation request
        await flushPromises();
        // once per page
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(3);

        // finished loading
        expect(queryByText("Loading polls")).not.toBeInTheDocument();
        expect(getByText("There are no active polls in this room")).toBeInTheDocument();
    });

    it("fetches poll history until event older than history period is reached", async () => {
        const timelineSet = room.getOrCreateFilteredTimelineSet(expectedFilter);
        const liveTimeline = timelineSet.getLiveTimeline();
        const thirtyOneDaysAgoTs = now - 60000 * 60 * 24 * 31;

        jest.spyOn(liveTimeline, "getEvents")
            .mockReturnValueOnce([])
            .mockReturnValueOnce([makePollStartEvent("Question?", userId, undefined, { ts: thirtyOneDaysAgoTs })]);

        // mock three pages of timeline history
        jest.spyOn(liveTimeline, "getPaginationToken")
            .mockReturnValueOnce("test-pagination-token-1")
            .mockReturnValueOnce("test-pagination-token-2")
            .mockReturnValueOnce("test-pagination-token-3");

        getComponent();

        // flush filter creation request
        await flushPromises();
        // after first fetch the time limit is reached
        // stop paging
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(1);
    });

    it("displays loader and list while paging timeline", async () => {
        const timelineSet = room.getOrCreateFilteredTimelineSet(expectedFilter);
        const liveTimeline = timelineSet.getLiveTimeline();
        const tenDaysAgoTs = now - 60000 * 60 * 24 * 10;

        jest.spyOn(liveTimeline, "getEvents").mockReset().mockReturnValue([]);

        // mock three pages of timeline history
        jest.spyOn(liveTimeline, "getPaginationToken")
            .mockReturnValueOnce("test-pagination-token-1")
            .mockReturnValueOnce("test-pagination-token-2")
            .mockReturnValueOnce("test-pagination-token-3");

        // reference to pagination resolve, so we can assert between pages
        let resolvePagination1: (value: boolean) => void | undefined;
        let resolvePagination2: (value: boolean) => void | undefined;
        mockClient.paginateEventTimeline
            .mockImplementationOnce(async (_p) => {
                const pollStart = makePollStartEvent("Question?", userId, undefined, { ts: now, id: "1" });
                jest.spyOn(liveTimeline, "getEvents").mockReturnValue([pollStart]);
                room.processPollEvents([pollStart]);
                return new Promise((resolve) => (resolvePagination1 = resolve));
            })
            .mockImplementationOnce(async (_p) => {
                const pollStart = makePollStartEvent("Older question?", userId, undefined, {
                    ts: tenDaysAgoTs,
                    id: "2",
                });
                jest.spyOn(liveTimeline, "getEvents").mockReturnValue([pollStart]);
                room.processPollEvents([pollStart]);
                return new Promise((resolve) => (resolvePagination2 = resolve));
            });

        const { getByText, queryByText } = getComponent();

        await flushPromises();

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(1);

        resolvePagination1!(true);
        await flushPromises();

        // first page has results, display immediately
        expect(getByText("Question?")).toBeInTheDocument();
        // but we are still fetching history, diaply loader
        expect(getByText("Loading polls")).toBeInTheDocument();

        resolvePagination2!(true);
        await flushPromises();

        // additional results addeds
        expect(getByText("Older question?")).toBeInTheDocument();
        expect(getByText("Question?")).toBeInTheDocument();
        // finished paging
        expect(queryByText("Loading polls")).not.toBeInTheDocument();

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(3);
    });

    it("renders a no polls message when there are no active polls in the room", async () => {
        const { getByText } = getComponent();
        await flushPromises();

        expect(getByText("There are no active polls in this room")).toBeTruthy();
    });

    it("renders a no past polls message when there are no past polls in the room", async () => {
        const { getByText } = getComponent();
        await flushPromises();

        fireEvent.click(getByText("Past polls"));

        expect(getByText("There are no past polls in this room")).toBeTruthy();
    });

    it("renders a list of active polls when there are polls in the room", async () => {
        const timestamp = 1675300825090;
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: timestamp, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: timestamp + 10000, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: timestamp + 70000, id: "$3" });
        const pollEnd3 = makePollEndEvent(pollStart3.getId()!, roomId, userId, timestamp + 1);
        await setupRoomWithPollEvents([pollStart2, pollStart3, pollStart1], [], [pollEnd3], mockClient, room);

        const { container, queryByText, getByTestId } = getComponent();

        // flush relations calls for polls
        await flushPromises();

        expect(getByTestId("filter-tab-PollHistoryDialog_filter-ACTIVE").firstElementChild).toBeChecked();

        expect(container).toMatchSnapshot();
        // this poll is ended, and default filter is ACTIVE
        expect(queryByText("What?")).not.toBeInTheDocument();
    });

    it("updates when new polls are added to the room", async () => {
        const timestamp = 1675300825090;
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: timestamp, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: timestamp + 10000, id: "$2" });
        // initially room has only one poll
        await setupRoomWithPollEvents([pollStart1], [], [], mockClient, room);

        const { getByText } = getComponent();

        // wait for relations
        await flushPromises();

        expect(getByText("Question?")).toBeInTheDocument();

        // add another poll
        // paged history requests using cli.paginateEventTimeline
        // call this with new events
        await room.processPollEvents([pollStart2]);
        // await relations for new poll
        await flushPromises();

        expect(getByText("Question?")).toBeInTheDocument();
        // list updated to include new poll
        expect(getByText("Where?")).toBeInTheDocument();
    });

    it("filters ended polls", async () => {
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: 1675300825090, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: 1675300725090, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: 1675200725090, id: "$3" });
        const pollEnd3 = makePollEndEvent(pollStart3.getId()!, roomId, userId, 1675200725090 + 1);
        await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

        const { getByText, queryByText, getByTestId } = getComponent();
        await flushPromises();

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
