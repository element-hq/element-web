/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { PlaybackQueue } from "./PlaybackQueue";
import { type Playback, PlaybackState } from "./Playback";
import { UPDATE_EVENT } from "../stores/AsyncStore";
import { MockedPlayback } from "./__mocks__";
import { SDKContextClass } from "../contexts/SDKContextClass";

describe("PlaybackQueue", () => {
    let playbackQueue: PlaybackQueue;
    let mockRoom: Mocked<Room>;

    beforeEach(() => {
        mockRoom = {
            getMember: vi.fn(),
        } as unknown as Mocked<Room>;
        playbackQueue = new PlaybackQueue(mockRoom, SDKContextClass.instance.roomViewStore);
    });

    it.each([
        [PlaybackState.Playing, true],
        [PlaybackState.Paused, true],
        [PlaybackState.Preparing, false],
        [PlaybackState.Decoding, false],
        [PlaybackState.Stopped, false],
    ])("should save (or not) the clock PlayBackState=%s expected=%s", (playbackState, expected) => {
        const mockEvent = {
            getId: vi.fn().mockReturnValue("$foo:bar"),
        } as unknown as Mocked<MatrixEvent>;
        const mockPlayback = new MockedPlayback(playbackState, 0, 0) as unknown as Mocked<Playback>;

        // Enqueue
        playbackQueue.unsortedEnqueue(mockEvent, mockPlayback);

        // Emit our clockInfo of 0, which will playbackQueue to save the state.
        mockPlayback.clockInfo.liveData.update([1]);

        // @ts-ignore
        expect(playbackQueue.clockStates.has(mockEvent.getId()!)).toBe(expected);
    });

    it("does call skipTo on playback if clock advances to 1s", () => {
        const mockEvent = {
            getId: vi.fn().mockReturnValue("$foo:bar"),
        } as unknown as Mocked<MatrixEvent>;
        const mockPlayback = new MockedPlayback(PlaybackState.Playing, 0, 0) as unknown as Mocked<Playback>;

        // Enqueue
        playbackQueue.unsortedEnqueue(mockEvent, mockPlayback);

        // Emit our clockInfo of 0, which will playbackQueue to save the state.
        mockPlayback.clockInfo.liveData.update([1]);

        // Fire an update event to say that we have stopped.
        // Note that Playback really emits an UPDATE_EVENT whenever state changes, the types are lies.
        mockPlayback.emit(UPDATE_EVENT as any, PlaybackState.Stopped);

        expect(mockPlayback.skipTo).toHaveBeenCalledWith(1);
    });

    it("should ignore the nullish clock state when loading", () => {
        const clockStates = new Map([
            ["a", 1],
            ["b", null],
            ["c", 3],
        ]);
        localStorage.setItem(
            `mx_voice_message_clocks_${mockRoom.roomId}`,
            JSON.stringify(Array.from(clockStates.entries())),
        );
        playbackQueue = new PlaybackQueue(mockRoom, SDKContextClass.instance.roomViewStore);

        // @ts-ignore
        expect(playbackQueue.clockStates.has("a")).toBe(true);
        // @ts-ignore
        expect(playbackQueue.clockStates.has("b")).toBe(false);
        // @ts-ignore
        expect(playbackQueue.clockStates.has("c")).toBe(true);
    });
});
