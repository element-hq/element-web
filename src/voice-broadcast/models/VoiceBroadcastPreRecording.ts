/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, Room, RoomMember, TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import { IDestroyable } from "../../utils/IDestroyable";
import { VoiceBroadcastPlaybacksStore } from "../stores/VoiceBroadcastPlaybacksStore";
import { VoiceBroadcastRecordingsStore } from "../stores/VoiceBroadcastRecordingsStore";
import { startNewVoiceBroadcastRecording } from "../utils/startNewVoiceBroadcastRecording";

type VoiceBroadcastPreRecordingEvent = "dismiss";

interface EventMap {
    dismiss: (voiceBroadcastPreRecording: VoiceBroadcastPreRecording) => void;
}

export class VoiceBroadcastPreRecording
    extends TypedEventEmitter<VoiceBroadcastPreRecordingEvent, EventMap>
    implements IDestroyable
{
    public constructor(
        public room: Room,
        public sender: RoomMember,
        private client: MatrixClient,
        private playbacksStore: VoiceBroadcastPlaybacksStore,
        private recordingsStore: VoiceBroadcastRecordingsStore,
    ) {
        super();
    }

    public start = async (): Promise<void> => {
        await startNewVoiceBroadcastRecording(this.room, this.client, this.playbacksStore, this.recordingsStore);
        this.emit("dismiss", this);
    };

    public cancel = (): void => {
        this.emit("dismiss", this);
    };

    public destroy(): void {
        this.removeAllListeners();
    }
}
