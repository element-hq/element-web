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

import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import {
    startNewVoiceBroadcastRecording,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";

jest.mock("../../../src/voice-broadcast/utils/startNewVoiceBroadcastRecording");

describe("VoiceBroadcastPreRecording", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let sender: RoomMember;
    let playbacksStore: VoiceBroadcastPlaybacksStore;
    let recordingsStore: VoiceBroadcastRecordingsStore;
    let preRecording: VoiceBroadcastPreRecording;
    let onDismiss: (voiceBroadcastPreRecording: VoiceBroadcastPreRecording) => void;

    beforeAll(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getUserId() || "");
        sender = new RoomMember(roomId, client.getUserId() || "");
        recordingsStore = new VoiceBroadcastRecordingsStore();
        playbacksStore = new VoiceBroadcastPlaybacksStore(recordingsStore);
    });

    beforeEach(() => {
        onDismiss = jest.fn();
        preRecording = new VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
        preRecording.on("dismiss", onDismiss);
    });

    describe("start", () => {
        beforeEach(() => {
            preRecording.start();
        });

        it("should start a new voice broadcast recording", () => {
            expect(startNewVoiceBroadcastRecording).toHaveBeenCalledWith(room, client, playbacksStore, recordingsStore);
        });

        it("should emit a dismiss event", () => {
            expect(onDismiss).toHaveBeenCalledWith(preRecording);
        });
    });

    describe("cancel", () => {
        beforeEach(() => {
            preRecording.cancel();
        });

        it("should emit a dismiss event", () => {
            expect(onDismiss).toHaveBeenCalledWith(preRecording);
        });
    });
});
