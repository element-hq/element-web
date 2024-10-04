/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { VoiceBroadcastPreRecordingStore } from "../stores/VoiceBroadcastPreRecordingStore";
import { VoiceBroadcastPreRecording } from "../models/VoiceBroadcastPreRecording";

export const useCurrentVoiceBroadcastPreRecording = (
    voiceBroadcastPreRecordingStore: VoiceBroadcastPreRecordingStore,
): {
    currentVoiceBroadcastPreRecording: VoiceBroadcastPreRecording | null;
} => {
    const currentVoiceBroadcastPreRecording = useTypedEventEmitterState(
        voiceBroadcastPreRecordingStore,
        "changed",
        (preRecording?: VoiceBroadcastPreRecording) => {
            return preRecording ?? voiceBroadcastPreRecordingStore.getCurrent();
        },
    );

    return {
        currentVoiceBroadcastPreRecording,
    };
};
