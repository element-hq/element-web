/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked } from "jest-mock";
import {
    type MatrixClient,
    MatrixEvent,
    Room,
    M_POLL_START,
    type PollAnswer,
    M_POLL_KIND_DISCLOSED,
    M_POLL_END,
    M_POLL_RESPONSE,
    M_TEXT,
} from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import { flushPromises } from "./utilities";

type Options = {
    roomId: string;
    ts: number;
    id: string;
};
export const makePollStartEvent = (
    question: string,
    sender: string,
    answers?: PollAnswer[],
    { roomId, ts, id }: Partial<Options> = {},
): MatrixEvent => {
    if (!answers) {
        answers = [
            { id: "socks", [M_TEXT.name]: "Socks" },
            { id: "shoes", [M_TEXT.name]: "Shoes" },
        ];
    }

    return new MatrixEvent({
        event_id: id || "$mypoll",
        room_id: roomId || "#myroom:example.com",
        sender: sender,
        type: M_POLL_START.name,
        content: {
            [M_POLL_START.name]: {
                question: {
                    [M_TEXT.name]: question,
                },
                kind: M_POLL_KIND_DISCLOSED.name,
                answers: answers,
            },
            [M_TEXT.name]: `${question}: answers`,
        },
        origin_server_ts: ts || 0,
    });
};

export const makePollEndEvent = (
    pollStartEventId: string,
    roomId: string,
    sender: string,
    ts = 0,
    id?: string,
): MatrixEvent => {
    return new MatrixEvent({
        event_id: id || secureRandomString(16),
        room_id: roomId,
        origin_server_ts: ts,
        type: M_POLL_END.name,
        sender: sender,
        content: {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollStartEventId,
            },
            [M_POLL_END.name]: {},
            [M_TEXT.name]: "The poll has ended. Something.",
        },
    });
};

export const makePollResponseEvent = (
    pollId: string,
    answerIds: string[],
    sender: string,
    roomId: string,
    ts = 0,
): MatrixEvent =>
    new MatrixEvent({
        event_id: secureRandomString(16),
        room_id: roomId,
        origin_server_ts: ts,
        type: M_POLL_RESPONSE.name,
        sender,
        content: {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollId,
            },
            [M_POLL_RESPONSE.name]: {
                answers: answerIds,
            },
        },
    });

/**
 * Creates a room with attached poll events
 * Returns room from mockClient
 * mocks relations api
 * @param mxEvent - poll start event
 * @param relationEvents - returned by relations api
 * @param endEvents - returned by relations api
 * @param mockClient - client in use
 * @returns
 */
export const setupRoomWithPollEvents = async (
    pollStartEvents: MatrixEvent[],
    relationEvents: Array<MatrixEvent>,
    endEvents: Array<MatrixEvent> = [],
    mockClient: Mocked<MatrixClient>,
    existingRoom?: Room,
): Promise<Room> => {
    const room = existingRoom || new Room(pollStartEvents[0].getRoomId()!, mockClient, mockClient.getSafeUserId());
    room.processPollEvents([...pollStartEvents, ...relationEvents, ...endEvents]);

    // set redaction allowed for current user only
    // poll end events are validated against this
    jest.spyOn(room.currentState, "maySendRedactionForEvent").mockImplementation((_evt: MatrixEvent, id: string) => {
        return id === mockClient.getSafeUserId();
    });

    // wait for events to process on room
    await flushPromises();
    mockClient.getRoom.mockReturnValue(room);
    mockClient.relations.mockImplementation(async (_roomId: string, eventId: string) => {
        return {
            events: [...relationEvents, ...endEvents].filter((event) => event.getRelation()?.event_id === eventId),
        };
    });
    return room;
};
