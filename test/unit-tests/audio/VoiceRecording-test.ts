/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
// @ts-ignore
import Recorder from "opus-recorder/dist/recorder.min.js";

import { VoiceRecording, voiceRecorderOptions, highQualityRecorderOptions } from "../../../src/audio/VoiceRecording";
import { createAudioContext } from "../../..//src/audio/compat";
import MediaDeviceHandler from "../../../src/MediaDeviceHandler";
import { useMockMediaDevices } from "../../test-utils";

jest.mock("opus-recorder/dist/recorder.min.js");
const RecorderMock = mocked(Recorder);

jest.mock("../../../src/audio/compat", () => ({
    createAudioContext: jest.fn(),
}));
const createAudioContextMock = mocked(createAudioContext);

jest.mock("../../../src/MediaDeviceHandler");
const MediaDeviceHandlerMock = mocked(MediaDeviceHandler);

/**
 * The tests here are heavily using access to private props.
 * While this is not so great, we can at lest test some behaviour easily this way.
 */
describe("VoiceRecording", () => {
    let recording: VoiceRecording;
    let recorderSecondsSpy: jest.SpyInstance;

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
            update: jest.fn(),
            close: jest.fn(),
        };
        jest.spyOn(recording, "stop").mockImplementation();
        recorderSecondsSpy = jest.spyOn(recording, "recorderSeconds", "get");
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe("when starting a recording", () => {
        beforeEach(() => {
            const mockAudioContext = {
                createMediaStreamSource: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                }),
                createScriptProcessor: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                    addEventListener: jest.fn(),
                    removeEventListener: jest.fn(),
                }),
                destination: {},
                close: jest.fn(),
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
