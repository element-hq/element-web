/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import EventEmitter from "events";
import { SimpleObservable } from "matrix-widget-api";

import { PlaybackState } from "../../../src/audio/Playback";

/**
 * A mocked playback implementation for testing purposes.
 * It simulates a playback with a fixed size and allows state changes.
 */
export class MockedPlayback extends EventEmitter {
    public sizeBytes = 8000;
    private waveformObservable = new SimpleObservable<number[]>();
    public liveData = new SimpleObservable<number[]>();

    public constructor(
        public currentState: PlaybackState,
        public durationSeconds: number,
        public timeSeconds: number,
    ) {
        super();
    }

    public setState(state: PlaybackState): void {
        this.currentState = state;
        this.emit("update", state);
    }

    public get isPlaying(): boolean {
        return this.currentState === PlaybackState.Playing;
    }

    public get clockInfo() {
        return {
            liveData: this.liveData,
            populatePlaceholdersFrom: () => undefined,
        };
    }

    public get waveform(): number[] {
        return [];
    }

    public get waveformData(): SimpleObservable<number[]> {
        return this.waveformObservable;
    }

    public prepare = jest.fn().mockResolvedValue(undefined);
    public skipTo = jest.fn();
    public toggle = jest.fn();
    public destroy = jest.fn().mockResolvedValue(undefined);
}
