/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
