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

import { MatrixClient, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

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
