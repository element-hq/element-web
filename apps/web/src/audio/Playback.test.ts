/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "matrix-js-sdk/src/logger";

import { createAudioContext, decodeOgg } from "./compat";
import { Playback, PlaybackState } from "./Playback";

vi.mock("../WorkerManager", () => ({
    WorkerManager: vi.fn(function () {
        return {
            call: vi.fn().mockResolvedValue({ waveform: [0, 0, 1, 1] }),
        };
    }),
}));

vi.mock("./compat", () => ({
    createAudioContext: vi.fn(),
    decodeOgg: vi.fn(),
}));

describe("Playback", () => {
    const mockAudioBufferSourceNode = {
        addEventListener: vi.fn(),
        connect: vi.fn(),
        start: vi.fn(),
    };
    const mockMediaElementSourceNode = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    };
    const mockAudioContext = {
        decodeAudioData: vi.fn(),
        suspend: vi.fn(),
        resume: vi.fn(),
        createBufferSource: vi.fn().mockReturnValue(mockAudioBufferSourceNode),
        createMediaElementSource: vi.fn().mockReturnValue(mockMediaElementSourceNode),
        currentTime: 1337,
    };

    const mockAudioBuffer = {
        duration: 99,
        getChannelData: vi.fn(),
    };

    const mockChannelData = new Float32Array();

    beforeEach(() => {
        vi.spyOn(logger, "error").mockRestore();
        mockAudioBufferSourceNode.addEventListener.mockClear();
        mockAudioBuffer.getChannelData.mockClear().mockReturnValue(mockChannelData);
        mockAudioContext.decodeAudioData.mockReset().mockResolvedValue(mockAudioBuffer);
        mockAudioContext.resume.mockClear().mockResolvedValue(undefined);
        mockAudioContext.suspend.mockClear().mockResolvedValue(undefined);
        vi.mocked(decodeOgg).mockClear().mockResolvedValue(new ArrayBuffer(1));
        vi.mocked(createAudioContext).mockReturnValue(mockAudioContext as unknown as AudioContext);
    });

    it("initialises correctly", () => {
        const buffer = new ArrayBuffer(8);

        const playback = new Playback(buffer);
        playback.clockInfo.durationSeconds = mockAudioBuffer.duration;

        expect(playback.sizeBytes).toEqual(8);
        expect(playback.clockInfo).toBeTruthy();
        expect(playback.liveData).toBe(playback.clockInfo.liveData);
        expect(playback.timeSeconds).toBe(1337 % 99);
        expect(playback.currentState).toEqual(PlaybackState.Decoding);
    });

    it("toggles playback on from stopped state", async () => {
        const buffer = new ArrayBuffer(8);
        const playback = new Playback(buffer);
        await playback.prepare();
        // state is Stopped
        await playback.toggle();

        expect(mockAudioBufferSourceNode.start).toHaveBeenCalled();
        expect(mockAudioContext.resume).toHaveBeenCalled();
        expect(playback.currentState).toEqual(PlaybackState.Playing);
    });

    it("toggles playback to paused from playing state", async () => {
        const buffer = new ArrayBuffer(8);
        const playback = new Playback(buffer);
        await playback.prepare();
        await playback.toggle();
        expect(playback.currentState).toEqual(PlaybackState.Playing);

        await playback.toggle();

        expect(mockAudioContext.suspend).toHaveBeenCalled();
        expect(playback.currentState).toEqual(PlaybackState.Paused);
    });

    it("stop playbacks", async () => {
        const buffer = new ArrayBuffer(8);
        const playback = new Playback(buffer);
        await playback.prepare();
        await playback.toggle();
        expect(playback.currentState).toEqual(PlaybackState.Playing);

        await playback.stop();

        expect(mockAudioContext.suspend).toHaveBeenCalled();
        expect(playback.currentState).toEqual(PlaybackState.Stopped);
    });

    it("stop when audio source ended", async () => {
        const buffer = new ArrayBuffer(8);
        const playback = new Playback(buffer);
        await playback.prepare();
        await playback.play();

        // Simulate the audio source ending by calling the 'ended' event listener
        const endedListener = mockAudioBufferSourceNode.addEventListener.mock.calls.find(
            (call) => call[0] === "ended",
        )![1];
        await endedListener();

        // AudioContext should be suspended
        expect(mockAudioContext.suspend).toHaveBeenCalled();
        // Playback state should be Stopped
        expect(playback.currentState).toEqual(PlaybackState.Stopped);
        // Clock should be reset to 0
        expect(playback.timeSeconds).toEqual(0);
    });

    describe("prepare()", () => {
        it("decodes audio data when not greater than 5mb", async () => {
            const buffer = new ArrayBuffer(8);

            const playback = new Playback(buffer);

            await playback.prepare();

            expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
            expect(mockAudioBuffer.getChannelData).toHaveBeenCalledWith(0);

            // clock was updated
            expect(playback.clockInfo.durationSeconds).toEqual(mockAudioBuffer.duration);
            expect(playback.durationSeconds).toEqual(mockAudioBuffer.duration);

            expect(playback.currentState).toEqual(PlaybackState.Stopped);
        });

        it("tries to decode ogg when decodeAudioData fails", async () => {
            // stub logger to keep console clean from expected error
            vi.spyOn(logger, "error").mockReturnValue(undefined);
            vi.spyOn(logger, "warn").mockReturnValue(undefined);

            const buffer = new ArrayBuffer(8);
            const decodingError = new Error("test");
            mockAudioContext.decodeAudioData
                .mockRejectedValueOnce(decodingError)
                .mockResolvedValueOnce(mockAudioBuffer);

            const playback = new Playback(buffer);

            await playback.prepare();

            expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(2);
            expect(decodeOgg).toHaveBeenCalled();

            // clock was updated
            expect(playback.clockInfo.durationSeconds).toEqual(mockAudioBuffer.duration);
            expect(playback.durationSeconds).toEqual(mockAudioBuffer.duration);

            expect(playback.currentState).toEqual(PlaybackState.Stopped);
        });

        it("hands the ogg fallback a buffer which decodeAudioData has not detached", async () => {
            // stub logger to keep console clean from expected error
            vi.spyOn(logger, "error").mockReturnValue(undefined);
            vi.spyOn(logger, "warn").mockReturnValue(undefined);

            const buffer = new ArrayBuffer(8);
            mockAudioContext.decodeAudioData
                .mockImplementationOnce((buf: ArrayBuffer) => {
                    // The real decodeAudioData detaches the buffer it is handed, even when it fails.
                    structuredClone(buf, { transfer: [buf] });
                    return Promise.reject(new Error("test"));
                })
                .mockResolvedValueOnce(mockAudioBuffer);
            // Constructing a view over a detached buffer throws, which is what decodeOgg does first.
            vi.mocked(decodeOgg).mockImplementationOnce(async (audioBuffer: ArrayBuffer) => {
                expect(() => new Uint8Array(audioBuffer)).not.toThrow();
                return new ArrayBuffer(1);
            });

            const playback = new Playback(buffer);

            await playback.prepare();

            expect(decodeOgg).toHaveBeenCalled();
            expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(2);
            expect(playback.currentState).toEqual(PlaybackState.Stopped);
        });

        it("does not try to re-decode audio", async () => {
            const buffer = new ArrayBuffer(8);
            const playback = new Playback(buffer);
            await playback.prepare();
            expect(playback.currentState).toEqual(PlaybackState.Stopped);

            await playback.prepare();

            // only called once in first prepare
            expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
        });
    });

    describe("audio larger than 5mb", () => {
        // Anything over 5mb is played through an <audio /> element rather than a decoded buffer
        const largeBuffer = (): ArrayBuffer => new ArrayBuffer(5 * 1024 * 1024 + 1);

        let element: ReturnType<typeof mockAudioElement>;

        /**
         * A stand-in for the <audio /> element Playback creates. Assigning `src` resolves the load
         * the same way the browser does, and listeners registered on it can be fired by hand.
         */
        const mockAudioElement = () => {
            const listeners = new Map<string, Set<() => void | Promise<void>>>();
            const el = {
                duration: 42,
                currentTime: 0,
                onloadeddata: undefined as undefined | (() => void),
                onerror: undefined as undefined | (() => void),
                play: vi.fn().mockResolvedValue(undefined),
                pause: vi.fn(),
                remove: vi.fn(),
                addEventListener: vi.fn((type: string, cb: () => void) => {
                    if (!listeners.has(type)) listeners.set(type, new Set());
                    listeners.get(type)!.add(cb);
                }),
                removeEventListener: vi.fn((type: string, cb: () => void) => {
                    listeners.get(type)?.delete(cb);
                }),
                listenerCount: (type: string): number => listeners.get(type)?.size ?? 0,
                fire: async (type: string): Promise<void> => {
                    for (const cb of listeners.get(type) ?? []) await cb();
                },
            };
            Object.defineProperty(el, "src", {
                set() {
                    el.onloadeddata?.();
                },
            });
            return el;
        };

        beforeEach(() => {
            element = mockAudioElement();
            vi.spyOn(document, "createElement").mockReturnValue(element as unknown as HTMLElement);
            global.URL.createObjectURL = vi.fn().mockReturnValue("blob:audio");
            global.URL.revokeObjectURL = vi.fn();
            mockAudioContext.createMediaElementSource.mockClear().mockReturnValue(mockMediaElementSourceNode);
            mockMediaElementSourceNode.connect.mockClear();
        });

        afterEach(() => {
            vi.mocked(document.createElement).mockRestore();
        });

        it("stops when the media element ends", async () => {
            const playback = new Playback(largeBuffer());
            await playback.prepare();
            await playback.play();
            expect(playback.currentState).toEqual(PlaybackState.Playing);

            await element.fire("ended");

            expect(mockAudioContext.suspend).toHaveBeenCalled();
            expect(playback.currentState).toEqual(PlaybackState.Stopped);
            expect(playback.timeSeconds).toEqual(0);
        });

        it("stops listening to the media element once destroyed", async () => {
            const playback = new Playback(largeBuffer());
            await playback.prepare();
            await playback.play();
            expect(element.listenerCount("ended")).toEqual(1);

            playback.destroy();

            expect(element.listenerCount("ended")).toEqual(0);
        });
    });
});
