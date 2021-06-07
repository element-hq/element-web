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

import * as Recorder from 'opus-recorder';
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js';
import {MatrixClient} from "matrix-js-sdk/src/client";
import CallMediaHandler from "../CallMediaHandler";
import {SimpleObservable} from "matrix-widget-api";
import {clamp, percentageOf, percentageWithin} from "../utils/numbers";
import EventEmitter from "events";
import {IDestroyable} from "../utils/IDestroyable";
import {Singleflight} from "../utils/Singleflight";
import {PayloadEvent, WORKLET_NAME} from "./consts";
import {UPDATE_EVENT} from "../stores/AsyncStore";
import {Playback} from "./Playback";
import {createAudioContext} from "./compat";

const CHANNELS = 1; // stereo isn't important
export const SAMPLE_RATE = 48000; // 48khz is what WebRTC uses. 12khz is where we lose quality.
const BITRATE = 24000; // 24kbps is pretty high quality for our use case in opus.
const TARGET_MAX_LENGTH = 120; // 2 minutes in seconds. Somewhat arbitrary, though longer == larger files.
const TARGET_WARN_TIME_LEFT = 10; // 10 seconds, also somewhat arbitrary.

export const RECORDING_PLAYBACK_SAMPLES = 44;

export interface IRecordingUpdate {
    waveform: number[]; // floating points between 0 (low) and 1 (high).
    timeSeconds: number; // float
}

export enum RecordingState {
    Started = "started",
    EndingSoon = "ending_soon", // emits an object with a single numerical value: secondsLeft
    Ended = "ended",
    Uploading = "uploading",
    Uploaded = "uploaded",
}

export class VoiceRecording extends EventEmitter implements IDestroyable {
    private recorder: Recorder;
    private recorderContext: AudioContext;
    private recorderSource: MediaStreamAudioSourceNode;
    private recorderStream: MediaStream;
    private recorderFFT: AnalyserNode;
    private recorderWorklet: AudioWorkletNode;
    private recorderProcessor: ScriptProcessorNode;
    private buffer = new Uint8Array(0); // use this.audioBuffer to access
    private mxc: string;
    private recording = false;
    private observable: SimpleObservable<IRecordingUpdate>;
    private amplitudes: number[] = []; // at each second mark, generated
    private playback: Playback;

    public constructor(private client: MatrixClient) {
        super();
    }

    public get contentType(): string {
        return "audio/ogg";
    }

    public get contentLength(): number {
        return this.buffer.length;
    }

    public get durationSeconds(): number {
        if (!this.recorder) throw new Error("Duration not available without a recording");
        return this.recorderContext.currentTime;
    }

    public get isRecording(): boolean {
        return this.recording;
    }

    public emit(event: string, ...args: any[]): boolean {
        super.emit(event, ...args);
        super.emit(UPDATE_EVENT, event, ...args);
        return true; // we don't ever care if the event had listeners, so just return "yes"
    }

