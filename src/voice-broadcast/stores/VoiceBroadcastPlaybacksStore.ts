/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent, TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
    VoiceBroadcastRecordingsStore,
} from "..";
import { IDestroyable } from "../../utils/IDestroyable";

export enum VoiceBroadcastPlaybacksStoreEvent {
    CurrentChanged = "current_changed",
}

interface EventMap {
    [VoiceBroadcastPlaybacksStoreEvent.CurrentChanged]: (recording: VoiceBroadcastPlayback | null) => void;
}

/**
 * This store manages VoiceBroadcastPlaybacks:
 * - access the currently playing voice broadcast
 * - ensures that only once broadcast is playing at a time
 */
export class VoiceBroadcastPlaybacksStore
    extends TypedEventEmitter<VoiceBroadcastPlaybacksStoreEvent, EventMap>
    implements IDestroyable
{
    private current: VoiceBroadcastPlayback | null = null;

    /** Playbacks indexed by their info event id. */
    private playbacks = new Map<string, VoiceBroadcastPlayback>();

    public constructor(private recordings: VoiceBroadcastRecordingsStore) {
        super();
    }

    public setCurrent(current: VoiceBroadcastPlayback): void {
        if (this.current === current) return;

        this.current = current;
        this.addPlayback(current);
        this.emit(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, current);
    }

    public clearCurrent(): void {
        if (this.current === null) return;

        this.current = null;
        this.emit(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, null);
    }

    public getCurrent(): VoiceBroadcastPlayback | null {
        return this.current;
    }

    public getByInfoEvent(infoEvent: MatrixEvent, client: MatrixClient): VoiceBroadcastPlayback {
        const infoEventId = infoEvent.getId()!;

        if (!this.playbacks.has(infoEventId)) {
            this.addPlayback(new VoiceBroadcastPlayback(infoEvent, client, this.recordings));
        }

        return this.playbacks.get(infoEventId)!;
    }

    private addPlayback(playback: VoiceBroadcastPlayback): void {
        const infoEventId = playback.infoEvent.getId()!;

        if (this.playbacks.has(infoEventId)) return;

        this.playbacks.set(infoEventId, playback);
        playback.on(VoiceBroadcastPlaybackEvent.StateChanged, this.onPlaybackStateChanged);
    }

    private onPlaybackStateChanged = (state: VoiceBroadcastPlaybackState, playback: VoiceBroadcastPlayback): void => {
        switch (state) {
            case VoiceBroadcastPlaybackState.Buffering:
            case VoiceBroadcastPlaybackState.Playing:
                this.pauseExcept(playback);
                this.setCurrent(playback);
                break;
            case VoiceBroadcastPlaybackState.Stopped:
                this.clearCurrent();
                break;
        }
    };

    private pauseExcept(playbackNotToPause: VoiceBroadcastPlayback): void {
        for (const playback of this.playbacks.values()) {
            if (playback !== playbackNotToPause) {
                playback.pause();
            }
        }
    }

    public destroy(): void {
        this.removeAllListeners();

        for (const playback of this.playbacks.values()) {
            playback.off(VoiceBroadcastPlaybackEvent.StateChanged, this.onPlaybackStateChanged);
        }

        this.playbacks = new Map();
    }
}
