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

import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { VoiceBroadcastPreRecording } from "..";
import { IDestroyable } from "../../utils/IDestroyable";

export type VoiceBroadcastPreRecordingEvent = "changed";

interface EventMap {
    changed: (preRecording: VoiceBroadcastPreRecording | null) => void;
}

export class VoiceBroadcastPreRecordingStore
    extends TypedEventEmitter<VoiceBroadcastPreRecordingEvent, EventMap>
    implements IDestroyable
{
    private current: VoiceBroadcastPreRecording | null = null;

    public setCurrent(current: VoiceBroadcastPreRecording): void {
        if (this.current === current) return;

        if (this.current) {
            this.current.off("dismiss", this.onCancel);
        }

        this.current = current;
        current.on("dismiss", this.onCancel);
        this.emit("changed", current);
    }

    public clearCurrent(): void {
        if (this.current === null) return;

        this.current.off("dismiss", this.onCancel);
        this.current = null;
        this.emit("changed", null);
    }

    public getCurrent(): VoiceBroadcastPreRecording | null {
        return this.current;
    }

    public destroy(): void {
        this.removeAllListeners();

        if (this.current) {
            this.current.off("dismiss", this.onCancel);
        }
    }

    private onCancel = (voiceBroadcastPreRecording: VoiceBroadcastPreRecording): void => {
        if (this.current === voiceBroadcastPreRecording) {
            this.clearCurrent();
        }
    };
}
