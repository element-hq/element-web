/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import { TypedEventEmitter } from "../models/typed-event-emitter";
import { GroupCallType, GroupCallState } from "../webrtc/groupCall";
import { logger } from "../logger";
import { MatrixClient } from "../client";

export enum MediaHandlerEvent {
    LocalStreamsChanged = "local_streams_changed",
}

export type MediaHandlerEventHandlerMap = {
    [MediaHandlerEvent.LocalStreamsChanged]: () => void;
};

export interface IScreensharingOpts {
    desktopCapturerSourceId?: string;
    audio?: boolean;
    // For electron screen capture, there are very few options for detecting electron
    // apart from inspecting the user agent or just trying getDisplayMedia() and
    // catching the failure, so we do the latter - this flag tells the function to just
    // throw an error so we can catch it in this case, rather than logging and emitting.
    throwOnFail?: boolean;
}

export interface AudioSettings {
    autoGainControl: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
}

export class MediaHandler extends TypedEventEmitter<
    MediaHandlerEvent.LocalStreamsChanged,
    MediaHandlerEventHandlerMap
> {
    private audioInput?: string;
    private audioSettings?: AudioSettings;
    private videoInput?: string;
    private localUserMediaStream?: MediaStream;
    public userMediaStreams: MediaStream[] = [];
    public screensharingStreams: MediaStream[] = [];

    // Promise chain to serialise calls to getMediaStream
    private getMediaStreamPromise?: Promise<MediaStream>;

    public constructor(private client: MatrixClient) {
        super();
    }

    public restoreMediaSettings(audioInput: string, videoInput: string): void {
        this.audioInput = audioInput;
        this.videoInput = videoInput;
    }

    /**
     * Set an audio input device to use for MatrixCalls
     * @param deviceId - the identifier for the device
     * undefined treated as unset
     */
    public async setAudioInput(deviceId: string): Promise<void> {
        logger.info(`MediaHandler setAudioInput() running (deviceId=${deviceId})`);

        if (this.audioInput === deviceId) return;

        this.audioInput = deviceId;
        await this.updateLocalUsermediaStreams();
    }

    /**
     * Set audio settings for MatrixCalls
     * @param opts - audio options to set
     */
    public async setAudioSettings(opts: AudioSettings): Promise<void> {
        logger.info(`MediaHandler setAudioSettings() running (opts=${JSON.stringify(opts)})`);

        this.audioSettings = Object.assign({}, opts) as AudioSettings;
        await this.updateLocalUsermediaStreams();
    }

    /**
     * Set a video input device to use for MatrixCalls
     * @param deviceId - the identifier for the device
     * undefined treated as unset
     */
    public async setVideoInput(deviceId: string): Promise<void> {
        logger.info(`MediaHandler setVideoInput() running (deviceId=${deviceId})`);

        if (this.videoInput === deviceId) return;

        this.videoInput = deviceId;
        await this.updateLocalUsermediaStreams();
    }

    /**
     * Set media input devices to use for MatrixCalls
     * @param audioInput - the identifier for the audio device
     * @param videoInput - the identifier for the video device
     * undefined treated as unset
     */
    public async setMediaInputs(audioInput: string, videoInput: string): Promise<void> {
        logger.log(`MediaHandler setMediaInputs() running (audioInput: ${audioInput} videoInput: ${videoInput})`);
        this.audioInput = audioInput;
        this.videoInput = videoInput;
        await this.updateLocalUsermediaStreams();
    }

    /*
     * Requests new usermedia streams and replace the old ones
     */
    public async updateLocalUsermediaStreams(): Promise<void> {
        if (this.userMediaStreams.length === 0) return;

        const callMediaStreamParams: Map<string, { audio: boolean; video: boolean }> = new Map();
        for (const call of this.client.callEventHandler!.calls.values()) {
            callMediaStreamParams.set(call.callId, {
                audio: call.hasLocalUserMediaAudioTrack,
                video: call.hasLocalUserMediaVideoTrack,
            });
        }

        for (const stream of this.userMediaStreams) {
            logger.log(`MediaHandler updateLocalUsermediaStreams() stopping all tracks (streamId=${stream.id})`);
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }

        this.userMediaStreams = [];
        this.localUserMediaStream = undefined;

        for (const call of this.client.callEventHandler!.calls.values()) {
            if (call.callHasEnded() || !callMediaStreamParams.has(call.callId)) {
                continue;
            }

            const { audio, video } = callMediaStreamParams.get(call.callId)!;

            logger.log(
                `MediaHandler updateLocalUsermediaStreams() calling getUserMediaStream() (callId=${call.callId})`,
            );
            const stream = await this.getUserMediaStream(audio, video);

            if (call.callHasEnded()) {
                continue;
            }

            await call.updateLocalUsermediaStream(stream);
        }

        for (const groupCall of this.client.groupCallEventHandler!.groupCalls.values()) {
            if (!groupCall.localCallFeed) {
                continue;
            }

            logger.log(
                `MediaHandler updateLocalUsermediaStreams() calling getUserMediaStream() (groupCallId=${groupCall.groupCallId})`,
            );
            const stream = await this.getUserMediaStream(true, groupCall.type === GroupCallType.Video);

            if (groupCall.state === GroupCallState.Ended) {
                continue;
            }

            await groupCall.updateLocalUsermediaStream(stream);
        }

        this.emit(MediaHandlerEvent.LocalStreamsChanged);
    }

    public async hasAudioDevice(): Promise<boolean> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter((device) => device.kind === "audioinput").length > 0;
        } catch (err) {
            logger.log(`MediaHandler hasAudioDevice() calling navigator.mediaDevices.enumerateDevices with error`, err);
            return false;
        }
    }

    public async hasVideoDevice(): Promise<boolean> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter((device) => device.kind === "videoinput").length > 0;
        } catch (err) {
            logger.log(`MediaHandler hasVideoDevice() calling navigator.mediaDevices.enumerateDevices with error`, err);
            return false;
        }
    }

    /**
     * @param audio - should have an audio track
     * @param video - should have a video track
     * @param reusable - is allowed to be reused by the MediaHandler
     * @returns based on passed parameters
     */
    public async getUserMediaStream(audio: boolean, video: boolean, reusable = true): Promise<MediaStream> {
        // Serialise calls, othertwise we can't sensibly re-use the stream
        if (this.getMediaStreamPromise) {
            this.getMediaStreamPromise = this.getMediaStreamPromise.then(() => {
                return this.getUserMediaStreamInternal(audio, video, reusable);
            });
        } else {
            this.getMediaStreamPromise = this.getUserMediaStreamInternal(audio, video, reusable);
        }

        return this.getMediaStreamPromise;
    }

    private async getUserMediaStreamInternal(audio: boolean, video: boolean, reusable: boolean): Promise<MediaStream> {
        const shouldRequestAudio = audio && (await this.hasAudioDevice());
        const shouldRequestVideo = video && (await this.hasVideoDevice());

        let stream: MediaStream;

        let canReuseStream = true;
        if (this.localUserMediaStream) {
            // This figures out if we can reuse the current localUsermediaStream
            // based on whether or not the "mute state" (presence of tracks of a
            // given kind) matches what is being requested
            if (shouldRequestAudio !== this.localUserMediaStream.getAudioTracks().length > 0) {
                canReuseStream = false;
            }
            if (shouldRequestVideo !== this.localUserMediaStream.getVideoTracks().length > 0) {
                canReuseStream = false;
            }

            // This code checks that the device ID is the same as the localUserMediaStream stream, but we update
            // the localUserMediaStream whenever the device ID changes (apart from when restoring) so it's not
            // clear why this would ever be different, unless there's a race.
            if (
                shouldRequestAudio &&
                this.localUserMediaStream.getAudioTracks()[0]?.getSettings()?.deviceId !== this.audioInput
            ) {
                canReuseStream = false;
            }
            if (
                shouldRequestVideo &&
                this.localUserMediaStream.getVideoTracks()[0]?.getSettings()?.deviceId !== this.videoInput
            ) {
                canReuseStream = false;
            }
        } else {
            canReuseStream = false;
        }

        if (!canReuseStream) {
            const constraints = this.getUserMediaContraints(shouldRequestAudio, shouldRequestVideo);
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            logger.log(
                `MediaHandler getUserMediaStreamInternal() calling getUserMediaStream (streamId=${
                    stream.id
                }, shouldRequestAudio=${shouldRequestAudio}, shouldRequestVideo=${shouldRequestVideo}, constraints=${JSON.stringify(
                    constraints,
                )})`,
            );

            for (const track of stream.getTracks()) {
                const settings = track.getSettings();

                if (track.kind === "audio") {
                    this.audioInput = settings.deviceId!;
                } else if (track.kind === "video") {
                    this.videoInput = settings.deviceId!;
                }
            }

            if (reusable) {
                this.localUserMediaStream = stream;
            }
        } else {
            stream = this.localUserMediaStream!.clone();
            logger.log(
                `MediaHandler getUserMediaStreamInternal() cloning (oldStreamId=${this.localUserMediaStream?.id} newStreamId=${stream.id} shouldRequestAudio=${shouldRequestAudio} shouldRequestVideo=${shouldRequestVideo})`,
            );

            if (!shouldRequestAudio) {
                for (const track of stream.getAudioTracks()) {
                    stream.removeTrack(track);
                }
            }

            if (!shouldRequestVideo) {
                for (const track of stream.getVideoTracks()) {
                    stream.removeTrack(track);
                }
            }
        }

        if (reusable) {
            this.userMediaStreams.push(stream);
        }

        this.emit(MediaHandlerEvent.LocalStreamsChanged);

        return stream;
    }

    /**
     * Stops all tracks on the provided usermedia stream
     */
    public stopUserMediaStream(mediaStream: MediaStream): void {
        logger.log(`MediaHandler stopUserMediaStream() stopping (streamId=${mediaStream.id})`);
        for (const track of mediaStream.getTracks()) {
            track.stop();
        }

        const index = this.userMediaStreams.indexOf(mediaStream);

        if (index !== -1) {
            logger.debug(
                `MediaHandler stopUserMediaStream() splicing usermedia stream out stream array (streamId=${mediaStream.id})`,
                mediaStream.id,
            );
            this.userMediaStreams.splice(index, 1);
        }

        this.emit(MediaHandlerEvent.LocalStreamsChanged);

        if (this.localUserMediaStream === mediaStream) {
            this.localUserMediaStream = undefined;
        }
    }

    /**
     * @param desktopCapturerSourceId - sourceId for Electron DesktopCapturer
     * @param reusable - is allowed to be reused by the MediaHandler
     * @returns based on passed parameters
     */
    public async getScreensharingStream(opts: IScreensharingOpts = {}, reusable = true): Promise<MediaStream> {
        let stream: MediaStream;

        if (this.screensharingStreams.length === 0) {
            const screenshareConstraints = this.getScreenshareContraints(opts);

            if (opts.desktopCapturerSourceId) {
                // We are using Electron
                logger.debug(
                    `MediaHandler getScreensharingStream() calling getUserMedia() (opts=${JSON.stringify(opts)})`,
                );
                stream = await navigator.mediaDevices.getUserMedia(screenshareConstraints);
            } else {
                // We are not using Electron
                logger.debug(
                    `MediaHandler getScreensharingStream() calling getDisplayMedia() (opts=${JSON.stringify(opts)})`,
                );
                stream = await navigator.mediaDevices.getDisplayMedia(screenshareConstraints);
            }
        } else {
            const matchingStream = this.screensharingStreams[this.screensharingStreams.length - 1];
            logger.log(`MediaHandler getScreensharingStream() cloning (streamId=${matchingStream.id})`);
            stream = matchingStream.clone();
        }

        if (reusable) {
            this.screensharingStreams.push(stream);
        }

        this.emit(MediaHandlerEvent.LocalStreamsChanged);

        return stream;
    }

    /**
     * Stops all tracks on the provided screensharing stream
     */
    public stopScreensharingStream(mediaStream: MediaStream): void {
        logger.debug(`MediaHandler stopScreensharingStream() stopping stream (streamId=${mediaStream.id})`);
        for (const track of mediaStream.getTracks()) {
            track.stop();
        }

        const index = this.screensharingStreams.indexOf(mediaStream);

        if (index !== -1) {
            logger.debug(`MediaHandler stopScreensharingStream() splicing stream out (streamId=${mediaStream.id})`);
            this.screensharingStreams.splice(index, 1);
        }

        this.emit(MediaHandlerEvent.LocalStreamsChanged);
    }

    /**
     * Stops all local media tracks
     */
    public stopAllStreams(): void {
        for (const stream of this.userMediaStreams) {
            logger.log(`MediaHandler stopAllStreams() stopping (streamId=${stream.id})`);
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }

        for (const stream of this.screensharingStreams) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
        }

        this.userMediaStreams = [];
        this.screensharingStreams = [];
        this.localUserMediaStream = undefined;

        this.emit(MediaHandlerEvent.LocalStreamsChanged);
    }

    private getUserMediaContraints(audio: boolean, video: boolean): MediaStreamConstraints {
        const isWebkit = !!navigator.webkitGetUserMedia;

        return {
            audio: audio
                ? {
                      deviceId: this.audioInput ? { ideal: this.audioInput } : undefined,
                      autoGainControl: this.audioSettings ? { ideal: this.audioSettings.autoGainControl } : undefined,
                      echoCancellation: this.audioSettings ? { ideal: this.audioSettings.echoCancellation } : undefined,
                      noiseSuppression: this.audioSettings ? { ideal: this.audioSettings.noiseSuppression } : undefined,
                  }
                : false,
            video: video
                ? {
                      deviceId: this.videoInput ? { ideal: this.videoInput } : undefined,
                      /* We want 640x360.  Chrome will give it only if we ask exactly,
                   FF refuses entirely if we ask exactly, so have to ask for ideal
                   instead
                   XXX: Is this still true?
                 */
                      width: isWebkit ? { exact: 640 } : { ideal: 640 },
                      height: isWebkit ? { exact: 360 } : { ideal: 360 },
                  }
                : false,
        };
    }

    private getScreenshareContraints(opts: IScreensharingOpts): DesktopCapturerConstraints {
        const { desktopCapturerSourceId, audio } = opts;
        if (desktopCapturerSourceId) {
            return {
                audio: audio ?? false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: desktopCapturerSourceId,
                    },
                },
            };
        } else {
            return {
                audio: audio ?? false,
                video: true,
            };
        }
    }
}
