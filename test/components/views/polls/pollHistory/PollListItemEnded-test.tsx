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
import { MatrixEvent, Poll, Room } from "matrix-js-sdk/src/matrix";
import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";

import { PollListItemEnded } from "../../../../../src/components/views/polls/pollHistory/PollListItemEnded";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollResponseEvent,
    makePollStartEvent,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    setupRoomWithPollEvents,
    unmockIntlDateTimeFormat,
} from "../../../../test-utils";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("<PollListItemEnded />", () => {
    const userId = "@alice:domain.org";
    const roomId = "!room:domain.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
        relations: jest.fn(),
        decryptEventIfNeeded: jest.fn(),
    });
    const room = new Room(roomId, mockClient, userId);
    const timestamp = 1675300825090;

    const pollId = "1";
    const answerOne = {
        id: "answerOneId",
        [M_TEXT.name]: "Nissan Silvia S15",
    };
    const answerTwo = {
        id: "answerTwoId",
        [M_TEXT.name]: "Mitsubishi Lancer Evolution IX",
    };
    const pollStartEvent = makePollStartEvent("Question?", userId, [answerOne, answerTwo], {
        roomId,
        id: pollId,
        ts: timestamp,
    });
    const pollEndEvent = makePollEndEvent(pollId, roomId, userId, timestamp + 60000);

    const getComponent = (props: { event: MatrixEvent; poll: Poll }) =>
        render(<PollListItemEnded {...props} onClick={jest.fn()} />);

    beforeAll(() => {
        // mock default locale to en-GB and set timezone
        // so these tests run the same everywhere
        mockIntlDateTimeFormat();
    });

    afterAll(() => {
        unmockIntlDateTimeFormat();
    });

    it("renders a poll with no responses", async () => {
        await setupRoomWithPollEvents([pollStartEvent], [], [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { container } = getComponent({ event: pollStartEvent, poll });
        expect(container).toMatchSnapshot();
    });

    it("renders a poll with one winning answer", async () => {
        const responses = [
            makePollResponseEvent(pollId, [answerOne.id], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerOne.id], "@bob:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@charlie:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText } = getComponent({ event: pollStartEvent, poll });
        // fetch relations
        await flushPromises();
        expect(getByText("Final result based on 3 votes")).toBeInTheDocument();
        // winning answer
        expect(getByText("Nissan Silvia S15")).toBeInTheDocument();
    });

    it("renders a poll with two winning answers", async () => {
        const responses = [
            makePollResponseEvent(pollId, [answerOne.id], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerOne.id], "@han:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@sean:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@dk:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText } = getComponent({ event: pollStartEvent, poll });
        // fetch relations
        await flushPromises();
        expect(getByText("Final result based on 4 votes")).toBeInTheDocument();
        // both answers answer
        expect(getByText("Nissan Silvia S15")).toBeInTheDocument();
        expect(getByText("Mitsubishi Lancer Evolution IX")).toBeInTheDocument();
    });

    it("counts one unique vote per user", async () => {
        const responses = [
            makePollResponseEvent(pollId, [answerTwo.id], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerOne.id], userId, roomId, timestamp + 2),
            makePollResponseEvent(pollId, [answerOne.id], "@bob:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@charlie:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText } = getComponent({ event: pollStartEvent, poll });
        // fetch relations
        await flushPromises();

        // still only 3 unique votes
        expect(getByText("Final result based on 3 votes")).toBeInTheDocument();
        // only latest vote counted
        expect(getByText("Nissan Silvia S15")).toBeInTheDocument();
    });

    it("excludes malformed responses", async () => {
        const responses = [
            makePollResponseEvent(pollId, ["bad-answer-id"], userId, roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerOne.id], "@bob:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@charlie:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText } = getComponent({ event: pollStartEvent, poll });
        // fetch relations
        await flushPromises();

        // invalid vote excluded
        expect(getByText("Final result based on 2 votes")).toBeInTheDocument();
    });

    it("updates on new responses", async () => {
        const responses = [
            makePollResponseEvent(pollId, [answerOne.id], "@bob:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@charlie:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText, queryByText } = getComponent({ event: pollStartEvent, poll });
        // fetch relations
        await flushPromises();

        expect(getByText("Final result based on 2 votes")).toBeInTheDocument();

        await room.processPollEvents([
            makePollResponseEvent(pollId, [answerOne.id], "@han:domain.org", roomId, timestamp + 1),
        ]);

        // updated with more responses
        expect(getByText("Final result based on 3 votes")).toBeInTheDocument();
        expect(getByText("Nissan Silvia S15")).toBeInTheDocument();
        expect(queryByText("Mitsubishi Lancer Evolution IX")).not.toBeInTheDocument();
    });
});
