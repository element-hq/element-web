/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import { SDPStreamMetadataPurpose } from "./callEventTypes";
import { acquireContext, releaseContext } from "./audioContext";
import { MatrixClient } from "../client";
import { RoomMember } from "../models/room-member";
import { logger } from "../logger";
import { TypedEventEmitter } from "../models/typed-event-emitter";
import { CallEvent, CallState, MatrixCall } from "./call";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

export interface ICallFeedOpts {
    client: MatrixClient;
    roomId?: string;
    userId: string;
    deviceId: string | undefined;
    stream: MediaStream;
    purpose: SDPStreamMetadataPurpose;
    /**
     * Whether or not the remote SDPStreamMetadata says audio is muted
     */
    audioMuted: boolean;
    /**
     * Whether or not the remote SDPStreamMetadata says video is muted
     */
    videoMuted: boolean;
    /**
     * The MatrixCall which is the source of this CallFeed
     */
    call?: MatrixCall;
}

export enum CallFeedEvent {
    NewStream = "new_stream",
    MuteStateChanged = "mute_state_changed",
    LocalVolumeChanged = "local_volume_changed",
    VolumeChanged = "volume_changed",
    ConnectedChanged = "connected_changed",
    Speaking = "speaking",
    Disposed = "disposed",
}

type EventHandlerMap = {
    [CallFeedEvent.NewStream]: (stream: MediaStream) => void;
    [CallFeedEvent.MuteStateChanged]: (audioMuted: boolean, videoMuted: boolean) => void;
    [CallFeedEvent.LocalVolumeChanged]: (localVolume: number) => void;
    [CallFeedEvent.VolumeChanged]: (volume: number) => void;
    [CallFeedEvent.ConnectedChanged]: (connected: boolean) => void;
    [CallFeedEvent.Speaking]: (speaking: boolean) => void;
    [CallFeedEvent.Disposed]: () => void;
};

export class CallFeed extends TypedEventEmitter<CallFeedEvent, EventHandlerMap> {
    public stream: MediaStream;
    public sdpMetadataStreamId: string;
    public userId: string;
    public readonly deviceId: string | undefined;
    public purpose: SDPStreamMetadataPurpose;
    public speakingVolumeSamples: number[];

    private client: MatrixClient;
    private call?: MatrixCall;
    private roomId?: string;
    private audioMuted: boolean;
    private videoMuted: boolean;
    private localVolume = 1;
    private measuringVolumeActivity = false;
    private audioContext?: AudioContext;
    private analyser?: AnalyserNode;
    private frequencyBinCount?: Float32Array;
    private speakingThreshold = SPEAKING_THRESHOLD;
    private speaking = false;
    private volumeLooperTimeout?: ReturnType<typeof setTimeout>;
    private _disposed = false;
    private _connected = false;

    public constructor(opts: ICallFeedOpts) {
        super();

        this.client = opts.client;
        this.call = opts.call;
        this.roomId = opts.roomId;
        this.userId = opts.userId;
        this.deviceId = opts.deviceId;
        this.purpose = opts.purpose;
        this.audioMuted = opts.audioMuted;
        this.videoMuted = opts.videoMuted;
        this.speakingVolumeSamples = new Array(SPEAKING_SAMPLE_COUNT).fill(-Infinity);
        this.sdpMetadataStreamId = opts.stream.id;

        this.updateStream(null, opts.stream);
        this.stream = opts.stream; // updateStream does this, but this makes TS happier

        if (this.hasAudioTrack) {
            this.initVolumeMeasuring();
        }

        if (opts.call) {
            opts.call.addListener(CallEvent.State, this.onCallState);
            this.onCallState(opts.call.state);
        }
    }

    public get connected(): boolean {
        // Local feeds are always considered connected
        return this.isLocal() || this._connected;
    }

    private set connected(connected: boolean) {
        this._connected = connected;
        this.emit(CallFeedEvent.ConnectedChanged, this.connected);
    }

    public get hasAudioTrack(): boolean {
        return this.stream.getAudioTracks().length > 0;
    }

    private updateStream(oldStream: MediaStream | null, newStream: MediaStream): void {
        if (newStream === oldStream) return;

        const wasMeasuringVolumeActivity = this.measuringVolumeActivity;

        if (oldStream) {
            oldStream.removeEventListener("addtrack", this.onAddTrack);
            this.measureVolumeActivity(false);
        }

        this.stream = newStream;
        newStream.addEventListener("addtrack", this.onAddTrack);

        if (this.hasAudioTrack) {
            this.initVolumeMeasuring();
            if (wasMeasuringVolumeActivity) this.measureVolumeActivity(true);
        } else {
            this.measureVolumeActivity(false);
        }

        this.emit(CallFeedEvent.NewStream, this.stream);
    }

    private initVolumeMeasuring(): void {
        if (!this.hasAudioTrack) return;
        if (!this.audioContext) this.audioContext = acquireContext();

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.1;

        const mediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(this.stream);
        mediaStreamAudioSourceNode.connect(this.analyser);

        this.frequencyBinCount = new Float32Array(this.analyser.frequencyBinCount);
    }

    private onAddTrack = (): void => {
        this.emit(CallFeedEvent.NewStream, this.stream);
    };

    private onCallState = (state: CallState): void => {
        if (state === CallState.Connected) {
            this.connected = true;
        } else if (state === CallState.Connecting) {
            this.connected = false;
        }
    };

