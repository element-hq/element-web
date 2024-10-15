/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

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
