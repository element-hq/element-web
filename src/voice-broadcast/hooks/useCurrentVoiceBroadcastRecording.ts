/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { VoiceBroadcastRecording, VoiceBroadcastRecordingsStore, VoiceBroadcastRecordingsStoreEvent } from "..";
import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";

export const useCurrentVoiceBroadcastRecording = (
    voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore,
): {
    currentVoiceBroadcastRecording: VoiceBroadcastRecording | null;
} => {
    const currentVoiceBroadcastRecording = useTypedEventEmitterState(
        voiceBroadcastRecordingsStore,
        VoiceBroadcastRecordingsStoreEvent.CurrentChanged,
        (recording?: VoiceBroadcastRecording) => {
            return recording ?? voiceBroadcastRecordingsStore.getCurrent();
        },
    );

    return {
        currentVoiceBroadcastRecording,
    };
};
