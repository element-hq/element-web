/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { GroupCall, MatrixCall, MatrixClient } from "../../../src";
import { MediaHandler, MediaHandlerEvent } from "../../../src/webrtc/mediaHandler";
import { MockMediaDeviceInfo, MockMediaDevices, MockMediaStream, MockMediaStreamTrack } from "../../test-utils/webrtc";

const FAKE_AUDIO_INPUT_ID = "aaaaaaaa";
const FAKE_VIDEO_INPUT_ID = "vvvvvvvv";
const FAKE_DESKTOP_SOURCE_ID = "ddddddd";

describe("Media Handler", function () {
    let mockMediaDevices: MockMediaDevices;
    let mediaHandler: MediaHandler;
    let calls: Map<string, MatrixCall>;
    let groupCalls: Map<string, GroupCall>;

    beforeEach(() => {
        mockMediaDevices = new MockMediaDevices();

        global.navigator = {
            mediaDevices: mockMediaDevices.typed(),
        } as unknown as Navigator;

        calls = new Map();
        groupCalls = new Map();

        mediaHandler = new MediaHandler({
            callEventHandler: {
                calls,
            },
            groupCallEventHandler: {
                groupCalls,
            },
        } as unknown as MatrixClient);
    });

    it("does not trigger update after restore media settings", () => {
        mediaHandler.restoreMediaSettings(FAKE_AUDIO_INPUT_ID, FAKE_VIDEO_INPUT_ID);

        expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    it("sets device IDs on restore media settings", async () => {
        mediaHandler.restoreMediaSettings(FAKE_AUDIO_INPUT_ID, FAKE_VIDEO_INPUT_ID);

        await mediaHandler.getUserMediaStream(true, true);
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                audio: expect.objectContaining({
                    deviceId: { ideal: FAKE_AUDIO_INPUT_ID },
                }),
                video: expect.objectContaining({
                    deviceId: { ideal: FAKE_VIDEO_INPUT_ID },
                }),
            }),
        );
    });

    it("sets audio device ID", async () => {
        await mediaHandler.setAudioInput(FAKE_AUDIO_INPUT_ID);

        await mediaHandler.getUserMediaStream(true, false);
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                audio: expect.objectContaining({
                    deviceId: { ideal: FAKE_AUDIO_INPUT_ID },
                }),
            }),
        );
    });

    it("sets audio settings", async () => {
        await mediaHandler.setAudioSettings({
            autoGainControl: false,
            echoCancellation: true,
            noiseSuppression: false,
        });

        await mediaHandler.getUserMediaStream(true, false);
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                audio: expect.objectContaining({
                    autoGainControl: { ideal: false },
                    echoCancellation: { ideal: true },
                    noiseSuppression: { ideal: false },
                }),
            }),
        );
    });

    it("sets video device ID", async () => {
        await mediaHandler.setVideoInput(FAKE_VIDEO_INPUT_ID);

        await mediaHandler.getUserMediaStream(false, true);
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                video: expect.objectContaining({
                    deviceId: { ideal: FAKE_VIDEO_INPUT_ID },
                }),
            }),
        );
    });

    it("sets media inputs", async () => {
        await mediaHandler.setMediaInputs(FAKE_AUDIO_INPUT_ID, FAKE_VIDEO_INPUT_ID);

        await mediaHandler.getUserMediaStream(true, true);
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
            expect.objectContaining({
                audio: expect.objectContaining({
                    deviceId: { ideal: FAKE_AUDIO_INPUT_ID },
                }),
                video: expect.objectContaining({
                    deviceId: { ideal: FAKE_VIDEO_INPUT_ID },
                }),
            }),
        );
    });

    describe("updateLocalUsermediaStreams", () => {
        let localStreamsChangedHandler: jest.Mock<void, []>;

        beforeEach(() => {
            localStreamsChangedHandler = jest.fn();
            mediaHandler.on(MediaHandlerEvent.LocalStreamsChanged, localStreamsChangedHandler);
        });

        afterEach(() => {
            mediaHandler.off(MediaHandlerEvent.LocalStreamsChanged, localStreamsChangedHandler);
        });

        it("does nothing if it has no streams", async () => {
            mediaHandler.updateLocalUsermediaStreams();
            expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
        });

        it("does not emit LocalStreamsChanged if it had no streams", async () => {
            await mediaHandler.updateLocalUsermediaStreams();

            expect(localStreamsChangedHandler).not.toHaveBeenCalled();
        });

        describe("with existing streams", () => {
            let stopTrack: jest.Mock<void, []>;
            let updateLocalUsermediaStream: jest.Mock;

            beforeEach(() => {
                stopTrack = jest.fn();

                mediaHandler.userMediaStreams = [
                    {
                        getTracks: () => [
                            {
                                stop: stopTrack,
                            } as unknown as MediaStreamTrack,
                        ],
                    } as unknown as MediaStream,
                ];

                updateLocalUsermediaStream = jest.fn();
            });

            it("stops existing streams", async () => {
                mediaHandler.updateLocalUsermediaStreams();
                expect(stopTrack).toHaveBeenCalled();
            });

            it("replaces streams on calls", async () => {
                calls.set("some_call", {
                    hasLocalUserMediaAudioTrack: true,
                    hasLocalUserMediaVideoTrack: true,
                    callHasEnded: jest.fn().mockReturnValue(false),
                    updateLocalUsermediaStream,
                } as unknown as MatrixCall);

                await mediaHandler.updateLocalUsermediaStreams();
                expect(updateLocalUsermediaStream).toHaveBeenCalled();
            });

            it("doesn't replace streams on ended calls", async () => {
                calls.set("some_call", {
                    hasLocalUserMediaAudioTrack: true,
                    hasLocalUserMediaVideoTrack: true,
                    callHasEnded: jest.fn().mockReturnValue(true),
                    updateLocalUsermediaStream,
                } as unknown as MatrixCall);

                await mediaHandler.updateLocalUsermediaStreams();
                expect(updateLocalUsermediaStream).not.toHaveBeenCalled();
            });

            it("replaces streams on group calls", async () => {
                groupCalls.set("some_group_call", {
                    localCallFeed: {},
                    updateLocalUsermediaStream,
                } as unknown as GroupCall);

                await mediaHandler.updateLocalUsermediaStreams();
                expect(updateLocalUsermediaStream).toHaveBeenCalled();
            });

            it("doesn't replace streams on group calls with no localCallFeed", async () => {
                groupCalls.set("some_group_call", {
                    localCallFeed: null,
                    updateLocalUsermediaStream,
                } as unknown as GroupCall);

                await mediaHandler.updateLocalUsermediaStreams();
                expect(updateLocalUsermediaStream).not.toHaveBeenCalled();
            });

            it("emits LocalStreamsChanged", async () => {
                await mediaHandler.updateLocalUsermediaStreams();

                expect(localStreamsChangedHandler).toHaveBeenCalled();
            });
        });
    });

    describe("hasAudioDevice", () => {
        it("returns true if the system has audio inputs", async () => {
            expect(await mediaHandler.hasAudioDevice()).toEqual(true);
        });

        it("returns false if the system has no audio inputs", async () => {
            mockMediaDevices.enumerateDevices.mockReturnValue(
                Promise.resolve([new MockMediaDeviceInfo("videoinput").typed()]),
            );
            expect(await mediaHandler.hasAudioDevice()).toEqual(false);
        });

        it("returns false if the system not permitting access audio inputs", async () => {
            mockMediaDevices.enumerateDevices.mockRejectedValueOnce(new Error("No Permission"));
            expect(await mediaHandler.hasAudioDevice()).toEqual(false);
        });
    });

    describe("hasVideoDevice", () => {
        it("returns true if the system has video inputs", async () => {
            expect(await mediaHandler.hasVideoDevice()).toEqual(true);
        });

        it("returns false if the system has no video inputs", async () => {
            mockMediaDevices.enumerateDevices.mockReturnValue(
                Promise.resolve([new MockMediaDeviceInfo("audioinput").typed()]),
            );
            expect(await mediaHandler.hasVideoDevice()).toEqual(false);
        });

        it("returns false if the system not permitting access video inputs", async () => {
            mockMediaDevices.enumerateDevices.mockRejectedValueOnce(new Error("No Permission"));
            expect(await mediaHandler.hasVideoDevice()).toEqual(false);
        });
    });

    describe("getUserMediaStream", () => {
        beforeEach(() => {
            // replace this with one that returns a new object each time so we can
            // tell whether we've ended up with the same stream
            mockMediaDevices.getUserMedia.mockImplementation((constraints: MediaStreamConstraints) => {
                const stream = new MockMediaStream("local_stream");
                if (constraints.audio) {
                    const track = new MockMediaStreamTrack("audio_track", "audio");
                    track.settings = { deviceId: FAKE_AUDIO_INPUT_ID };
                    stream.addTrack(track);
                }
                if (constraints.video) {
                    const track = new MockMediaStreamTrack("video_track", "video");
                    track.settings = { deviceId: FAKE_VIDEO_INPUT_ID };
                    stream.addTrack(track);
                }

                return Promise.resolve(stream.typed());
            });

            mediaHandler.restoreMediaSettings(FAKE_AUDIO_INPUT_ID, FAKE_VIDEO_INPUT_ID);
        });

        it("returns the same stream for reusable streams", async () => {
            const stream1 = await mediaHandler.getUserMediaStream(true, false);
            const stream2 = (await mediaHandler.getUserMediaStream(true, false)) as unknown as MockMediaStream;

            expect(stream2.isCloneOf(stream1)).toEqual(true);
        });

        it("doesn't re-use stream if reusable is false", async () => {
            const stream1 = await mediaHandler.getUserMediaStream(true, false, false);
            const stream2 = (await mediaHandler.getUserMediaStream(true, false)) as unknown as MockMediaStream;

            expect(stream2.isCloneOf(stream1)).toEqual(false);
        });

        it("doesn't re-use stream if existing stream lacks audio", async () => {
            const stream1 = await mediaHandler.getUserMediaStream(false, true);
            const stream2 = (await mediaHandler.getUserMediaStream(true, false)) as unknown as MockMediaStream;

            expect(stream2.isCloneOf(stream1)).toEqual(false);
        });

        it("doesn't re-use stream if existing stream lacks video", async () => {
            const stream1 = await mediaHandler.getUserMediaStream(true, false);
            const stream2 = (await mediaHandler.getUserMediaStream(false, true)) as unknown as MockMediaStream;

            expect(stream2.isCloneOf(stream1)).toEqual(false);
        });

        it("creates new stream when we no longer want audio", async () => {
            await mediaHandler.getUserMediaStream(true, true);
            const stream = await mediaHandler.getUserMediaStream(false, true);

            expect(stream.getAudioTracks().length).toEqual(0);
        });

        it("creates new stream when we no longer want video", async () => {
            await mediaHandler.getUserMediaStream(true, true);
            const stream = await mediaHandler.getUserMediaStream(true, false);

            expect(stream.getVideoTracks().length).toEqual(0);
        });
    });

    describe("getScreensharingStream", () => {
        it("gets any screen sharing stream when called with no args", async () => {
            const stream = await mediaHandler.getScreensharingStream();
            expect(stream).toBeTruthy();
            expect(stream.getTracks()).toBeTruthy();
        });

        it("re-uses streams", async () => {
            const stream = await mediaHandler.getScreensharingStream(undefined, true);

            expect(mockMediaDevices.getDisplayMedia).toHaveBeenCalled();
            mockMediaDevices.getDisplayMedia.mockClear();

            const stream2 = (await mediaHandler.getScreensharingStream()) as unknown as MockMediaStream;

            expect(mockMediaDevices.getDisplayMedia).not.toHaveBeenCalled();

            expect(stream2.isCloneOf(stream)).toEqual(true);
        });

        it("passes through desktopCapturerSourceId for Electron", async () => {
            await mediaHandler.getScreensharingStream({
                desktopCapturerSourceId: FAKE_DESKTOP_SOURCE_ID,
            });

            expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith(
                expect.objectContaining({
                    video: {
                        mandatory: expect.objectContaining({
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: FAKE_DESKTOP_SOURCE_ID,
                        }),
                    },
                }),
            );
        });

        it("emits LocalStreamsChanged", async () => {
            const onLocalStreamChanged = jest.fn();
            mediaHandler.on(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
            await mediaHandler.getScreensharingStream();
            expect(onLocalStreamChanged).toHaveBeenCalled();

            mediaHandler.off(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
        });
    });

    describe("stopUserMediaStream", () => {
        let stream: MediaStream;

        beforeEach(async () => {
            stream = await mediaHandler.getUserMediaStream(true, false);
        });

        it("stops tracks on streams", async () => {
            const mockTrack = new MockMediaStreamTrack("audio_track", "audio");
            stream.addTrack(mockTrack.typed());

            mediaHandler.stopUserMediaStream(stream);
            expect(mockTrack.stop).toHaveBeenCalled();
        });

        it("removes stopped streams", async () => {
            expect(mediaHandler.userMediaStreams).toContain(stream);
            mediaHandler.stopUserMediaStream(stream);
            expect(mediaHandler.userMediaStreams).not.toContain(stream);
        });

        it("emits LocalStreamsChanged", async () => {
            const onLocalStreamChanged = jest.fn();
            mediaHandler.on(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
            mediaHandler.stopUserMediaStream(stream);
            expect(onLocalStreamChanged).toHaveBeenCalled();

            mediaHandler.off(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
        });
    });

    describe("stopScreensharingStream", () => {
        let stream: MediaStream;

        beforeEach(async () => {
            stream = await mediaHandler.getScreensharingStream();
        });

        it("stops tracks on streams", async () => {
            const mockTrack = new MockMediaStreamTrack("audio_track", "audio");
            stream.addTrack(mockTrack.typed());

            mediaHandler.stopScreensharingStream(stream);
            expect(mockTrack.stop).toHaveBeenCalled();
        });

        it("removes stopped streams", async () => {
            expect(mediaHandler.screensharingStreams).toContain(stream);
            mediaHandler.stopScreensharingStream(stream);
            expect(mediaHandler.screensharingStreams).not.toContain(stream);
        });

        it("emits LocalStreamsChanged", async () => {
            const onLocalStreamChanged = jest.fn();
            mediaHandler.on(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
            mediaHandler.stopScreensharingStream(stream);
            expect(onLocalStreamChanged).toHaveBeenCalled();

            mediaHandler.off(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
        });
    });

    describe("stopAllStreams", () => {
        let userMediaStream: MediaStream;
        let screenSharingStream: MediaStream;

        beforeEach(async () => {
            userMediaStream = await mediaHandler.getUserMediaStream(true, false);
            screenSharingStream = await mediaHandler.getScreensharingStream();
        });

        it("stops tracks on streams", async () => {
            const mockUserMediaTrack = new MockMediaStreamTrack("audio_track", "audio");
            userMediaStream.addTrack(mockUserMediaTrack.typed());

            const mockScreenshareTrack = new MockMediaStreamTrack("audio_track", "audio");
            screenSharingStream.addTrack(mockScreenshareTrack.typed());

            mediaHandler.stopAllStreams();

            expect(mockUserMediaTrack.stop).toHaveBeenCalled();
            expect(mockScreenshareTrack.stop).toHaveBeenCalled();
        });

        it("removes stopped streams", async () => {
            expect(mediaHandler.userMediaStreams).toContain(userMediaStream);
            expect(mediaHandler.screensharingStreams).toContain(screenSharingStream);
            mediaHandler.stopAllStreams();
            expect(mediaHandler.userMediaStreams).not.toContain(userMediaStream);
            expect(mediaHandler.screensharingStreams).not.toContain(screenSharingStream);
        });

        it("emits LocalStreamsChanged", async () => {
            const onLocalStreamChanged = jest.fn();
            mediaHandler.on(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
            mediaHandler.stopAllStreams();
            expect(onLocalStreamChanged).toHaveBeenCalled();

            mediaHandler.off(MediaHandlerEvent.LocalStreamsChanged, onLocalStreamChanged);
        });
    });
});
