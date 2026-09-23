/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
// @ts-ignore
import Recorder from "opus-recorder/dist/recorder.min.js";
import { useMockMediaDevices } from "test-utils";

import { VoiceRecording, voiceRecorderOptions, highQualityRecorderOptions } from "./VoiceRecording";
import { createAudioContext } from "./compat";
import MediaDeviceHandler from "../MediaDeviceHandler";

vi.mock("opus-recorder/dist/recorder.min.js");
const RecorderMock = vi.mocked(Recorder);

vi.mock("./compat", () => ({
    createAudioContext: vi.fn(),
}));
const createAudioContextMock = vi.mocked(createAudioContext);

vi.mock("../MediaDeviceHandler");
const MediaDeviceHandlerMock = vi.mocked(MediaDeviceHandler);

/**
 * The tests here are heavily using access to private props.
 * While this is not so great, we can at lest test some behaviour easily this way.
 */
describe("VoiceRecording", () => {
    let recording: VoiceRecording;
    let recorderSecondsSpy: MockInstance;

    const itShouldNotCallStop = () => {
        it("should not call stop", () => {
            expect(recording.stop).not.toHaveBeenCalled();
        });
    };

    const simulateUpdate = (recorderSeconds: number) => {
        beforeEach(() => {
            recorderSecondsSpy.mockReturnValue(recorderSeconds);
            // @ts-ignore
            recording.processAudioUpdate(recorderSeconds);
        });
    };

    beforeEach(() => {
        useMockMediaDevices();
        recording = new VoiceRecording();
        // @ts-ignore
        recording.observable = {
            update: vi.fn(),
            close: vi.fn(),
        };
        vi.spyOn(recording, "stop").mockImplementation(() => Promise.resolve());
        recorderSecondsSpy = vi.spyOn(recording, "recorderSeconds", "get");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("when starting a recording", () => {
        beforeEach(() => {
            const mockAudioContext = {
                createMediaStreamSource: vi.fn().mockReturnValue({
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                }),
                createScriptProcessor: vi.fn().mockReturnValue({
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                }),
                destination: {},
                close: vi.fn(),
            };
            createAudioContextMock.mockReturnValue(mockAudioContext as unknown as AudioContext);
        });

        afterEach(async () => {
            await recording.stop();
        });

        it("should record high-quality audio if voice processing is disabled", async () => {
            MediaDeviceHandlerMock.getAudioNoiseSuppression.mockReturnValue(false);
            await recording.start();

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
                expect.objectContaining({
                    audio: expect.objectContaining({ noiseSuppression: { ideal: false } }),
                }),
            );
            expect(RecorderMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    encoderBitRate: highQualityRecorderOptions.bitrate,
                    encoderApplication: highQualityRecorderOptions.encoderApplication,
                }),
            );
        });

        it("should record normal-quality voice if voice processing is enabled", async () => {
            MediaDeviceHandlerMock.getAudioNoiseSuppression.mockReturnValue(true);
            await recording.start();

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
                expect.objectContaining({
                    audio: expect.objectContaining({ noiseSuppression: { ideal: true } }),
                }),
            );
            expect(RecorderMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    encoderBitRate: voiceRecorderOptions.bitrate,
                    encoderApplication: voiceRecorderOptions.encoderApplication,
                }),
            );
        });

        it("should request the selected microphone as an exact device constraint", async () => {
            MediaDeviceHandlerMock.getAudioInput.mockReturnValue("selected-mic");
            await recording.start();

            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
                expect.objectContaining({
                    audio: expect.objectContaining({ deviceId: { exact: "selected-mic" } }),
                }),
            );
        });

        it("should not force an exact microphone when default device is selected", async () => {
            MediaDeviceHandlerMock.getAudioInput.mockReturnValue("default");
            await recording.start();

            const constraints = vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls[0][0]!;
            expect(constraints.audio).toEqual(
                expect.not.objectContaining({
                    deviceId: expect.anything(),
                }),
            );
        });
    });

    describe("when recording", () => {
        beforeEach(() => {
            // @ts-ignore
            recording.recording = true;
        });

        describe("and there is an audio update and time left", () => {
            simulateUpdate(42);
            itShouldNotCallStop();
        });

        describe("and there is an audio update and time is up", () => {
            // one second above the limit
            simulateUpdate(901);

            it("should call stop", () => {
                expect(recording.stop).toHaveBeenCalled();
            });
        });

        describe("and the max length limit has been disabled", () => {
            beforeEach(() => {
                recording.disableMaxLength();
            });

            describe("and there is an audio update and time left", () => {
                simulateUpdate(42);
                itShouldNotCallStop();
            });

            describe("and there is an audio update and time is up", () => {
                // one second above the limit
                simulateUpdate(901);
                itShouldNotCallStop();
            });
        });
    });

    describe("when not recording", () => {
        describe("and there is an audio update and time left", () => {
            simulateUpdate(42);
            itShouldNotCallStop();
        });

        describe("and there is an audio update and time is up", () => {
            // one second above the limit
            simulateUpdate(901);
            itShouldNotCallStop();
        });
    });
});
