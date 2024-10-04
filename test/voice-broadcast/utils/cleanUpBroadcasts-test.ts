/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
