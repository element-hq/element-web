/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import fetchMock from "@fetch-mock/vitest";

import { BackgroundAudio } from "./BackgroundAudio";
import { createAudioContext } from "./compat";

vi.mock("./compat", () => ({
    createAudioContext: vi.fn(),
}));

describe("BackgroundAudio", () => {
    let audioContext: {
        createBufferSource: Mock;
        decodeAudioData: Mock;
        resume: Mock;
        suspend: Mock;
        setSinkId: Mock;
        destination: object;
    };

    /** The sources handed out by the mocked context, in the order they were created. */
    let sources: Array<{ start: Mock; disconnect: Mock; onended?: () => void }>;

    beforeEach(() => {
        sources = [];
        audioContext = {
            createBufferSource: vi.fn().mockImplementation(() => {
                const source = { start: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
                sources.push(source);
                return source;
            }),
            decodeAudioData: vi.fn().mockResolvedValue({}),
            resume: vi.fn().mockResolvedValue(undefined),
            suspend: vi.fn().mockResolvedValue(undefined),
            setSinkId: vi.fn().mockResolvedValue(undefined),
            destination: {},
        };
        vi.mocked(createAudioContext).mockReturnValue(audioContext as unknown as AudioContext);

        // Every sound is fetched before it is decoded, and the decoding is mocked out above, so the
        // bytes that come back never matter.
        fetchMock.mockReset();
        fetchMock.get("*", 200);
    });

    it("suspends the context once the sound has finished", async () => {
        const audio = new BackgroundAudio();

        await audio.play("sound.mp3");
        expect(audioContext.suspend).not.toHaveBeenCalled();

        sources[0].onended!();

        expect(audioContext.suspend).toHaveBeenCalled();
    });

    it("keeps playing a sound that outlasts one started before it", async () => {
        const audio = new BackgroundAudio();

        await audio.play("first.mp3");
        await audio.play("second.mp3");

        // The first sound finishes while the second is still going.
        sources[0].onended!();

        expect(audioContext.suspend).not.toHaveBeenCalled();

        sources[1].onended!();

        expect(audioContext.suspend).toHaveBeenCalledTimes(1);
    });

    describe("output device", () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        /** Pretend to be a browser whose AudioContext can (or can't) be routed to a specific output device. */
        const stubSinkIdSupport = (supported: boolean): void => {
            vi.stubGlobal(
                "AudioContext",
                supported
                    ? class {
                          public setSinkId(): void {}
                      }
                    : class {},
            );
        };

        it("plays on the requested output device", async () => {
            stubSinkIdSupport(true);
            const audio = new BackgroundAudio();

            await audio.play("sound.mp3", false, "speakers");

            expect(audioContext.setSinkId).toHaveBeenCalledWith("speakers");
            expect(audioContext.setSinkId.mock.invocationCallOrder[0]).toBeLessThan(
                sources[0].start.mock.invocationCallOrder[0],
            );
        });

        it("asks for the system default device with the empty string", async () => {
            stubSinkIdSupport(true);
            const audio = new BackgroundAudio();

            await audio.play("sound.mp3", false, "default");

            expect(audioContext.setSinkId).toHaveBeenCalledWith("");
        });

        it("falls back to the default device when the requested one is unavailable", async () => {
            stubSinkIdSupport(true);
            audioContext.setSinkId.mockRejectedValueOnce(new DOMException("Not found", "NotFoundError"));
            const audio = new BackgroundAudio();

            await audio.play("sound.mp3", false, "unplugged");

            expect(audioContext.setSinkId).toHaveBeenNthCalledWith(1, "unplugged");
            expect(audioContext.setSinkId).toHaveBeenNthCalledWith(2, "");
            expect(sources[0].start).toHaveBeenCalled();
        });

        it("leaves the output device alone when none is requested", async () => {
            stubSinkIdSupport(true);
            const audio = new BackgroundAudio();

            await audio.play("sound.mp3");

            expect(audioContext.setSinkId).not.toHaveBeenCalled();
        });

        it("still plays when the browser cannot choose an output device", async () => {
            stubSinkIdSupport(false);
            const audio = new BackgroundAudio();

            await audio.play("sound.mp3", false, "speakers");

            expect(audioContext.setSinkId).not.toHaveBeenCalled();
            expect(sources[0].start).toHaveBeenCalled();
        });
    });
});
