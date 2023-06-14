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
import { render } from "@testing-library/react";
import { EventTimeline, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";

import { IBodyProps } from "../../../../src/components/views/messages/IBodyProps";
import { MPollEndBody } from "../../../../src/components/views/messages/MPollEndBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollStartEvent,
    mockClientMethodsEvents,
    mockClientMethodsUser,
    setupRoomWithPollEvents,
} from "../../../test-utils";

describe("<MPollEndBody />", () => {
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        getRoom: jest.fn(),
        relations: jest.fn(),
        fetchRoomEvent: jest.fn(),
    });
    const pollStartEvent = makePollStartEvent("Question?", userId, undefined, { roomId });
    const pollEndEvent = makePollEndEvent(pollStartEvent.getId()!, roomId, userId, 123);

    const setupRoomWithEventsTimeline = async (pollEnd: MatrixEvent, pollStart?: MatrixEvent): Promise<Room> => {
        if (pollStart) {
            await setupRoomWithPollEvents([pollStart], [], [pollEnd], mockClient);
        }
        const room = mockClient.getRoom(roomId) || new Room(roomId, mockClient, userId);

        // end events validate against this
        jest.spyOn(room.currentState, "maySendRedactionForEvent").mockImplementation(
            (_evt: MatrixEvent, id: string) => {
                return id === mockClient.getSafeUserId();
            },
        );

        const timelineSet = room.getUnfilteredTimelineSet();
        const getTimelineForEventSpy = jest.spyOn(timelineSet, "getTimelineForEvent");
        // if we have a pollStart, mock the room timeline to include it
        if (pollStart) {
            const eventTimeline = {
                getEvents: jest.fn().mockReturnValue([pollEnd, pollStart]),
            } as unknown as EventTimeline;
            getTimelineForEventSpy.mockReturnValue(eventTimeline);
        }
        mockClient.getRoom.mockReturnValue(room);

        return room;
    };

    const defaultProps = {
        mxEvent: pollEndEvent,
        highlightLink: "unused",
        mediaEventHelper: {} as unknown as MediaEventHelper,
        onHeightChanged: () => {},
        onMessageAllowed: () => {},
        permalinkCreator: {} as unknown as RoomPermalinkCreator,
        ref: undefined as any,
    };

    const getComponent = (props: Partial<IBodyProps> = {}) =>
        render(<MPollEndBody {...defaultProps} {...props} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    beforeEach(() => {
        mockClient.getRoom.mockReset();
        mockClient.relations.mockResolvedValue({
            events: [],
        });
        mockClient.fetchRoomEvent.mockResolvedValue(pollStartEvent.toJSON());
    });

    afterEach(() => {
        jest.spyOn(logger, "error").mockRestore();
    });

    describe("when poll start event exists in current timeline", () => {
        it("renders an ended poll", async () => {
            await setupRoomWithEventsTimeline(pollEndEvent, pollStartEvent);
            const { container } = getComponent();

            // ended poll rendered
            expect(container).toMatchSnapshot();

            // didnt try to fetch start event while it was already in timeline
            expect(mockClient.fetchRoomEvent).not.toHaveBeenCalled();
        });

        it("does not render a poll tile when end event is invalid", async () => {
            // sender of end event does not match start event
            const invalidEndEvent = makePollEndEvent(pollStartEvent.getId()!, roomId, "@mallory:domain.org", 123);
            await setupRoomWithEventsTimeline(invalidEndEvent, pollStartEvent);
            const { getByText } = getComponent({ mxEvent: invalidEndEvent });

            // no poll tile rendered
            expect(getByText("The poll has ended. Something.")).toBeTruthy();
        });
    });

    describe("when poll start event does not exist in current timeline", () => {
        it("fetches the related poll start event and displays a poll tile", async () => {
            await setupRoomWithEventsTimeline(pollEndEvent);
            const { container, getByTestId } = getComponent();

            // while fetching event, only icon is shown
            expect(container).toMatchSnapshot();

            // flush the fetch event promise
            await flushPromises();

            expect(mockClient.fetchRoomEvent).toHaveBeenCalledWith(roomId, pollStartEvent.getId());

            // quick check for poll tile
            expect(getByTestId("pollQuestion").innerHTML).toEqual("Question?");
            expect(getByTestId("totalVotes").innerHTML).toEqual("Final result based on 0 votes");
        });

        it("does not render a poll tile when end event is invalid", async () => {
            // sender of end event does not match start event
            const invalidEndEvent = makePollEndEvent(pollStartEvent.getId()!, roomId, "@mallory:domain.org", 123);
            await setupRoomWithEventsTimeline(invalidEndEvent);
            const { getByText } = getComponent({ mxEvent: invalidEndEvent });

            // flush the fetch event promise
            await flushPromises();

            // no poll tile rendered
            expect(getByText("The poll has ended. Something.")).toBeTruthy();
        });

        it("logs an error and displays the text fallback when fetching the start event fails", async () => {
            await setupRoomWithEventsTimeline(pollEndEvent);
            mockClient.fetchRoomEvent.mockRejectedValue({ code: 404 });
            const logSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
            const { getByText } = getComponent();

            // flush the fetch event promise
            await flushPromises();

            // poll end event fallback text used
            expect(getByText("The poll has ended. Something.")).toBeTruthy();
            expect(logSpy).toHaveBeenCalledWith("Failed to fetch related poll start event", { code: 404 });
        });

        it("logs an error and displays the extensible event text when fetching the start event fails", async () => {
            await setupRoomWithEventsTimeline(pollEndEvent);
            mockClient.fetchRoomEvent.mockRejectedValue({ code: 404 });
            const logSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
            const { getByText } = getComponent();

            // flush the fetch event promise
            await flushPromises();

            // poll end event fallback text used
            expect(getByText("The poll has ended. Something.")).toBeTruthy();
            expect(logSpy).toHaveBeenCalledWith("Failed to fetch related poll start event", { code: 404 });
        });

        it("displays fallback text when the poll end event does not have text", async () => {
            const endWithoutText = makePollEndEvent(pollStartEvent.getId()!, roomId, userId, 123);
            delete endWithoutText.getContent()[M_TEXT.name];
            await setupRoomWithEventsTimeline(endWithoutText);
            mockClient.fetchRoomEvent.mockRejectedValue({ code: 404 });
            const { getByText } = getComponent({ mxEvent: endWithoutText });

            // flush the fetch event promise
            await flushPromises();

            // default fallback text used
            expect(getByText("@alice:domain.org has ended a poll")).toBeTruthy();
        });
    });
});
