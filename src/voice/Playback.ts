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
import { UPDATE_EVENT } from "../stores/AsyncStore";
import { arrayFastResample, arrayRescale, arraySeed, arraySmoothingResample } from "../utils/arrays";
import { SimpleObservable } from "matrix-widget-api";
import { IDestroyable } from "../utils/IDestroyable";
import { PlaybackClock } from "./PlaybackClock";
import { createAudioContext, decodeOgg } from "./compat";
import { clamp } from "../utils/numbers";

export enum PlaybackState {
    Decoding = "decoding",
    Stopped = "stopped", // no progress on timeline
    Paused = "paused", // some progress on timeline
    Playing = "playing", // active progress through timeline
}

export const PLAYBACK_WAVEFORM_SAMPLES = 39;
const DEFAULT_WAVEFORM = arraySeed(0, PLAYBACK_WAVEFORM_SAMPLES);

function makePlaybackWaveform(input: number[]): number[] {
    // First, convert negative amplitudes to positive so we don't detect zero as "noisy".
    const noiseWaveform = input.map(v => Math.abs(v));

    // Next, we'll resample the waveform using a smoothing approach so we can keep the same rough shape.
    // We also rescale the waveform to be 0-1 for the remaining function logic.
    const resampled = arrayRescale(arraySmoothingResample(noiseWaveform, PLAYBACK_WAVEFORM_SAMPLES), 0, 1);

    // Then, we'll do a high and low pass filter to isolate actual speaking volumes within the rescaled
    // waveform. Most speech happens below the 0.5 mark.
    const filtered = resampled.map(v => clamp(v, 0.1, 0.5));

    // Finally, we'll rescale the filtered waveform (0.1-0.5 becomes 0-1 again) so the user sees something
    // sensible. This is what we return to keep our contract of "values between zero and one".
    return arrayRescale(filtered, 0, 1);
}

export class Playback extends EventEmitter implements IDestroyable {
    private readonly context: AudioContext;
    private source: AudioBufferSourceNode;
    private state = PlaybackState.Decoding;
    private audioBuf: AudioBuffer;
    private resampledWaveform: number[];
    private waveformObservable = new SimpleObservable<number[]>();
    private readonly clock: PlaybackClock;

    /**
     * Creates a new playback instance from a buffer.
     * @param {ArrayBuffer} buf The buffer containing the sound sample.
     * @param {number[]} seedWaveform Optional seed waveform to present until the proper waveform
     * can be calculated. Contains values between zero and one, inclusive.
     */
    constructor(private buf: ArrayBuffer, seedWaveform = DEFAULT_WAVEFORM) {
        super();
        this.context = createAudioContext();
        this.resampledWaveform = arrayFastResample(seedWaveform ?? DEFAULT_WAVEFORM, PLAYBACK_WAVEFORM_SAMPLES);
        this.waveformObservable.update(this.resampledWaveform);
        this.clock = new PlaybackClock(this.context);
    }

    /**
     * Stable waveform for the playback. Values are guaranteed to be between
     * zero and one, inclusive.
     */
    public get waveform(): number[] {
        return this.resampledWaveform;
    }

    public get waveformData(): SimpleObservable<number[]> {
        return this.waveformObservable;
    }

    public get clockInfo(): PlaybackClock {
        return this.clock;
    }

    public get currentState(): PlaybackState {
        return this.state;
    }

    public get isPlaying(): boolean {
        return this.currentState === PlaybackState.Playing;
    }

    public emit(event: PlaybackState, ...args: any[]): boolean {
        this.state = event;
        super.emit(event, ...args);
        super.emit(UPDATE_EVENT, event, ...args);
        return true; // we don't ever care if the event had listeners, so just return "yes"
    }

    public destroy() {
        // noinspection JSIgnoredPromiseFromCall - not concerned about being called async here
        this.stop();
        this.removeAllListeners();
        this.clock.destroy();
        this.waveformObservable.close();
    }

    public async prepare() {
        // Safari compat: promise API not supported on this function
        this.audioBuf = await new Promise((resolve, reject) => {
            this.context.decodeAudioData(this.buf, b => resolve(b), async e => {
                // This error handler is largely for Safari as well, which doesn't support Opus/Ogg
                // very well.
                console.error("Error decoding recording: ", e);
                console.warn("Trying to re-encode to WAV instead...");

                const wav = await decodeOgg(this.buf);

                // noinspection ES6MissingAwait - not needed when using callbacks
                this.context.decodeAudioData(wav, b => resolve(b), e => {
                    console.error("Still failed to decode recording: ", e);
                    reject(e);
                });
            });
        });

        // Update the waveform to the real waveform once we have channel data to use. We don't
        // exactly trust the user-provided waveform to be accurate...
        const waveform = Array.from(this.audioBuf.getChannelData(0));
        this.resampledWaveform = makePlaybackWaveform(waveform);
        this.waveformObservable.update(this.resampledWaveform);

        this.emit(PlaybackState.Stopped); // signal that we're not decoding anymore
        this.clock.flagLoadTime(); // must happen first because setting the duration fires a clock update
        this.clock.durationSeconds = this.audioBuf.duration;
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
        this.clock.flagStart();
        this.emit(PlaybackState.Playing);
    }

    public async pause() {
        await this.context.suspend();
        this.emit(PlaybackState.Paused);
    }

    public async stop() {
        await this.onPlaybackEnd();
        this.clock.flagStop();
    }

    public async toggle() {
        if (this.isPlaying) await this.pause();
        else await this.play();
    }
}