    /**
     * Returns callRoom member
     * @returns member of the callRoom
     */
    public getMember(): RoomMember | null {
        const callRoom = this.client.getRoom(this.roomId);
        return callRoom?.getMember(this.userId) ?? null;
    }

    /**
     * Returns true if CallFeed is local, otherwise returns false
     * @returns is local?
     */
    public isLocal(): boolean {
        return (
            this.userId === this.client.getUserId() &&
            (this.deviceId === undefined || this.deviceId === this.client.getDeviceId())
        );
    }

    /**
     * Returns true if audio is muted or if there are no audio
     * tracks, otherwise returns false
     * @returns is audio muted?
     */
    public isAudioMuted(): boolean {
        return this.stream.getAudioTracks().length === 0 || this.audioMuted;
    }

    /**
     * Returns true video is muted or if there are no video
     * tracks, otherwise returns false
     * @returns is video muted?
     */
    public isVideoMuted(): boolean {
        // We assume only one video track
        return this.stream.getVideoTracks().length === 0 || this.videoMuted;
    }

    public isSpeaking(): boolean {
        return this.speaking;
    }

    /**
     * Replaces the current MediaStream with a new one.
     * The stream will be different and new stream as remote parties are
     * concerned, but this can be used for convenience locally to set up
     * volume listeners automatically on the new stream etc.
     * @param newStream - new stream with which to replace the current one
     */
    public setNewStream(newStream: MediaStream): void {
        this.updateStream(this.stream, newStream);
    }

    /**
     * Set one or both of feed's internal audio and video video mute state
     * Either value may be null to leave it as-is
     * @param audioMuted - is the feed's audio muted?
     * @param videoMuted - is the feed's video muted?
     */
    public setAudioVideoMuted(audioMuted: boolean | null, videoMuted: boolean | null): void {
        if (audioMuted !== null) {
            if (this.audioMuted !== audioMuted) {
                this.speakingVolumeSamples.fill(-Infinity);
            }
            this.audioMuted = audioMuted;
        }
        if (videoMuted !== null) this.videoMuted = videoMuted;
        this.emit(CallFeedEvent.MuteStateChanged, this.audioMuted, this.videoMuted);
    }

    /**
     * Starts emitting volume_changed events where the emitter value is in decibels
     * @param enabled - emit volume changes
     */
    public measureVolumeActivity(enabled: boolean): void {
        if (enabled) {
            if (!this.analyser || !this.frequencyBinCount || !this.hasAudioTrack) return;

            this.measuringVolumeActivity = true;
            this.volumeLooper();
        } else {
            this.measuringVolumeActivity = false;
            this.speakingVolumeSamples.fill(-Infinity);
            this.emit(CallFeedEvent.VolumeChanged, -Infinity);
        }
    }

    public setSpeakingThreshold(threshold: number): void {
        this.speakingThreshold = threshold;
    }

    private volumeLooper = (): void => {
        if (!this.analyser) return;

        if (!this.measuringVolumeActivity) return;

        this.analyser.getFloatFrequencyData(this.frequencyBinCount!);

        let maxVolume = -Infinity;
        for (const volume of this.frequencyBinCount!) {
            if (volume > maxVolume) {
                maxVolume = volume;
            }
        }

        this.speakingVolumeSamples.shift();
        this.speakingVolumeSamples.push(maxVolume);

        this.emit(CallFeedEvent.VolumeChanged, maxVolume);

        let newSpeaking = false;

        for (const volume of this.speakingVolumeSamples) {
            if (volume > this.speakingThreshold) {
                newSpeaking = true;
                break;
            }
        }

        if (this.speaking !== newSpeaking) {
            this.speaking = newSpeaking;
            this.emit(CallFeedEvent.Speaking, this.speaking);
        }

        this.volumeLooperTimeout = setTimeout(this.volumeLooper, POLLING_INTERVAL);
    };

    public clone(): CallFeed {
        const mediaHandler = this.client.getMediaHandler();
        const stream = this.stream.clone();
        logger.log(`CallFeed clone() cloning stream (originalStreamId=${this.stream.id}, newStreamId${stream.id})`);

        if (this.purpose === SDPStreamMetadataPurpose.Usermedia) {
            mediaHandler.userMediaStreams.push(stream);
        } else {
            mediaHandler.screensharingStreams.push(stream);
        }

        return new CallFeed({
            client: this.client,
            roomId: this.roomId,
            userId: this.userId,
            deviceId: this.deviceId,
            stream,
            purpose: this.purpose,
            audioMuted: this.audioMuted,
            videoMuted: this.videoMuted,
        });
    }

    public dispose(): void {
        clearTimeout(this.volumeLooperTimeout);
        this.stream?.removeEventListener("addtrack", this.onAddTrack);
        this.call?.removeListener(CallEvent.State, this.onCallState);
        if (this.audioContext) {
            this.audioContext = undefined;
            this.analyser = undefined;
            releaseContext();
        }
        this._disposed = true;
        this.emit(CallFeedEvent.Disposed);
    }

    public get disposed(): boolean {
        return this._disposed;
    }

    private set disposed(value: boolean) {
        this._disposed = value;
    }

    public getLocalVolume(): number {
        return this.localVolume;
    }

    public setLocalVolume(localVolume: number): void {
        this.localVolume = localVolume;
        this.emit(CallFeedEvent.LocalVolumeChanged, localVolume);
    }
}
