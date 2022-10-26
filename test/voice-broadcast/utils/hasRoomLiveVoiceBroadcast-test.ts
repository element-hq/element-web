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

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import {
    hasRoomLiveVoiceBroadcast,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("hasRoomLiveVoiceBroadcast", () => {
    const otherUserId = "@other:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;

    const addVoiceBroadcastInfoEvent = (
        state: VoiceBroadcastInfoState,
        sender: string,
    ) => {
        room.currentState.setStateEvents([
            mkVoiceBroadcastInfoStateEvent(
                room.roomId,
                state,
                sender,
                "ASD123",
            ),
        ]);
    };

    const itShouldReturnTrueTrue = () => {
        it("should return true/true", () => {
            expect(hasRoomLiveVoiceBroadcast(room, client.getUserId())).toEqual({
                hasBroadcast: true,
                startedByUser: true,
            });
        });
    };

    const itShouldReturnTrueFalse = () => {
        it("should return true/false", () => {
            expect(hasRoomLiveVoiceBroadcast(room, client.getUserId())).toEqual({
                hasBroadcast: true,
                startedByUser: false,
            });
        });
    };

    const itShouldReturnFalseFalse = () => {
        it("should return false/false", () => {
            expect(hasRoomLiveVoiceBroadcast(room, client.getUserId())).toEqual({
                hasBroadcast: false,
                startedByUser: false,
            });
        });
    };

    beforeAll(() => {
        client = stubClient();
    });

    beforeEach(() => {
        room = new Room(roomId, client, client.getUserId());
    });

    describe("when there is no voice broadcast info at all", () => {
        itShouldReturnFalseFalse();
    });

    describe("when the »state« prop is missing", () => {
        beforeEach(() => {
            room.currentState.setStateEvents([
                mkEvent({
                    event: true,
                    room: room.roomId,
                    user: client.getUserId(),
                    type: VoiceBroadcastInfoEventType,
                    skey: client.getUserId(),
                    content: {},
                }),
            ]);
        });
        itShouldReturnFalseFalse();
    });

    describe("when there is a live broadcast from the current and another user", () => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Started, client.getUserId());
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Started, otherUserId);
        });

        itShouldReturnTrueTrue();
    });

    describe("when there are only stopped info events", () => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped, client.getUserId());
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped, otherUserId);
        });

        itShouldReturnFalseFalse();
    });

    describe.each([
        // all there are kind of live states
        VoiceBroadcastInfoState.Started,
        VoiceBroadcastInfoState.Paused,
        VoiceBroadcastInfoState.Resumed,
    ])("when there is a live broadcast (%s) from the current user", (state: VoiceBroadcastInfoState) => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(state, client.getUserId());
        });

        itShouldReturnTrueTrue();
    });

    describe("when there was a live broadcast, that has been stopped", () => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Resumed, client.getUserId());
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped, client.getUserId());
        });

        itShouldReturnFalseFalse();
    });

    describe("when there is a live broadcast from another user", () => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Resumed, otherUserId);
        });

        itShouldReturnTrueFalse();
    });
});
