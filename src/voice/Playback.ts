/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {UPDATE_EVENT} from "../stores/AsyncStore";

export enum PlaybackState {
    Decoding = "decoding",
    Stopped = "stopped", // no progress on timeline
    Paused = "paused", // some progress on timeline
    Playing = "playing", // active progress through timeline
}

export class Playback extends EventEmitter {
    private context: AudioContext;
    private source: AudioBufferSourceNode;
    private state = PlaybackState.Decoding;
    private audioBuf: AudioBuffer;

    constructor(private buf: ArrayBuffer) {
        super();
        this.context = new AudioContext();
    }

    public emit(event: PlaybackState, ...args: any[]): boolean {
        this.state = event;
        super.emit(event, ...args);
        super.emit(UPDATE_EVENT, event, ...args);
        return true; // we don't ever care if the event had listeners, so just return "yes"
    }

    public async prepare() {
        this.audioBuf = await this.context.decodeAudioData(this.buf);
        this.emit(PlaybackState.Stopped); // signal that we're not decoding anymore
    }

    public get currentState(): PlaybackState {
        return this.state;
    }

    public get isPlaying(): boolean {
        return this.currentState === PlaybackState.Playing;
    }

    private onPlaybackEnd = async () => {
        await this.context.suspend();
        this.emit(PlaybackState.Stopped);
    };

    public async play() {
        // We can't restart a buffer source, so we need to create a new one if we hit the end
        if (this.state === PlaybackState.Stopped) {
            if (this.source) {
                this.source.disconnect();
                this.source.removeEventListener("ended", this.onPlaybackEnd);
            }

            this.source = this.context.createBufferSource();
            this.source.connect(this.context.destination);
            this.source.buffer = this.audioBuf;
            this.source.start(); // start immediately
            this.source.addEventListener("ended", this.onPlaybackEnd);
        }

        // We use the context suspend/resume functions because it allows us to pause a source
        // node, but that still doesn't help us when the source node runs out (see above).
        await this.context.resume();
        this.emit(PlaybackState.Playing);
    }

    public async pause() {
        await this.context.suspend();
        this.emit(PlaybackState.Paused);
    }

    public async stop() {
        await this.onPlaybackEnd();
    }

    public async toggle() {
        if (this.isPlaying) await this.pause();
        else await this.play();
    }
}
