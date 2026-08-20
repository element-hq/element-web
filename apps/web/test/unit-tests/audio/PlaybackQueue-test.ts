/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked } from "jest-mock";
import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { PlaybackQueue } from "../../../src/audio/PlaybackQueue";
import { type Playback, PlaybackState } from "../../../src/audio/Playback";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { MockedPlayback } from "./MockedPlayback";
import { SDKContextClass } from "../../../src/contexts/SDKContextClass";

describe("PlaybackQueue", () => {
    let playbackQueue: PlaybackQueue;
    let mockRoom: Mocked<Room>;

    beforeEach(() => {
        mockRoom = {
            getMember: jest.fn(),
            // Reached for when a message finishes and the queue looks for the next voice message to
            // continue with; an empty timeline means there is nothing to continue to.
            getLiveTimeline: jest.fn().mockReturnValue({ getEvents: () => [] }),
        } as unknown as Mocked<Room>;
        playbackQueue = new PlaybackQueue(mockRoom, SDKContextClass.instance.roomViewStore);
    });

    /**
     * Enqueue a playback for an event id and hand back both, ready to be driven through states.
     */
    const enqueue = (eventId: string): { mxEvent: Mocked<MatrixEvent>; playback: MockedPlayback } => {
        const mxEvent = {
            getId: jest.fn().mockReturnValue(eventId),
        } as unknown as Mocked<MatrixEvent>;
        const playback = new MockedPlayback(PlaybackState.Stopped, 0, 0);
        playbackQueue.unsortedEnqueue(mxEvent, playback as unknown as Mocked<Playback>);
        return { mxEvent, playback };
    };

    it.each([
        [PlaybackState.Playing, true],
        [PlaybackState.Paused, true],
        [PlaybackState.Preparing, false],
        [PlaybackState.Decoding, false],
        [PlaybackState.Stopped, false],
    ])("should save (or not) the clock PlayBackState=%s expected=%s", (playbackState, expected) => {
        const mockEvent = {
            getId: jest.fn().mockReturnValue("$foo:bar"),
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
            getId: jest.fn().mockReturnValue("$foo:bar"),
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

    it("does not play a message which has been dequeued when the one after it finishes", () => {
        const deleted = enqueue("$deleted:bar");
        const other = enqueue("$other:bar");

        // The deleted message plays, then the user starts another one, which leaves the deleted one
        // sitting in the queue as the message to fall back to.
        deleted.playback.emit(UPDATE_EVENT as any, PlaybackState.Playing);
        other.playback.emit(UPDATE_EVENT as any, PlaybackState.Playing);

        // Redaction unmounts the tile, which lets the queue go before destroying the playback.
        playbackQueue.dequeue(deleted.mxEvent);

        other.playback.emit(UPDATE_EVENT as any, PlaybackState.Stopped);

        expect(deleted.playback.play).not.toHaveBeenCalled();
    });

    it("plays the message before it when the one after finishes", () => {
        const first = enqueue("$first:bar");
        const second = enqueue("$second:bar");

        first.playback.emit(UPDATE_EVENT as any, PlaybackState.Playing);
        second.playback.emit(UPDATE_EVENT as any, PlaybackState.Playing);
        second.playback.emit(UPDATE_EVENT as any, PlaybackState.Stopped);

        expect(first.playback.play).toHaveBeenCalled();
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
