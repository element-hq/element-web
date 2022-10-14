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

import { VoiceBroadcastPlayback } from "..";

export enum VoiceBroadcastPlaybacksStoreEvent {
    CurrentChanged = "current_changed",
}

interface EventMap {
    [VoiceBroadcastPlaybacksStoreEvent.CurrentChanged]: (recording: VoiceBroadcastPlayback) => void;
}

/**
 * This store provides access to the current and specific Voice Broadcast playbacks.
 */
export class VoiceBroadcastPlaybacksStore extends TypedEventEmitter<VoiceBroadcastPlaybacksStoreEvent, EventMap> {
    private current: VoiceBroadcastPlayback | null;
    private playbacks = new Map<string, VoiceBroadcastPlayback>();

    public constructor() {
        super();
    }

    public setCurrent(current: VoiceBroadcastPlayback): void {
        if (this.current === current) return;

        this.current = current;
        this.playbacks.set(current.infoEvent.getId(), current);
        this.emit(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, current);
    }

    public getCurrent(): VoiceBroadcastPlayback {
        return this.current;
    }

    public getByInfoEvent(infoEvent: MatrixEvent, client: MatrixClient): VoiceBroadcastPlayback {
        const infoEventId = infoEvent.getId();

        if (!this.playbacks.has(infoEventId)) {
            this.playbacks.set(infoEventId, new VoiceBroadcastPlayback(infoEvent, client));
        }

        return this.playbacks.get(infoEventId);
    }

    public static readonly _instance = new VoiceBroadcastPlaybacksStore();

    /**
     * TODO Michael W: replace when https://github.com/matrix-org/matrix-react-sdk/pull/9293 has been merged
     */
    public static instance() {
        return VoiceBroadcastPlaybacksStore._instance;
    }
}
