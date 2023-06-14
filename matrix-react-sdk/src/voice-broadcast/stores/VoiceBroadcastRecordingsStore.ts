/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
    VoiceBroadcastRecordingState,
} from "..";

export enum VoiceBroadcastRecordingsStoreEvent {
    CurrentChanged = "current_changed",
}

interface EventMap {
    [VoiceBroadcastRecordingsStoreEvent.CurrentChanged]: (recording: VoiceBroadcastRecording | null) => void;
}

/**
 * This store provides access to the current and specific Voice Broadcast recordings.
 */
export class VoiceBroadcastRecordingsStore extends TypedEventEmitter<VoiceBroadcastRecordingsStoreEvent, EventMap> {
    private current: VoiceBroadcastRecording | null = null;
    private recordings = new Map<string, VoiceBroadcastRecording>();

    public constructor() {
        super();
    }

    public setCurrent(current: VoiceBroadcastRecording): void {
        if (this.current === current) return;

        const infoEventId = current.infoEvent.getId();

        if (!infoEventId) {
            throw new Error("Got broadcast info event without Id");
        }

        if (this.current) {
            this.current.off(VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
        }

        this.current = current;
        this.current.on(VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
        this.recordings.set(infoEventId, current);
        this.emit(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, current);
    }

    public getCurrent(): VoiceBroadcastRecording | null {
        return this.current;
    }

    public hasCurrent(): boolean {
        return this.current !== null;
    }

    public clearCurrent(): void {
        if (!this.current) return;

        this.current.off(VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
        this.current = null;
        this.emit(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, null);
    }

    public getByInfoEvent(infoEvent: MatrixEvent, client: MatrixClient): VoiceBroadcastRecording {
        const infoEventId = infoEvent.getId();

        if (!infoEventId) {
            throw new Error("Got broadcast info event without Id");
        }

        const recording = this.recordings.get(infoEventId) || new VoiceBroadcastRecording(infoEvent, client);
        this.recordings.set(infoEventId, recording);
        return recording;
    }

    private onCurrentStateChanged = (state: VoiceBroadcastRecordingState): void => {
        if (state === VoiceBroadcastInfoState.Stopped) {
            this.clearCurrent();
        }
    };
}
