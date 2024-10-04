/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent, TypedEventEmitter } from "matrix-js-sdk/src/matrix";

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
