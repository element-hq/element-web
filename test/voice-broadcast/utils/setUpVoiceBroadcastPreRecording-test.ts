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
    checkVoiceBroadcastPreConditions,
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { setUpVoiceBroadcastPreRecording } from "../../../src/voice-broadcast/utils/setUpVoiceBroadcastPreRecording";
import { mkRoomMemberJoinEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

jest.mock("../../../src/voice-broadcast/utils/checkVoiceBroadcastPreConditions");

describe("setUpVoiceBroadcastPreRecording", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let userId: string;
    let room: Room;
    let preRecordingStore: VoiceBroadcastPreRecordingStore;
    let infoEvent: MatrixEvent;
    let playback: VoiceBroadcastPlayback;
    let playbacksStore: VoiceBroadcastPlaybacksStore;
    let recordingsStore: VoiceBroadcastRecordingsStore;
    let preRecording: VoiceBroadcastPreRecording | null;

    const itShouldNotCreateAPreRecording = () => {
        it("should return null", () => {
            expect(preRecording).toBeNull();
        });

        it("should not create a broadcast pre recording", () => {
            expect(preRecordingStore.getCurrent()).toBeNull();
        });
    };

    const setUpPreRecording = async () => {
        preRecording = await setUpVoiceBroadcastPreRecording(
            room,
            client,
            playbacksStore,
            recordingsStore,
            preRecordingStore,
        );
    };

    beforeEach(() => {
        client = stubClient();

        const clientUserId = client.getUserId();
        if (!clientUserId) fail("empty userId");
        userId = clientUserId;

        room = new Room(roomId, client, userId);
        infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.getDeviceId()!,
        );
        preRecording = null;
        preRecordingStore = new VoiceBroadcastPreRecordingStore();
        playback = new VoiceBroadcastPlayback(infoEvent, client);
        jest.spyOn(playback, "pause");
        playbacksStore = new VoiceBroadcastPlaybacksStore();
        recordingsStore = new VoiceBroadcastRecordingsStore();
    });

    describe("when the preconditions fail", () => {
        beforeEach(async () => {
            mocked(checkVoiceBroadcastPreConditions).mockResolvedValue(false);
            await setUpPreRecording();
        });

        itShouldNotCreateAPreRecording();
    });

    describe("when the preconditions pass", () => {
        beforeEach(() => {
            mocked(checkVoiceBroadcastPreConditions).mockResolvedValue(true);
        });

        describe("and there is no user id", () => {
            beforeEach(async () => {
                mocked(client.getUserId).mockReturnValue(null);
                await setUpPreRecording();
            });

            itShouldNotCreateAPreRecording();
        });

        describe("and there is no room member", () => {
            beforeEach(async () => {
                // check test precondition
                expect(room.getMember(userId)).toBeNull();
                await setUpPreRecording();
            });

            itShouldNotCreateAPreRecording();
        });

        describe("and there is a room member and listening to another broadcast", () => {
            beforeEach(() => {
                playbacksStore.setCurrent(playback);
                room.currentState.setStateEvents([mkRoomMemberJoinEvent(userId, roomId)]);
                setUpPreRecording();
            });

            it("should pause the current playback and create a voice broadcast pre-recording", () => {
                expect(playback.pause).toHaveBeenCalled();
                expect(playbacksStore.getCurrent()).toBeNull();

                expect(checkVoiceBroadcastPreConditions).toHaveBeenCalledWith(room, client, recordingsStore);
                expect(preRecording).toBeInstanceOf(VoiceBroadcastPreRecording);
            });
        });
    });
});
