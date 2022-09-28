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

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { VoiceBroadcastRecording } from "..";

export enum VoiceBroadcastRecordingsStoreEvent {
    CurrentChanged = "current_changed",
}

interface EventMap {
    [VoiceBroadcastRecordingsStoreEvent.CurrentChanged]: (recording: VoiceBroadcastRecording) => void;
}

/**
 * This store provides access to the current and specific Voice Broadcast recordings.
 */
export class VoiceBroadcastRecordingsStore extends TypedEventEmitter<VoiceBroadcastRecordingsStoreEvent, EventMap> {
    private _current: VoiceBroadcastRecording | null;
    private recordings = new Map<string, VoiceBroadcastRecording>();

    public constructor() {
        super();
    }

    public setCurrent(current: VoiceBroadcastRecording): void {
        if (this._current === current) return;

        this._current = current;
        this.recordings.set(current.infoEvent.getId(), current);
        this.emit(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, current);
    }

    public get current(): VoiceBroadcastRecording {
        return this._current;
    }

    public getByInfoEvent(infoEvent: MatrixEvent, client: MatrixClient): VoiceBroadcastRecording {
        const infoEventId = infoEvent.getId();

        if (!this.recordings.has(infoEventId)) {
            this.recordings.set(infoEventId, new VoiceBroadcastRecording(infoEvent, client));
        }

        return this.recordings.get(infoEventId);
    }

    public static readonly _instance = new VoiceBroadcastRecordingsStore();

    /**
     * TODO Michael W: replace when https://github.com/matrix-org/matrix-react-sdk/pull/9293 has been merged
     */
    public static instance() {
        return VoiceBroadcastRecordingsStore._instance;
    }
}