    private async makeRecorder() {
        try {
            this.recorderStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: CHANNELS,
                    noiseSuppression: true, // browsers ignore constraints they can't honour
                    deviceId: CallMediaHandler.getAudioInput(),
                },
            });
            this.recorderContext = createAudioContext({
                // latencyHint: "interactive", // we don't want a latency hint (this causes data smoothing)
            });
            this.recorderSource = this.recorderContext.createMediaStreamSource(this.recorderStream);
            this.recorderFFT = this.recorderContext.createAnalyser();

            // Bring the FFT time domain down a bit. The default is 2048, and this must be a power
            // of two. We use 64 points because we happen to know down the line we need less than
            // that, but 32 would be too few. Large numbers are not helpful here and do not add
            // precision: they introduce higher precision outputs of the FFT (frequency data), but
            // it makes the time domain less than helpful.
            this.recorderFFT.fftSize = 64;

            // Set up our worklet. We use this for timing information and waveform analysis: the
            // web audio API prefers this be done async to avoid holding the main thread with math.
            const mxRecorderWorkletPath = document.body.dataset.vectorRecorderWorkletScript;
            if (!mxRecorderWorkletPath) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error("Unable to create recorder: no worklet script registered");
            }

            // Connect our inputs and outputs
            this.recorderSource.connect(this.recorderFFT);

            if (this.recorderContext.audioWorklet) {
                await this.recorderContext.audioWorklet.addModule(mxRecorderWorkletPath);
                this.recorderWorklet = new AudioWorkletNode(this.recorderContext, WORKLET_NAME);
                this.recorderSource.connect(this.recorderWorklet);
                this.recorderWorklet.connect(this.recorderContext.destination);

                // Dev note: we can't use `addEventListener` for some reason. It just doesn't work.
                this.recorderWorklet.port.onmessage = (ev) => {
                    switch (ev.data['ev']) {
                        case PayloadEvent.Timekeep:
                            this.processAudioUpdate(ev.data['timeSeconds']);
                            break;
                        case PayloadEvent.AmplitudeMark:
                            // Sanity check to make sure we're adding about one sample per second
                            if (ev.data['forSecond'] === this.amplitudes.length) {
                                this.amplitudes.push(ev.data['amplitude']);
                            }
                            break;
                    }
                };
            } else {
                // Safari fallback: use a processor node instead, buffered to 1024 bytes of data
                // like the worklet is.
                this.recorderProcessor = this.recorderContext.createScriptProcessor(1024, CHANNELS, CHANNELS);
                this.recorderSource.connect(this.recorderProcessor);
                this.recorderProcessor.connect(this.recorderContext.destination);
                this.recorderProcessor.addEventListener("audioprocess", this.onAudioProcess);
            }

            this.recorder = new Recorder({
                encoderPath, // magic from webpack
                encoderSampleRate: SAMPLE_RATE,
                encoderApplication: 2048, // voice (default is "audio")
                streamPages: true, // this speeds up the encoding process by using CPU over time
                encoderFrameSize: 20, // ms, arbitrary frame size we send to the encoder
                numberOfChannels: CHANNELS,
                sourceNode: this.recorderSource,
                encoderBitRate: BITRATE,

                // We use low values for the following to ease CPU usage - the resulting waveform
                // is indistinguishable for a voice message. Note that the underlying library will
                // pick defaults which prefer the highest possible quality, CPU be damned.
                encoderComplexity: 3, // 0-10, 10 is slow and high quality.
                resampleQuality: 3, // 0-10, 10 is slow and high quality
            });
            this.recorder.ondataavailable = (a: ArrayBuffer) => {
                const buf = new Uint8Array(a);
                const newBuf = new Uint8Array(this.buffer.length + buf.length);
                newBuf.set(this.buffer, 0);
                newBuf.set(buf, this.buffer.length);
                this.buffer = newBuf;
            };
        } catch (e) {
            console.error("Error starting recording: ", e);
            if (e instanceof DOMException) { // Unhelpful DOMExceptions are common - parse them sanely
                console.error(`${e.name} (${e.code}): ${e.message}`);
            }

            // Clean up as best as possible
            if (this.recorderStream) this.recorderStream.getTracks().forEach(t => t.stop());
            if (this.recorderSource) this.recorderSource.disconnect();
            if (this.recorder) this.recorder.close();
            if (this.recorderContext) {
                // noinspection ES6MissingAwait - not important that we wait
                this.recorderContext.close();
            }

            throw e; // rethrow so upstream can handle it
        }
    }

    private get audioBuffer(): Uint8Array {
        // We need a clone of the buffer to avoid accidentally changing the position
        // on the real thing.
        return this.buffer.slice(0);
    }

    public get liveData(): SimpleObservable<IRecordingUpdate> {
        if (!this.recording) throw new Error("No observable when not recording");
        return this.observable;
    }

    public get isSupported(): boolean {
        return !!Recorder.isRecordingSupported();
    }

    public get hasRecording(): boolean {
        return this.buffer.length > 0;
    }

    public get mxcUri(): string {
        if (!this.mxc) {
            throw new Error("Recording has not been uploaded yet");
        }
        return this.mxc;
    }

    private onAudioProcess = (ev: AudioProcessingEvent) => {
        this.processAudioUpdate(ev.playbackTime);

        // We skip the functionality of the worklet regarding waveform calculations: we
        // should get that information pretty quick during the playback info.
    };

    private processAudioUpdate = (timeSeconds: number) => {
        if (!this.recording) return;

        // The time domain is the input to the FFT, which means we use an array of the same
        // size. The time domain is also known as the audio waveform. We're ignoring the
        // output of the FFT here (frequency data) because we're not interested in it.
        const data = new Float32Array(this.recorderFFT.fftSize);
        if (!this.recorderFFT.getFloatTimeDomainData) {
            // Safari compat
            const data2 = new Uint8Array(this.recorderFFT.fftSize);
            this.recorderFFT.getByteTimeDomainData(data2);
            for (let i = 0; i < data2.length; i++) {
                data[i] = percentageWithin(percentageOf(data2[i], 0, 256), -1, 1);
            }
        } else {
            this.recorderFFT.getFloatTimeDomainData(data);
        }

        // We can't just `Array.from()` the array because we're dealing with 32bit floats
        // and the built-in function won't consider that when converting between numbers.
        // However, the runtime will convert the float32 to a float64 during the math operations
        // which is why the loop works below. Note that a `.map()` call also doesn't work
        // and will instead return a Float32Array still.
        const translatedData: number[] = [];
        for (let i = 0; i < data.length; i++) {
            // We're clamping the values so we can do that math operation mentioned above,
            // and to ensure that we produce consistent data (it's possible for the array
            // to exceed the specified range with some audio input devices).
            translatedData.push(clamp(data[i], 0, 1));
        }

        this.observable.update({
            waveform: translatedData,
            timeSeconds: timeSeconds,
        });

        // Now that we've updated the data/waveform, let's do a time check. We don't want to
        // go horribly over the limit. We also emit a warning state if needed.
        //
        // We use the recorder's perspective of time to make sure we don't cut off the last
        // frame of audio, otherwise we end up with a 1:59 clip (119.68 seconds). This extra
        // safety can allow us to overshoot the target a bit, but at least when we say 2min
        // maximum we actually mean it.
        //
        // In testing, recorder time and worker time lag by about 400ms, which is roughly the
        // time needed to encode a sample/frame.
        //
        // Ref for recorderSeconds: https://github.com/chris-rudmin/opus-recorder#instance-fields
        const recorderSeconds = this.recorder.encodedSamplePosition / 48000;
        const secondsLeft = TARGET_MAX_LENGTH - recorderSeconds;
        if (secondsLeft < 0) { // go over to make sure we definitely capture that last frame
            // noinspection JSIgnoredPromiseFromCall - we aren't concerned with it overlapping
            this.stop();
        } else if (secondsLeft <= TARGET_WARN_TIME_LEFT) {
            Singleflight.for(this, "ending_soon").do(() => {
                this.emit(RecordingState.EndingSoon, {secondsLeft});
                return Singleflight.Void;
            });
        }
    };

    public async start(): Promise<void> {
        if (this.mxc || this.hasRecording) {
            throw new Error("Recording already prepared");
        }
        if (this.recording) {
            throw new Error("Recording already in progress");
        }
        if (this.observable) {
            this.observable.close();
        }
        this.observable = new SimpleObservable<IRecordingUpdate>();
        await this.makeRecorder();
        await this.recorder.start();
        this.recording = true;
        this.emit(RecordingState.Started);
    }

    public async stop(): Promise<Uint8Array> {
        return Singleflight.for(this, "stop").do(async () => {
            if (!this.recording) {
                throw new Error("No recording to stop");
            }

            // Disconnect the source early to start shutting down resources
            await this.recorder.stop(); // stop first to flush the last frame
            this.recorderSource.disconnect();
            if (this.recorderWorklet) this.recorderWorklet.disconnect();
            if (this.recorderProcessor) {
                this.recorderProcessor.disconnect();
                this.recorderProcessor.removeEventListener("audioprocess", this.onAudioProcess);
            }

            // close the context after the recorder so the recorder doesn't try to
            // connect anything to the context (this would generate a warning)
            await this.recorderContext.close();

            // Now stop all the media tracks so we can release them back to the user/OS
            this.recorderStream.getTracks().forEach(t => t.stop());

            // Finally do our post-processing and clean up
            this.recording = false;
            await this.recorder.close();
            this.emit(RecordingState.Ended);

            return this.audioBuffer;
        });
    }

    /**
     * Gets a playback instance for this voice recording. Note that the playback will not
     * have been prepared fully, meaning the `prepare()` function needs to be called on it.
     *
     * The same playback instance is returned each time.
     *
     * @returns {Playback} The playback instance.
     */
    public getPlayback(): Playback {
        this.playback = Singleflight.for(this, "playback").do(() => {
            return new Playback(this.audioBuffer.buffer, this.amplitudes); // cast to ArrayBuffer proper;
        });
        return this.playback;
    }

    public destroy() {
        // noinspection JSIgnoredPromiseFromCall - not concerned about stop() being called async here
        this.stop();
        this.removeAllListeners();
        Singleflight.forgetAllFor(this);
        // noinspection JSIgnoredPromiseFromCall - not concerned about being called async here
        this.playback?.destroy();
        this.observable.close();
    }

    public async upload(): Promise<string> {
        if (!this.hasRecording) {
            throw new Error("No recording available to upload");
        }

        if (this.mxc) return this.mxc;

        this.emit(RecordingState.Uploading);
        this.mxc = await this.client.uploadContent(new Blob([this.audioBuffer], {
            type: this.contentType,
        }), {
            onlyContentUri: false, // to stop the warnings in the console
        }).then(r => r['content_uri']);
        this.emit(RecordingState.Uploaded);
        return this.mxc;
    }
}
