/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";
import { Filter, EventTimeline, Room, type MatrixEvent, M_POLL_START } from "matrix-js-sdk/src/matrix";

import { PollHistory } from "../../../../../../src/components/views/polls/pollHistory/PollHistory";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollStartEvent,
    mockClientMethodsRooms,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    setupRoomWithPollEvents,
    unmockIntlDateTimeFormat,
} from "../../../../../test-utils";
import { RoomPermalinkCreator } from "../../../../../../src/utils/permalinks/Permalinks";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../../src/dispatcher/actions";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";

describe("<PollHistory />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsRooms([]),
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
        room,
        matrixClient: mockClient,
        permalinkCreator: new RoomPermalinkCreator(room),
        onFinished: jest.fn(),
    };
    const getComponent = () =>
        render(<PollHistory {...defaultProps} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    beforeAll(() => {
        mockIntlDateTimeFormat();
    });

    beforeEach(() => {
        room = new Room(roomId, mockClient, userId);
        mockClient.getRoom.mockReturnValue(room);
        defaultProps.room = room;
        mockClient.relations.mockResolvedValue({ events: [] });
        const timeline = room.getLiveTimeline();
        jest.spyOn(timeline, "getEvents").mockReturnValue([]);
        jest.spyOn(defaultDispatcher, "dispatch").mockClear();
        defaultProps.onFinished.mockClear();
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

    it("renders a no polls message when there are no active polls in the room", async () => {
        const { getByText } = getComponent();
        await flushPromises();

        expect(getByText("There are no active polls in this room")).toBeTruthy();
    });

    it("renders a no polls message and a load more button when not at end of timeline", async () => {
        const timelineSet = room.getOrCreateFilteredTimelineSet(expectedFilter);
        const liveTimeline = timelineSet.getLiveTimeline();
        const fourtyDaysAgoTs = now - 60000 * 60 * 24 * 40;
        const pollStart = makePollStartEvent("Question?", userId, undefined, { ts: fourtyDaysAgoTs, id: "1" });

        jest.spyOn(liveTimeline, "getEvents")
            .mockReset()
            .mockReturnValueOnce([])
            .mockReturnValueOnce([pollStart])
            .mockReturnValue(undefined as unknown as MatrixEvent[]);

        // mock three pages of timeline history
        jest.spyOn(liveTimeline, "getPaginationToken")
            .mockReturnValueOnce("test-pagination-token-1")
            .mockReturnValueOnce("test-pagination-token-2")
            .mockReturnValueOnce("test-pagination-token-3");

        const { getByText } = getComponent();
        await flushPromises();

        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(1);

        expect(getByText("There are no active polls. Load more polls to view polls for previous months")).toBeTruthy();

        fireEvent.click(getByText("Load more polls"));

        // paged again
        expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(2);
        // load more polls button still in UI, with loader
        expect(getByText("Load more polls")).toMatchSnapshot();

        await flushPromises();

        // no more spinner
        expect(getByText("Load more polls")).toMatchSnapshot();
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

        expect(getByTestId("filter-tab-PollHistory_filter-ACTIVE").firstElementChild).toBeChecked();

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
        expect(getByTestId("filter-tab-PollHistory_filter-ENDED").firstElementChild).toBeChecked();

        // active polls no longer shown
        expect(queryByText("Question?")).not.toBeInTheDocument();
        expect(queryByText("Where?")).not.toBeInTheDocument();
        // this poll is ended
        expect(getByText("What?")).toBeInTheDocument();
    });

    describe("Poll detail", () => {
        const timestamp = 1675300825090;
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: timestamp, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: timestamp + 10000, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: timestamp + 70000, id: "$3" });
        const pollEnd3 = makePollEndEvent(pollStart3.getId()!, roomId, userId, timestamp + 1, "$4");

        it("displays poll detail on active poll list item click", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText, queryByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Question?"));

            expect(queryByText("Polls")).not.toBeInTheDocument();
            // elements from MPollBody
            expect(getByText("Question?")).toMatchSnapshot();
            expect(getByText("Socks")).toBeInTheDocument();
            expect(getByText("Shoes")).toBeInTheDocument();
        });

        it("links to the poll start event from an active poll detail", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Question?"));

            // links to poll start event
            expect(getByText("View poll in timeline").getAttribute("href")).toBe(
                `https://matrix.to/#/!room:domain.org/${pollStart1.getId()!}`,
            );
        });

        it("navigates in app when clicking view in timeline button", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Question?"));

            const event = new MouseEvent("click", { bubbles: true, cancelable: true });
            jest.spyOn(event, "preventDefault");
            fireEvent(getByText("View poll in timeline"), event);

            expect(event.preventDefault).toHaveBeenCalled();

            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: pollStart1.getId()!,
                highlighted: true,
                metricsTrigger: undefined,
                room_id: pollStart1.getRoomId()!,
            });

            // dialog closed
            expect(defaultProps.onFinished).toHaveBeenCalled();
        });

        it("doesnt navigate in app when view in timeline link is ctrl + clicked", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Question?"));

            const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
            jest.spyOn(event, "preventDefault");
            fireEvent(getByText("View poll in timeline"), event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(defaultDispatcher.dispatch).not.toHaveBeenCalled();
            expect(defaultProps.onFinished).not.toHaveBeenCalled();
        });

        it("navigates back to poll list from detail view on header click", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText, queryByText, getByTestId, container } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Question?"));

            // detail view
            expect(getByText("Question?")).toBeInTheDocument();

            // header not shown
            expect(queryByText("Polls")).not.toBeInTheDocument();

            expect(getByText("Active polls")).toMatchSnapshot();
            fireEvent.click(getByText("Active polls"));

            // main list header displayed again
            expect(getByText("Polls")).toBeInTheDocument();
            // active filter still active
            expect(getByTestId("filter-tab-PollHistory_filter-ACTIVE").firstElementChild).toBeChecked();
            // list displayed
            expect(container.getElementsByClassName("mx_PollHistoryList_list").length).toBeTruthy();
        });

        it("displays poll detail on past poll list item click", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Past polls"));

            // pollStart3 is ended
            fireEvent.click(getByText("What?"));

            expect(getByText("What?")).toMatchSnapshot();
        });

        it("links to the poll end events from a ended poll detail", async () => {
            await setupRoomWithPollEvents([pollStart1, pollStart2, pollStart3], [], [pollEnd3], mockClient, room);

            const { getByText } = getComponent();
            await flushPromises();

            fireEvent.click(getByText("Past polls"));

            // pollStart3 is ended
            fireEvent.click(getByText("What?"));

            // links to poll end event
            expect(getByText("View poll in timeline").getAttribute("href")).toBe(
                `https://matrix.to/#/!room:domain.org/${pollEnd3.getId()!}`,
            );
        });
    });
});
