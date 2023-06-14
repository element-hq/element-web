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

import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    findRoomLiveVoiceBroadcastFromUserAndDevice,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("findRoomLiveVoiceBroadcastFromUserAndDevice", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;

    const itShouldReturnNull = () => {
        it("should return null", () => {
            expect(
                findRoomLiveVoiceBroadcastFromUserAndDevice(room, client.getUserId()!, client.getDeviceId()!),
            ).toBeNull();
        });
    };

    beforeAll(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId()!);
        jest.spyOn(room.currentState, "getStateEvents");
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) return room;
            return null;
        });
    });

    describe("when there is no info event", () => {
        itShouldReturnNull();
    });

    describe("when there is an info event without content", () => {
        beforeEach(() => {
            room.currentState.setStateEvents([
                mkEvent({
                    event: true,
                    type: VoiceBroadcastInfoEventType,
                    room: roomId,
                    user: client.getUserId()!,
                    content: {},
                }),
            ]);
        });

        itShouldReturnNull();
    });

    describe("when there is a stopped info event", () => {
        beforeEach(() => {
            room.currentState.setStateEvents([
                mkVoiceBroadcastInfoStateEvent(
                    roomId,
                    VoiceBroadcastInfoState.Stopped,
                    client.getUserId()!,
                    client.getDeviceId(),
                ),
            ]);
        });

        itShouldReturnNull();
    });

    describe("when there is a started info event from another device", () => {
        beforeEach(() => {
            const event = mkVoiceBroadcastInfoStateEvent(
                roomId,
                VoiceBroadcastInfoState.Stopped,
                client.getUserId()!,
                "JKL123",
            );
            room.currentState.setStateEvents([event]);
        });

        itShouldReturnNull();
    });

    describe("when there is a started info event", () => {
        let event: MatrixEvent;

        beforeEach(() => {
            event = mkVoiceBroadcastInfoStateEvent(
                roomId,
                VoiceBroadcastInfoState.Started,
                client.getUserId()!,
                client.getDeviceId(),
            );
            room.currentState.setStateEvents([event]);
        });

        it("should return this event", () => {
            expect(room.currentState.getStateEvents).toHaveBeenCalledWith(
                VoiceBroadcastInfoEventType,
                client.getUserId()!,
            );

            expect(findRoomLiveVoiceBroadcastFromUserAndDevice(room, client.getUserId()!, client.getDeviceId()!)).toBe(
                event,
            );
        });
    });
});
