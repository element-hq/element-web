/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Voice Broadcast module
 * {@link https://github.com/vector-im/element-meta/discussions/632}
 */

export * from "./types";
export * from "./models/VoiceBroadcastPlayback";
export * from "./models/VoiceBroadcastPreRecording";
export * from "./models/VoiceBroadcastRecording";
export * from "./audio/VoiceBroadcastRecorder";
export * from "./components/VoiceBroadcastBody";
export * from "./components/atoms/LiveBadge";
export * from "./components/atoms/VoiceBroadcastControl";
export * from "./components/atoms/VoiceBroadcastError";
export * from "./components/atoms/VoiceBroadcastHeader";
export * from "./components/atoms/VoiceBroadcastPlaybackControl";
export * from "./components/atoms/VoiceBroadcastRecordingConnectionError";
export * from "./components/atoms/VoiceBroadcastRoomSubtitle";
export * from "./components/molecules/ConfirmListenBroadcastStopCurrent";
export * from "./components/molecules/VoiceBroadcastPlaybackBody";
export * from "./components/molecules/VoiceBroadcastSmallPlaybackBody";
export * from "./components/molecules/VoiceBroadcastPreRecordingPip";
export * from "./components/molecules/VoiceBroadcastRecordingBody";
export * from "./components/molecules/VoiceBroadcastRecordingPip";
export * from "./hooks/useCurrentVoiceBroadcastPreRecording";
export * from "./hooks/useCurrentVoiceBroadcastRecording";
export * from "./hooks/useHasRoomLiveVoiceBroadcast";
export * from "./hooks/useVoiceBroadcastRecording";
export * from "./stores/VoiceBroadcastPlaybacksStore";
export * from "./stores/VoiceBroadcastPreRecordingStore";
export * from "./stores/VoiceBroadcastRecordingsStore";
export * from "./utils/checkVoiceBroadcastPreConditions";
export * from "./utils/cleanUpBroadcasts";
export * from "./utils/doClearCurrentVoiceBroadcastPlaybackIfStopped";
export * from "./utils/doMaybeSetCurrentVoiceBroadcastPlayback";
export * from "./utils/getChunkLength";
export * from "./utils/getMaxBroadcastLength";
export * from "./utils/hasRoomLiveVoiceBroadcast";
export * from "./utils/isRelatedToVoiceBroadcast";
export * from "./utils/isVoiceBroadcastStartedEvent";
export * from "./utils/findRoomLiveVoiceBroadcastFromUserAndDevice";
export * from "./utils/retrieveStartedInfoEvent";
export * from "./utils/shouldDisplayAsVoiceBroadcastRecordingTile";
export * from "./utils/shouldDisplayAsVoiceBroadcastTile";
export * from "./utils/shouldDisplayAsVoiceBroadcastStoppedText";
export * from "./utils/startNewVoiceBroadcastRecording";
export * from "./utils/textForVoiceBroadcastStoppedEvent";
export * from "./utils/textForVoiceBroadcastStoppedEventWithoutLink";
export * from "./utils/VoiceBroadcastResumer";
