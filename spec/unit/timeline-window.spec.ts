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

import { MockedObject } from "jest-mock";

import { MatrixClient } from "../../src/client";
import { EventTimelineSet } from "../../src/models/event-timeline-set";
import { Room } from "../../src/models/room";
import { EventTimeline } from "../../src/models/event-timeline";
import { TimelineIndex, TimelineWindow } from "../../src/timeline-window";
import { mkMessage } from "../test-utils/test-utils";

const ROOM_ID = "roomId";
const USER_ID = "userId";
const mockClient = {
    getEventTimeline: jest.fn(),
    paginateEventTimeline: jest.fn(),
} as unknown as MockedObject<MatrixClient>;

/*
 * create a timeline with a bunch (default 3) events.
 * baseIndex is 1 by default.
 */
function createTimeline(numEvents = 3, baseIndex = 1): EventTimeline {
    const room = new Room(ROOM_ID, mockClient, USER_ID);
    const timelineSet = new EventTimelineSet(room);
    jest.spyOn(room, "getUnfilteredTimelineSet").mockReturnValue(timelineSet);

    const timeline = new EventTimeline(timelineSet);

    // add the events after the baseIndex first
    addEventsToTimeline(timeline, numEvents - baseIndex, false);

    // then add those before the baseIndex
    addEventsToTimeline(timeline, baseIndex, true);

    expect(timeline.getBaseIndex()).toEqual(baseIndex);
    return timeline;
}

function addEventsToTimeline(timeline: EventTimeline, numEvents: number, toStartOfTimeline: boolean) {
    for (let i = 0; i < numEvents; i++) {
        timeline.addEvent(
            mkMessage({
                room: ROOM_ID,
                user: USER_ID,
                event: true,
            }),
            { toStartOfTimeline },
        );
    }
}

/*
 * create a pair of linked timelines
 */
function createLinkedTimelines(): [EventTimeline, EventTimeline] {
    const tl1 = createTimeline();
    const tl2 = createTimeline();
    tl1.setNeighbouringTimeline(tl2, EventTimeline.FORWARDS);
    tl2.setNeighbouringTimeline(tl1, EventTimeline.BACKWARDS);
    return [tl1, tl2];
}

describe("TimelineIndex", function () {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.getEventTimeline.mockResolvedValue(undefined);
    });

    describe("minIndex", function () {
        it("should return the min index relative to BaseIndex", function () {
            const timelineIndex = new TimelineIndex(createTimeline(), 0);
            expect(timelineIndex.minIndex()).toEqual(-1);
        });
    });

    describe("maxIndex", function () {
        it("should return the max index relative to BaseIndex", function () {
            const timelineIndex = new TimelineIndex(createTimeline(), 0);
            expect(timelineIndex.maxIndex()).toEqual(2);
        });
    });

    describe("advance", function () {
        it("should advance up to the end of the timeline", function () {
            const timelineIndex = new TimelineIndex(createTimeline(), 0);
            const result = timelineIndex.advance(3);
            expect(result).toEqual(2);
            expect(timelineIndex.index).toEqual(2);
        });

        it("should retreat back to the start of the timeline", function () {
            const timelineIndex = new TimelineIndex(createTimeline(), 0);
            const result = timelineIndex.advance(-2);
            expect(result).toEqual(-1);
            expect(timelineIndex.index).toEqual(-1);
        });

        it("should advance into the next timeline", function () {
            const timelines = createLinkedTimelines();
            const tl1 = timelines[0];
            const tl2 = timelines[1];

            // initialise the index pointing at the end of the first timeline
            const timelineIndex = new TimelineIndex(tl1, 2);

            const result = timelineIndex.advance(1);
            expect(result).toEqual(1);
            expect(timelineIndex.timeline).toBe(tl2);

            // we expect the index to be the zero (ie, the same as the
            // BaseIndex), because the BaseIndex points at the second event,
            // and we've advanced past the first.
            expect(timelineIndex.index).toEqual(0);
        });

        it("should retreat into the previous timeline", function () {
            const timelines = createLinkedTimelines();
            const tl1 = timelines[0];
            const tl2 = timelines[1];

            // initialise the index pointing at the start of the second
            // timeline
            const timelineIndex = new TimelineIndex(tl2, -1);

            const result = timelineIndex.advance(-1);
            expect(result).toEqual(-1);
            expect(timelineIndex.timeline).toBe(tl1);
            expect(timelineIndex.index).toEqual(1);
        });
    });

    describe("retreat", function () {
        it("should retreat up to the start of the timeline", function () {
            const timelineIndex = new TimelineIndex(createTimeline(), 0);
            const result = timelineIndex.retreat(2);
            expect(result).toEqual(1);
            expect(timelineIndex.index).toEqual(-1);
        });
    });
});

