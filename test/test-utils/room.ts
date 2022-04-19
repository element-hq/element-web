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
import {
    MatrixClient,
    MatrixEvent,
    EventType,
    Room,
} from "matrix-js-sdk/src/matrix";

import { mkEvent } from "./test-utils";

export const makeMembershipEvent = (
    roomId: string, userId: string, membership = 'join',
) => mkEvent({
    event: true,
    type: EventType.RoomMember,
    room: roomId,
    user: userId,
    skey: userId,
    content: { membership },
    ts: Date.now(),
});

/**
 * Creates a room
 * sets state events on the room
 * Sets client getRoom to return room
 * returns room
 */
export const makeRoomWithStateEvents = (
    stateEvents: MatrixEvent[] = [],
    { roomId, mockClient }: { roomId: string, mockClient: MockedObject<MatrixClient>}): Room => {
    const room1 = new Room(roomId, mockClient, '@user:server.org');
    room1.currentState.setStateEvents(stateEvents);
    mockClient.getRoom.mockReturnValue(room1);
    return room1;
};
