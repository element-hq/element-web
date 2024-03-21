/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import {
    cleanUpBroadcasts,
    VoiceBroadcastPlayback,
    VoiceBroadcastPreRecording,
    VoiceBroadcastRecording,
} from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { TestSdkContext } from "../../TestSdkContext";
import { mkVoiceBroadcastPlayback, mkVoiceBroadcastPreRecording, mkVoiceBroadcastRecording } from "./test-utils";

describe("cleanUpBroadcasts", () => {
    let playback: VoiceBroadcastPlayback;
    let recording: VoiceBroadcastRecording;
    let preRecording: VoiceBroadcastPreRecording;
    let stores: TestSdkContext;

    beforeEach(() => {
        stores = new TestSdkContext();
        stores.client = stubClient();

        playback = mkVoiceBroadcastPlayback(stores);
        jest.spyOn(playback, "stop").mockReturnValue();
        stores.voiceBroadcastPlaybacksStore.setCurrent(playback);

        recording = mkVoiceBroadcastRecording(stores);
        jest.spyOn(recording, "stop").mockResolvedValue();
        stores.voiceBroadcastRecordingsStore.setCurrent(recording);

        preRecording = mkVoiceBroadcastPreRecording(stores);
        jest.spyOn(preRecording, "cancel").mockReturnValue();
        stores.voiceBroadcastPreRecordingStore.setCurrent(preRecording);
    });

    it("should stop and clear all broadcast related stuff", async () => {
        await cleanUpBroadcasts(stores);
        expect(playback.stop).toHaveBeenCalled();
        expect(stores.voiceBroadcastPlaybacksStore.getCurrent()).toBeNull();
        expect(recording.stop).toHaveBeenCalled();
        expect(stores.voiceBroadcastRecordingsStore.getCurrent()).toBeNull();
        expect(preRecording.cancel).toHaveBeenCalled();
        expect(stores.voiceBroadcastPreRecordingStore.getCurrent()).toBeNull();
    });
});
