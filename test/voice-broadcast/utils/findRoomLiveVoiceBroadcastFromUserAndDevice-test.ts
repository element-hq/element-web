/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
