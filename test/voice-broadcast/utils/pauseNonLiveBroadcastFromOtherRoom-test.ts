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
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { pauseNonLiveBroadcastFromOtherRoom } from "../../../src/voice-broadcast/utils/pauseNonLiveBroadcastFromOtherRoom";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

describe("pauseNonLiveBroadcastFromOtherRoom", () => {
    const roomId = "!room:example.com";
    const roomId2 = "!room2@example.com";
    let room: Room;
    let client: MatrixClient;
    let playback: VoiceBroadcastPlayback;
    let playbacks: VoiceBroadcastPlaybacksStore;
    let recordings: VoiceBroadcastRecordingsStore;

    const mkPlayback = (infoState: VoiceBroadcastInfoState, roomId: string): VoiceBroadcastPlayback => {
        const infoEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            infoState,
            client.getSafeUserId(),
            client.getDeviceId()!,
        );
        const playback = new VoiceBroadcastPlayback(infoEvent, client, recordings);
        jest.spyOn(playback, "pause");
        playbacks.setCurrent(playback);
        return playback;
    };

    beforeEach(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getSafeUserId());
        recordings = new VoiceBroadcastRecordingsStore();
        playbacks = new VoiceBroadcastPlaybacksStore(recordings);
        jest.spyOn(playbacks, "clearCurrent");
    });

    afterEach(() => {
        playback?.destroy();
        playbacks.destroy();
    });

    describe("when there is no current playback", () => {
        it("should not clear the current playback", () => {
            pauseNonLiveBroadcastFromOtherRoom(room, playbacks);
            expect(playbacks.clearCurrent).not.toHaveBeenCalled();
        });
    });

    describe("when listening to a live broadcast in another room", () => {
        beforeEach(() => {
            playback = mkPlayback(VoiceBroadcastInfoState.Started, roomId2);
        });

        it("should not clear current / pause the playback", () => {
            pauseNonLiveBroadcastFromOtherRoom(room, playbacks);
            expect(playbacks.clearCurrent).not.toHaveBeenCalled();
            expect(playback.pause).not.toHaveBeenCalled();
        });
    });

    describe("when listening to a non-live broadcast in the same room", () => {
        beforeEach(() => {
            playback = mkPlayback(VoiceBroadcastInfoState.Stopped, roomId);
        });

        it("should not clear current / pause the playback", () => {
            pauseNonLiveBroadcastFromOtherRoom(room, playbacks);
            expect(playbacks.clearCurrent).not.toHaveBeenCalled();
            expect(playback.pause).not.toHaveBeenCalled();
        });
    });

    describe("when listening to a non-live broadcast in another room", () => {
        beforeEach(() => {
            playback = mkPlayback(VoiceBroadcastInfoState.Stopped, roomId2);
        });

        it("should clear current and pause the playback", () => {
            pauseNonLiveBroadcastFromOtherRoom(room, playbacks);
            expect(playbacks.getCurrent()).toBeNull();
            expect(playback.pause).toHaveBeenCalled();
        });
    });
});
