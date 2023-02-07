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
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { PollHistoryDialog } from "../../../../../src/components/views/dialogs/polls/PollHistoryDialog";
import {
    getMockClientWithEventEmitter,
    makePollStartEvent,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    unmockIntlDateTimeFormat,
} from "../../../../test-utils";

describe("<PollHistoryDialog />", () => {
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
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

    it("renders a no polls message when there are no polls in the timeline", () => {
        const { getByText } = getComponent();

        expect(getByText("There are no polls in this room")).toBeTruthy();
    });

    it("renders a list of polls when there are polls in the timeline", async () => {
        const pollStart1 = makePollStartEvent("Question?", userId, undefined, { ts: 1675300825090, id: "$1" });
        const pollStart2 = makePollStartEvent("Where?", userId, undefined, { ts: 1675300725090, id: "$2" });
        const pollStart3 = makePollStartEvent("What?", userId, undefined, { ts: 1675200725090, id: "$3" });
        const message = new MatrixEvent({
            type: "m.room.message",
            content: {},
        });
        const timeline = room.getLiveTimeline();
        jest.spyOn(timeline, "getEvents").mockReturnValue([pollStart1, pollStart2, pollStart3, message]);
        const { container } = getComponent();

        expect(container).toMatchSnapshot();
    });
});
