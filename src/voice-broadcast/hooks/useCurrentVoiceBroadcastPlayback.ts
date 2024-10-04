/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { VoiceBroadcastPlayback } from "../models/VoiceBroadcastPlayback";
import {
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlaybacksStoreEvent,
} from "../stores/VoiceBroadcastPlaybacksStore";

export const useCurrentVoiceBroadcastPlayback = (
    voiceBroadcastPlaybackStore: VoiceBroadcastPlaybacksStore,
): {
    currentVoiceBroadcastPlayback: VoiceBroadcastPlayback | null;
} => {
    const currentVoiceBroadcastPlayback = useTypedEventEmitterState(
        voiceBroadcastPlaybackStore,
        VoiceBroadcastPlaybacksStoreEvent.CurrentChanged,
        (playback?: VoiceBroadcastPlayback) => {
            return playback ?? voiceBroadcastPlaybackStore.getCurrent();
        },
    );

    return {
        currentVoiceBroadcastPlayback,
    };
};
