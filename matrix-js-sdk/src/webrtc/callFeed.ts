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

import EventEmitter from "events";

import { SDPStreamMetadataPurpose } from "./callEventTypes";
import { MatrixClient } from "../client";
import { RoomMember } from "../models/room-member";

const POLLING_INTERVAL = 200; // ms
export const SPEAKING_THRESHOLD = -60; // dB
const SPEAKING_SAMPLE_COUNT = 8; // samples

export interface ICallFeedOpts {
    client: MatrixClient;
    roomId: string;
    userId: string;
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
}

export enum CallFeedEvent {
    NewStream = "new_stream",
    MuteStateChanged = "mute_state_changed",
    VolumeChanged = "volume_changed",
    Speaking = "speaking",
}

export class CallFeed extends EventEmitter {
    public stream: MediaStream;
    public userId: string;
    public purpose: SDPStreamMetadataPurpose;
    public speakingVolumeSamples: number[];

    private client: MatrixClient;
    private roomId: string;
    private audioMuted: boolean;
    private videoMuted: boolean;
    private measuringVolumeActivity = false;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private frequencyBinCount: Float32Array;
    private speakingThreshold = SPEAKING_THRESHOLD;
    private speaking = false;
    private volumeLooperTimeout: number;

    constructor(opts: ICallFeedOpts) {
        super();

        this.client = opts.client;
        this.roomId = opts.roomId;
        this.userId = opts.userId;
        this.purpose = opts.purpose;
        this.audioMuted = opts.audioMuted;
        this.videoMuted = opts.videoMuted;
        this.speakingVolumeSamples = new Array(SPEAKING_SAMPLE_COUNT).fill(-Infinity);

        this.updateStream(null, opts.stream);

        if (this.hasAudioTrack) {
            this.initVolumeMeasuring();
        }
    }

    private get hasAudioTrack(): boolean {
        return this.stream.getAudioTracks().length > 0;
    }

    private updateStream(oldStream: MediaStream, newStream: MediaStream): void {
        if (newStream === oldStream) return;

        if (oldStream) {
            oldStream.removeEventListener("addtrack", this.onAddTrack);
            this.measureVolumeActivity(false);
        }
        if (newStream) {
            this.stream = newStream;
            newStream.addEventListener("addtrack", this.onAddTrack);

            if (this.hasAudioTrack) {
                this.initVolumeMeasuring();
            } else {
                this.measureVolumeActivity(false);
            }
        }

        this.emit(CallFeedEvent.NewStream, this.stream);
    }

    private initVolumeMeasuring(): void {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!this.hasAudioTrack || !AudioContext) return;

        this.audioContext = new AudioContext();

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

    /**
     * Returns callRoom member
     * @returns member of the callRoom
     */
    public getMember(): RoomMember {
        const callRoom = this.client.getRoom(this.roomId);
        return callRoom.getMember(this.userId);
    }

    /**
     * Returns true if CallFeed is local, otherwise returns false
     * @returns {boolean} is local?
     */
    public isLocal(): boolean {
        return this.userId === this.client.getUserId();
    }

    /**
     * Returns true if audio is muted or if there are no audio
     * tracks, otherwise returns false
     * @returns {boolean} is audio muted?
     */
    public isAudioMuted(): boolean {
        return this.stream.getAudioTracks().length === 0 || this.audioMuted;
    }

    /**
     * Returns true video is muted or if there are no video
     * tracks, otherwise returns false
     * @returns {boolean} is video muted?
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
     * This method should be only used by MatrixCall.
     * @param newStream new stream with which to replace the current one
     */
    public setNewStream(newStream: MediaStream): void {
        this.updateStream(this.stream, newStream);
    }

    /**
     * Set feed's internal audio mute state
     * @param muted is the feed's audio muted?
     */
    public setAudioMuted(muted: boolean): void {
        this.audioMuted = muted;
        this.speakingVolumeSamples.fill(-Infinity);
        this.emit(CallFeedEvent.MuteStateChanged, this.audioMuted, this.videoMuted);
    }

    /**
     * Set feed's internal video mute state
     * @param muted is the feed's video muted?
     */
    public setVideoMuted(muted: boolean): void {
        this.videoMuted = muted;
        this.emit(CallFeedEvent.MuteStateChanged, this.audioMuted, this.videoMuted);
    }

    /**
     * Starts emitting volume_changed events where the emitter value is in decibels
     * @param enabled emit volume changes
     */
    public measureVolumeActivity(enabled: boolean): void {
        if (enabled) {
            if (!this.audioContext || !this.analyser || !this.frequencyBinCount || !this.hasAudioTrack) return;

            this.measuringVolumeActivity = true;
            this.volumeLooper();
        } else {
            this.measuringVolumeActivity = false;
            this.speakingVolumeSamples.fill(-Infinity);
            this.emit(CallFeedEvent.VolumeChanged, -Infinity);
        }
    }

    public setSpeakingThreshold(threshold: number) {
        this.speakingThreshold = threshold;
    }

    private volumeLooper = () => {
        if (!this.analyser) return;

        if (!this.measuringVolumeActivity) return;

        this.analyser.getFloatFrequencyData(this.frequencyBinCount);

        let maxVolume = -Infinity;
        for (let i = 0; i < this.frequencyBinCount.length; i++) {
            if (this.frequencyBinCount[i] > maxVolume) {
                maxVolume = this.frequencyBinCount[i];
            }
        }

        this.speakingVolumeSamples.shift();
        this.speakingVolumeSamples.push(maxVolume);

        this.emit(CallFeedEvent.VolumeChanged, maxVolume);

        let newSpeaking = false;

        for (let i = 0; i < this.speakingVolumeSamples.length; i++) {
            const volume = this.speakingVolumeSamples[i];

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

    public dispose(): void {
        clearTimeout(this.volumeLooperTimeout);
    }
}
