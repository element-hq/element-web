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
    hasRoomLiveVoiceBroadcast,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("hasRoomLiveVoiceBroadcast", () => {
    const otherUserId = "@other:example.com";
    const otherDeviceId = "ASD123";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let expectedEvent: MatrixEvent | null = null;

    const addVoiceBroadcastInfoEvent = (
        state: VoiceBroadcastInfoState,
        userId: string,
        deviceId: string,
        startedEvent?: MatrixEvent,
    ): MatrixEvent => {
        const infoEvent = mkVoiceBroadcastInfoStateEvent(room.roomId, state, userId, deviceId, startedEvent);
        room.addLiveEvents([infoEvent]);
        room.currentState.setStateEvents([infoEvent]);
        room.relations.aggregateChildEvent(infoEvent);
        return infoEvent;
    };

    const itShouldReturnTrueTrue = () => {
        it("should return true/true", async () => {
            expect(await hasRoomLiveVoiceBroadcast(client, room, client.getSafeUserId())).toEqual({
                hasBroadcast: true,
                infoEvent: expectedEvent,
                startedByUser: true,
            });
        });
    };

    const itShouldReturnTrueFalse = () => {
        it("should return true/false", async () => {
            expect(await hasRoomLiveVoiceBroadcast(client, room, client.getSafeUserId())).toEqual({
                hasBroadcast: true,
                infoEvent: expectedEvent,
                startedByUser: false,
            });
        });
    };

    const itShouldReturnFalseFalse = () => {
        it("should return false/false", async () => {
            expect(await hasRoomLiveVoiceBroadcast(client, room, client.getSafeUserId())).toEqual({
                hasBroadcast: false,
                infoEvent: null,
                startedByUser: false,
            });
        });
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation((roomId: string): Room | null => {
            return roomId === room.roomId ? room : null;
        });
        expectedEvent = null;
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
                    user: client.getSafeUserId(),
                    type: VoiceBroadcastInfoEventType,
                    skey: client.getSafeUserId(),
                    content: {},
                }),
            ]);
        });
        itShouldReturnFalseFalse();
    });

    describe("when there is a live broadcast from the current and another user", () => {
        beforeEach(() => {
            expectedEvent = addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Started,
                client.getSafeUserId(),
                client.getDeviceId()!,
            );
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Started, otherUserId, otherDeviceId);
        });

        itShouldReturnTrueTrue();
    });

    describe("when there are only stopped info events", () => {
        beforeEach(() => {
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped, client.getSafeUserId(), client.getDeviceId()!);
            addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped, otherUserId, otherDeviceId);
        });

        itShouldReturnFalseFalse();
    });

    describe("when there is a live, started broadcast from the current user", () => {
        beforeEach(() => {
            expectedEvent = addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Started,
                client.getSafeUserId(),
                client.getDeviceId()!,
            );
        });

        itShouldReturnTrueTrue();
    });

    describe("when there is a live, paused broadcast from the current user", () => {
        beforeEach(() => {
            expectedEvent = addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Started,
                client.getSafeUserId(),
                client.getDeviceId()!,
            );
            addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Paused,
                client.getSafeUserId(),
                client.getDeviceId()!,
                expectedEvent,
            );
        });

        itShouldReturnTrueTrue();
    });

    describe("when there is a live, resumed broadcast from the current user", () => {
        beforeEach(() => {
            expectedEvent = addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Started,
                client.getSafeUserId(),
                client.getDeviceId()!,
            );
            addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Resumed,
                client.getSafeUserId(),
                client.getDeviceId()!,
                expectedEvent,
            );
        });

        itShouldReturnTrueTrue();
    });

    describe("when there was a live broadcast, that has been stopped", () => {
        beforeEach(() => {
            const startedEvent = addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Started,
                client.getSafeUserId(),
                client.getDeviceId()!,
            );
            addVoiceBroadcastInfoEvent(
                VoiceBroadcastInfoState.Stopped,
                client.getSafeUserId(),
                client.getDeviceId()!,
                startedEvent,
            );
        });

        itShouldReturnFalseFalse();
    });

    describe("when there is a live broadcast from another user", () => {
        beforeEach(() => {
            expectedEvent = addVoiceBroadcastInfoEvent(VoiceBroadcastInfoState.Started, otherUserId, otherDeviceId);
        });

        itShouldReturnTrueFalse();
    });
});
