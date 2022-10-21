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
    resumeVoiceBroadcastInRoom,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../utils/test-utils";

const mockRecording = jest.fn();

jest.mock("../../../src/voice-broadcast/models/VoiceBroadcastRecording", () => ({
    ...jest.requireActual("../../../src/voice-broadcast/models/VoiceBroadcastRecording") as object,
    VoiceBroadcastRecording: jest.fn().mockImplementation(() => mockRecording),
}));

describe("resumeVoiceBroadcastInRoom", () => {
    let client: MatrixClient;
    const roomId = "!room:example.com";
    let room: Room;
    let startedInfoEvent: MatrixEvent;
    let stoppedInfoEvent: MatrixEvent;

    const itShouldStartAPausedRecording = () => {
        it("should start a paused recording", () => {
            expect(VoiceBroadcastRecording).toHaveBeenCalledWith(
                startedInfoEvent,
                client,
                VoiceBroadcastInfoState.Paused,
            );
            expect(VoiceBroadcastRecordingsStore.instance().setCurrent).toHaveBeenCalledWith(mockRecording);
        });
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId());
        jest.spyOn(room, "findEventById");
        jest.spyOn(VoiceBroadcastRecordingsStore.instance(), "setCurrent").mockImplementation();

        startedInfoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId(),
            client.getDeviceId(),
        );

        stoppedInfoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            client.getUserId(),
            client.getDeviceId(),
            startedInfoEvent,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("when called with a stopped info event", () => {
        describe("and there is a related event", () => {
            beforeEach(() => {
                mocked(room.findEventById).mockReturnValue(startedInfoEvent);
                resumeVoiceBroadcastInRoom(stoppedInfoEvent, room, client);
            });

            itShouldStartAPausedRecording();
        });

        describe("and there is no related event", () => {
            beforeEach(() => {
                mocked(room.findEventById).mockReturnValue(null);
                resumeVoiceBroadcastInRoom(stoppedInfoEvent, room, client);
            });

            it("should not start a broadcast", () => {
                expect(VoiceBroadcastRecording).not.toHaveBeenCalled();
                expect(VoiceBroadcastRecordingsStore.instance().setCurrent).not.toHaveBeenCalled();
            });
        });
    });

    describe("when called with a started info event", () => {
        beforeEach(() => {
            resumeVoiceBroadcastInRoom(startedInfoEvent, room, client);
        });

        itShouldStartAPausedRecording();
    });
});
