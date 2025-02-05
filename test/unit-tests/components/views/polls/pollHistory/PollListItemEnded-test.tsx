/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { type MatrixEvent, type Poll, Room, M_TEXT } from "matrix-js-sdk/src/matrix";

import { PollListItemEnded } from "../../../../../../src/components/views/polls/pollHistory/PollListItemEnded";
import {
    getMockClientWithEventEmitter,
    makePollEndEvent,
    makePollResponseEvent,
    makePollStartEvent,
    mockClientMethodsUser,
    mockIntlDateTimeFormat,
    setupRoomWithPollEvents,
} from "../../../../../test-utils";

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

    beforeEach(() => {
        // mock default locale to en-GB and set timezone
        // so these tests run the same everywhere
        mockIntlDateTimeFormat();
    });

    afterEach(() => {
        jest.resetAllMocks();
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

        const { getByText, findByText } = getComponent({ event: pollStartEvent, poll });
        await expect(findByText("Final result based on 3 votes")).resolves.toBeInTheDocument();
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

        const { getByText, findByText } = getComponent({ event: pollStartEvent, poll });
        await expect(findByText("Final result based on 4 votes")).resolves.toBeInTheDocument();
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

        const { getByText, findByText } = getComponent({ event: pollStartEvent, poll });

        // still only 3 unique votes
        await expect(findByText("Final result based on 3 votes")).resolves.toBeInTheDocument();
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

        const { findByText } = getComponent({ event: pollStartEvent, poll });

        // invalid vote excluded
        await expect(findByText("Final result based on 2 votes")).resolves.toBeInTheDocument();
    });

    it("updates on new responses", async () => {
        const responses = [
            makePollResponseEvent(pollId, [answerOne.id], "@bob:domain.org", roomId, timestamp + 1),
            makePollResponseEvent(pollId, [answerTwo.id], "@charlie:domain.org", roomId, timestamp + 1),
        ];
        await setupRoomWithPollEvents([pollStartEvent], responses, [pollEndEvent], mockClient, room);
        const poll = room.polls.get(pollId)!;

        const { getByText, queryByText, findByText } = getComponent({ event: pollStartEvent, poll });

        await expect(findByText("Final result based on 2 votes")).resolves.toBeInTheDocument();

        await room.processPollEvents([
            makePollResponseEvent(pollId, [answerOne.id], "@han:domain.org", roomId, timestamp + 1),
        ]);

        // updated with more responses
        await expect(findByText("Final result based on 3 votes")).resolves.toBeInTheDocument();
        expect(getByText("Nissan Silvia S15")).toBeInTheDocument();
        expect(queryByText("Mitsubishi Lancer Evolution IX")).not.toBeInTheDocument();
    });
});
