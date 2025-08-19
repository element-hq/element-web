/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import EventEmitter from "events";
import { SimpleObservable } from "matrix-widget-api";
import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { waitFor } from "@testing-library/dom";

import { type Playback, PlaybackState } from "../../../src/audio/Playback";
import { AudioPlayerViewModel } from "../../../src/viewmodels/audio/AudioPlayerViewModel";

describe("AudioPlayerViewModel", () => {
    let playback: MockedPlayback & Playback;
    beforeEach(() => {
        playback = new MockedPlayback(PlaybackState.Decoding, 50, 10) as unknown as MockedPlayback & Playback;
    });

    it("should return the snapshot", () => {
        const vm = new AudioPlayerViewModel({ playback, mediaName: "mediaName" });
        expect(vm.getSnapshot()).toMatchObject({
            mediaName: "mediaName",
            sizeBytes: 8000,
            playbackState: "decoding",
            durationSeconds: 50,
            playedSeconds: 10,
            percentComplete: 20,
            error: false,
        });
    });

    it("should toggle the playback state", async () => {
        const vm = new AudioPlayerViewModel({ playback, mediaName: "mediaName" });

        await vm.togglePlay();
        expect(playback.toggle).toHaveBeenCalled();
    });

    it("should move the playback on seekbar change", async () => {
        const vm = new AudioPlayerViewModel({ playback, mediaName: "mediaName" });
        await vm.onSeekbarChange({ target: { value: "20" } } as ChangeEvent<HTMLInputElement>);
        expect(playback.skipTo).toHaveBeenCalledWith(10); // 20% of 50 seconds
    });

    it("should has error=true when playback.prepare fails", async () => {
        jest.spyOn(playback, "prepare").mockRejectedValue(new Error("Failed to prepare playback"));
        const vm = new AudioPlayerViewModel({ playback, mediaName: "mediaName" });
        await waitFor(() => expect(vm.getSnapshot().error).toBe(true));
    });

    it("should handle key down events", () => {
        const vm = new AudioPlayerViewModel({ playback, mediaName: "mediaName" });
        let event = new KeyboardEvent("keydown", { key: " " }) as unknown as ReactKeyboardEvent<HTMLDivElement>;
        vm.onKeyDown(event);
        expect(playback.toggle).toHaveBeenCalled();

        event = new KeyboardEvent("keydown", { key: "ArrowLeft" }) as unknown as ReactKeyboardEvent<HTMLDivElement>;
        vm.onKeyDown(event);
        expect(playback.skipTo).toHaveBeenCalledWith(10 - 5); // 5 seconds back

        event = new KeyboardEvent("keydown", { key: "ArrowRight" }) as unknown as ReactKeyboardEvent<HTMLDivElement>;
        vm.onKeyDown(event);
        expect(playback.skipTo).toHaveBeenCalledWith(10 + 5); // 5 seconds forward
    });
});

/**
 * A mocked playback implementation for testing purposes.
 * It simulates a playback with a fixed size and allows state changes.
 */
class MockedPlayback extends EventEmitter {
    public sizeBytes = 8000;

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
            liveData: new SimpleObservable(),
        };
    }

    public prepare = jest.fn().mockResolvedValue(undefined);
    public skipTo = jest.fn();
    public toggle = jest.fn();
}
