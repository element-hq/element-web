/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { logger } from "matrix-js-sdk/src/logger";
import { fireEvent, render, type RenderResult } from "jest-matrix-react";

import RecordingPlayback, {
    PlaybackLayout,
} from "../../../../../src/components/views/audio_messages/RecordingPlayback";
import { Playback } from "../../../../../src/audio/Playback";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { createAudioContext } from "../../../../../src/audio/compat";
import { flushPromises } from "../../../../test-utils";
import { type IRoomState } from "../../../../../src/components/structures/RoomView";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("../../../../../src/WorkerManager", () => ({
    WorkerManager: jest.fn(() => ({
        call: jest.fn().mockResolvedValue({ waveform: [0, 0, 1, 1] }),
    })),
}));

jest.mock("../../../../../src/audio/compat", () => ({
    createAudioContext: jest.fn(),
    decodeOgg: jest.fn().mockResolvedValue({}),
}));

describe("<RecordingPlayback />", () => {
    const mockAudioBufferSourceNode = {
        addEventListener: jest.fn(),
        connect: jest.fn(),
        start: jest.fn(),
    };

    const mockAudioContext = {
        decodeAudioData: jest.fn(),
        suspend: jest.fn(),
        resume: jest.fn(),
        currentTime: 0,
        createBufferSource: jest.fn().mockReturnValue(mockAudioBufferSourceNode),
    };

    const mockAudioBuffer = {
        duration: 99,
        getChannelData: jest.fn(),
    };

    const mockChannelData = new Float32Array();

    const defaultRoom = { roomId: "!room:server.org", timelineRenderingType: TimelineRenderingType.File } as IRoomState;
    const getComponent = (props: React.ComponentProps<typeof RecordingPlayback>, room = defaultRoom) =>
        render(
            <ScopedRoomContextProvider {...room}>
                <RecordingPlayback {...props} />
            </ScopedRoomContextProvider>,
        );

    beforeEach(() => {
        jest.spyOn(logger, "error").mockRestore();
        mockAudioBuffer.getChannelData.mockClear().mockReturnValue(mockChannelData);
        mockAudioContext.decodeAudioData.mockReset().mockImplementation((_b, callback) => callback(mockAudioBuffer));
        mocked(createAudioContext).mockReturnValue(mockAudioContext as unknown as AudioContext);
    });

    const getPlayButton = (component: RenderResult) => component.getByTestId("play-pause-button");

    it("renders recording playback", () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        expect(component).toBeTruthy();
    });

    it("disables play button while playback is decoding", async () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        expect(getPlayButton(component)).toHaveAttribute("disabled");
        expect(getPlayButton(component)).toHaveAttribute("aria-disabled", "true");
    });

    it("enables play button when playback is finished decoding", async () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        await flushPromises();
        expect(getPlayButton(component)).not.toHaveAttribute("disabled");
        expect(getPlayButton(component)).not.toHaveAttribute("aria-disabled", "true");
    });

    it("displays error when playback decoding fails", async () => {
        // stub logger to keep console clean from expected error
        jest.spyOn(logger, "error").mockReturnValue(undefined);
        jest.spyOn(logger, "warn").mockReturnValue(undefined);
        mockAudioContext.decodeAudioData.mockImplementation((_b, _cb, error) => error(new Error("oh no")));
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        await flushPromises();
        expect(component.container.querySelector(".text-warning")).toBeDefined();
    });

    it("displays pre-prepared playback with correct playback phase", async () => {
        const playback = new Playback(new ArrayBuffer(8));
        await playback.prepare();
        const component = getComponent({ playback });
        // playback already decoded, button is not disabled
        expect(getPlayButton(component)).not.toHaveAttribute("disabled");
        expect(getPlayButton(component)).not.toHaveAttribute("aria-disabled", "true");
        expect(component.container.querySelector(".text-warning")).toBeFalsy();
    });

    it("toggles playback on play pause button click", async () => {
        const playback = new Playback(new ArrayBuffer(8));
        jest.spyOn(playback, "toggle").mockResolvedValue(undefined);
        await playback.prepare();
        const component = getComponent({ playback });

        fireEvent.click(getPlayButton(component));

        expect(playback.toggle).toHaveBeenCalled();
    });

    describe("Composer Layout", () => {
        it("should have a waveform, no seek bar, and clock", () => {
            const playback = new Playback(new ArrayBuffer(8));
            const component = getComponent({ playback, layout: PlaybackLayout.Composer });

            expect(component.container.querySelector(".mx_Clock")).toBeDefined();
            expect(component.container.querySelector(".mx_Waveform")).toBeDefined();
            expect(component.container.querySelector(".mx_SeekBar")).toBeFalsy();
        });
    });

    describe("Timeline Layout", () => {
        it("should have a waveform, a seek bar, and clock", () => {
            const playback = new Playback(new ArrayBuffer(8));
            const component = getComponent({ playback, layout: PlaybackLayout.Timeline });

            expect(component.container.querySelector(".mx_Clock")).toBeDefined();
            expect(component.container.querySelector(".mx_Waveform")).toBeDefined();
            expect(component.container.querySelector(".mx_SeekBar")).toBeDefined();
        });

        it("should be the default", () => {
            const playback = new Playback(new ArrayBuffer(8));
            const component = getComponent({ playback }); // no layout set for test

            expect(component.container.querySelector(".mx_Clock")).toBeDefined();
            expect(component.container.querySelector(".mx_Waveform")).toBeDefined();
            expect(component.container.querySelector(".mx_SeekBar")).toBeDefined();
        });
    });
});
