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

import { Mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import {
    M_POLL_START,
    PollAnswer,
    M_POLL_KIND_DISCLOSED,
    M_POLL_END,
    M_POLL_RESPONSE,
} from "matrix-js-sdk/src/@types/polls";
import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";
import { uuid4 } from "@sentry/utils";

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
        event_id: id || uuid4(),
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
        event_id: uuid4(),
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
