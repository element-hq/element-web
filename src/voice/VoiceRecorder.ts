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

const CHANNELS = 1; // stereo isn't important
const SAMPLE_RATE = 48000; // 48khz is what WebRTC uses. 12khz is where we lose quality.
const BITRATE = 24000; // 24kbps is pretty high quality for our use case in opus.
const FREQ_SAMPLE_RATE = 4; // Target rate of frequency data (samples / sec). We don't need this super often.

export interface IFrequencyPackage {
    dbBars: Float32Array;
    dbMin: number;
    dbMax: number;

    // TODO: @@ TravisR: Generalize this for a timing package?
}

export class VoiceRecorder {
    private recorder: Recorder;
    private recorderContext: AudioContext;
    private recorderSource: MediaStreamAudioSourceNode;
    private recorderStream: MediaStream;
    private recorderFreqNode: AnalyserNode;
    private buffer = new Uint8Array(0);
    private mxc: string;
    private recording = false;
    private observable: SimpleObservable<IFrequencyPackage>;
    private freqTimerId: number;

    public constructor(private client: MatrixClient) {
    }

    private async makeRecorder() {
        this.recorderStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                // specify some audio settings so we're feeding the recorder with the
                // best possible values. The browser will handle resampling for us.
                sampleRate: SAMPLE_RATE,
                channelCount: CHANNELS,
                noiseSuppression: true, // browsers ignore constraints they can't honour
                deviceId: CallMediaHandler.getAudioInput(),
            },
        });
        this.recorderContext = new AudioContext({
            latencyHint: "interactive",
            sampleRate: SAMPLE_RATE, // once again, the browser will resample for us
        });
        this.recorderSource = this.recorderContext.createMediaStreamSource(this.recorderStream);
        this.recorderFreqNode = this.recorderContext.createAnalyser();
        this.recorderSource.connect(this.recorderFreqNode);
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
    }

    public get frequencyData(): SimpleObservable<IFrequencyPackage> {
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
        this.observable = new SimpleObservable<IFrequencyPackage>();
        await this.makeRecorder();
        this.freqTimerId = setInterval(() => {
            if (!this.recording) return;
            const data = new Float32Array(this.recorderFreqNode.frequencyBinCount);
            this.recorderFreqNode.getFloatFrequencyData(data);
            this.observable.update({
                dbBars: data,
                dbMin: this.recorderFreqNode.minDecibels,
                dbMax: this.recorderFreqNode.maxDecibels,
            });
        }, 1000 / FREQ_SAMPLE_RATE) as any as number; // XXX: Linter doesn't understand timer environment
        await this.recorder.start();
        this.recording = true;
    }

    public async stop(): Promise<Uint8Array> {
        if (!this.recording) {
            throw new Error("No recording to stop");
        }

        // Disconnect the source early to start shutting down resources
        this.recorderSource.disconnect();
        await this.recorder.stop();

        // close the context after the recorder so the recorder doesn't try to
        // connect anything to the context (this would generate a warning)
        await this.recorderContext.close();

        // Now stop all the media tracks so we can release them back to the user/OS
        this.recorderStream.getTracks().forEach(t => t.stop());

        // Finally do our post-processing and clean up
        clearInterval(this.freqTimerId);
        this.recording = false;
        await this.recorder.close();

        return this.buffer;
    }

    public async upload(): Promise<string> {
        if (!this.hasRecording) {
            throw new Error("No recording available to upload");
        }

        if (this.mxc) return this.mxc;

        this.mxc = await this.client.uploadContent(new Blob([this.buffer], {
            type: "audio/ogg",
        }), {
            onlyContentUri: false, // to stop the warnings in the console
        }).then(r => r['content_uri']);
        return this.mxc;
    }
}

window.mxVoiceRecorder = VoiceRecorder;