describe("TimelineWindow", function () {
    /**
     * create a dummy eventTimelineSet and client, and a TimelineWindow
     * attached to them.
     */
    function createWindow(
        timeline: EventTimeline,
        opts?: {
            windowLimit?: number;
        },
    ): [TimelineWindow, EventTimelineSet] {
        const timelineSet = { getTimelineForEvent: () => null } as unknown as EventTimelineSet;
        mockClient.getEventTimeline.mockResolvedValue(timeline);

        return [new TimelineWindow(mockClient, timelineSet, opts), timelineSet];
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.getEventTimeline.mockResolvedValue(undefined);
        mockClient.paginateEventTimeline.mockResolvedValue(false);
    });

    describe("load", function () {
        it("should initialise from the live timeline", async function () {
            const liveTimeline = createTimeline();
            const room = new Room(ROOM_ID, mockClient, USER_ID);
            const timelineSet = new EventTimelineSet(room);
            jest.spyOn(timelineSet, "getLiveTimeline").mockReturnValue(liveTimeline);

            const timelineWindow = new TimelineWindow(mockClient, timelineSet);
            await timelineWindow.load(undefined, 2);

            expect(timelineSet.getLiveTimeline).toHaveBeenCalled();

            const expectedEvents = liveTimeline.getEvents().slice(1);
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);
        });

        it("should initialise from a specific event", async function () {
            const timeline = createTimeline();
            const eventId = timeline.getEvents()[1].getId();

            const timelineSet = { getTimelineForEvent: () => null } as unknown as EventTimelineSet;
            mockClient.getEventTimeline.mockResolvedValue(timeline);

            const timelineWindow = new TimelineWindow(mockClient, timelineSet);
            await timelineWindow.load(eventId, 3);
            expect(mockClient.getEventTimeline).toHaveBeenCalledWith(timelineSet, eventId);
            const expectedEvents = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);
        });

        it("canPaginate should return false until load has returned", async function () {
            const timeline = createTimeline();
            timeline.setPaginationToken("toktok1", EventTimeline.BACKWARDS);
            timeline.setPaginationToken("toktok2", EventTimeline.FORWARDS);

            const eventId = timeline.getEvents()[1].getId();

            const timelineSet = { getTimelineForEvent: () => null } as unknown as EventTimelineSet;
            mockClient.getEventTimeline.mockResolvedValue(timeline);

            const timelineWindow = new TimelineWindow(mockClient, timelineSet);

            const timelineWindowLoadPromise = timelineWindow.load(eventId, 3);

            // cannot paginate before load is complete
            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);

            // wait for load
            await timelineWindowLoadPromise;
            const expectedEvents = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            // can paginate now
            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);
        });
    });

    describe("pagination", function () {
        it("should be able to advance across the initial timeline", async function () {
            const timeline = createTimeline();
            const eventId = timeline.getEvents()[1].getId();
            const [timelineWindow] = createWindow(timeline);

            await timelineWindow.load(eventId, 1);

            const expectedEvents = [timeline.getEvents()[1]];
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);

            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(true);
            const expectedEventsAfterPagination = timeline.getEvents().slice(1);
            expect(timelineWindow.getEvents()).toEqual(expectedEventsAfterPagination);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);

            // cant paginate forward anymore
            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(false);

            // paginate back again
            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(true);

            const expectedEvents3 = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents3);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);
            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(false);
        });

        it("should advance into next timeline", async function () {
            const tls = createLinkedTimelines();
            const eventId = tls[0].getEvents()[1].getId();
            const [timelineWindow] = createWindow(tls[0], { windowLimit: 5 });

            await timelineWindow.load(eventId, 3);
            const expectedEvents = tls[0].getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);

            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(true);
            const expectedEvents2 = tls[0].getEvents().concat(tls[1].getEvents().slice(0, 2));
            expect(timelineWindow.getEvents()).toEqual(expectedEvents2);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);

            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(true);

            // the windowLimit should have made us drop an event from
            // tls[0]
            const expectedEvents3 = tls[0].getEvents().slice(1).concat(tls[1].getEvents());
            expect(timelineWindow.getEvents()).toEqual(expectedEvents3);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);
            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(false);
        });

        it("should retreat into previous timeline", async function () {
            const tls = createLinkedTimelines();
            const eventId = tls[1].getEvents()[1].getId();
            const [timelineWindow] = createWindow(tls[1], { windowLimit: 5 });

            await timelineWindow.load(eventId, 3);

            const expectedEvents = tls[1].getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);

            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(true);
            const expectedEvents2 = tls[0].getEvents().slice(1, 3).concat(tls[1].getEvents());
            expect(timelineWindow.getEvents()).toEqual(expectedEvents2);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);

            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(true);
            // the windowLimit should have made us drop an event from
            // tls[1]
            const expectedEvents3 = tls[0].getEvents().concat(tls[1].getEvents().slice(0, 2));
            expect(timelineWindow.getEvents()).toEqual(expectedEvents3);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);
            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(false);
        });

        it("should make forward pagination requests", async function () {
            const timeline = createTimeline();
            timeline.setPaginationToken("toktok", EventTimeline.FORWARDS);

            const [timelineWindow] = createWindow(timeline, { windowLimit: 5 });
            const eventId = timeline.getEvents()[1].getId();

            mockClient.paginateEventTimeline.mockImplementation(async (_t, _opts) => {
                addEventsToTimeline(timeline, 3, false);
                return true;
            });

            await timelineWindow.load(eventId, 3);
            const expectedEvents = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);
            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);

            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2)).toBe(true);
            expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: false, limit: 2 });
            const expectedEvents2 = timeline.getEvents().slice(0, 5);
            expect(timelineWindow.getEvents()).toEqual(expectedEvents2);
        });

        it("should make backward pagination requests", async function () {
            const timeline = createTimeline();
            timeline.setPaginationToken("toktok", EventTimeline.BACKWARDS);

            const [timelineWindow] = createWindow(timeline, { windowLimit: 5 });
            const eventId = timeline.getEvents()[1].getId();

            mockClient.paginateEventTimeline.mockImplementation(async (_t, _opts) => {
                addEventsToTimeline(timeline, 3, true);
                return true;
            });

            await timelineWindow.load(eventId, 3);
            const expectedEvents = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(true);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(false);

            expect(await timelineWindow.paginate(EventTimeline.BACKWARDS, 2)).toBe(true);
            expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: true, limit: 2 });

            const expectedEvents2 = timeline.getEvents().slice(1, 6);
            expect(timelineWindow.getEvents()).toEqual(expectedEvents2);
        });

        it("should limit the number of unsuccessful pagination requests", async function () {
            const timeline = createTimeline();
            timeline.setPaginationToken("toktok", EventTimeline.FORWARDS);

            const [timelineWindow] = createWindow(timeline, { windowLimit: 5 });
            const eventId = timeline.getEvents()[1].getId();

            mockClient.paginateEventTimeline.mockImplementation(async (_t, _opts) => {
                return true;
            });

            await timelineWindow.load(eventId, 3);
            const expectedEvents = timeline.getEvents();
            expect(timelineWindow.getEvents()).toEqual(expectedEvents);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);
            expect(await timelineWindow.paginate(EventTimeline.FORWARDS, 2, true, 3)).toBe(false);

            expect(mockClient.paginateEventTimeline).toHaveBeenCalledWith(timeline, { backwards: false, limit: 2 });

            expect(mockClient.paginateEventTimeline).toHaveBeenCalledTimes(3);
            const expectedEvents2 = timeline.getEvents().slice(0, 3);
            expect(timelineWindow.getEvents()).toEqual(expectedEvents2);

            expect(timelineWindow.canPaginate(EventTimeline.BACKWARDS)).toBe(false);
            expect(timelineWindow.canPaginate(EventTimeline.FORWARDS)).toBe(true);
        });
    });
});
