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
import { ClientEvent, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import {
    findRoomLiveVoiceBroadcastFromUserAndDevice,
    resumeVoiceBroadcastInRoom,
    VoiceBroadcastInfoState,
    VoiceBroadcastResumer,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

jest.mock("../../../src/voice-broadcast/utils/findRoomLiveVoiceBroadcastFromUserAndDevice");
jest.mock("../../../src/voice-broadcast/utils/resumeVoiceBroadcastInRoom");

describe("VoiceBroadcastResumer", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let resumer: VoiceBroadcastResumer;
    let infoEvent: MatrixEvent;

    beforeEach(() => {
        client = stubClient();
        jest.spyOn(client, "off");
        room = new Room(roomId, client, client.getUserId());
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) return room;
        });
        resumer = new VoiceBroadcastResumer(client);
        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId(),
            client.getDeviceId(),
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("when there is no info event", () => {
        beforeEach(() => {
            client.emit(ClientEvent.Room, room);
        });

        it("should not resume a broadcast", () => {
            expect(resumeVoiceBroadcastInRoom).not.toHaveBeenCalled();
        });
    });

    describe("when there is an info event", () => {
        beforeEach(() => {
            mocked(findRoomLiveVoiceBroadcastFromUserAndDevice).mockImplementation((
                findRoom: Room,
                userId: string,
                deviceId: string,
            ) => {
                if (findRoom === room && userId === client.getUserId() && deviceId === client.getDeviceId()) {
                    return infoEvent;
                }
            });
            client.emit(ClientEvent.Room, room);
        });

        it("should resume a broadcast", () => {
            expect(resumeVoiceBroadcastInRoom).toHaveBeenCalledWith(
                infoEvent,
                room,
                client,
            );
        });

        describe("and emitting a room event again", () => {
            beforeEach(() => {
                client.emit(ClientEvent.Room, room);
            });

            it("should not resume the broadcast again", () => {
                expect(resumeVoiceBroadcastInRoom).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("when calling destroy", () => {
        beforeEach(() => {
            resumer.destroy();
        });

        it("should deregister from the client", () => {
            expect(client.off).toHaveBeenCalledWith(ClientEvent.Room, expect.any(Function));
        });
    });
});
