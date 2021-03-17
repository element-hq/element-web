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

export class VoiceRecorder {
    private recorder = new Recorder({
        encoderPath, // magic from webpack
        mediaTrackConstraints: <MediaTrackConstraints>{
            deviceId: CallMediaHandler.getAudioInput(),
        },
        encoderSampleRate: 16000, // we could go down to 12khz, but we lose quality
        encoderApplication: 2048, // voice (default is "audio")
        streamPages: true, // so we can have a live EQ for the user
        encoderFrameSize: 10, // we want updates fairly regularly for the UI
    });
    private buffer = new Uint8Array(0);
    private mxc: string;
    private recording = false;
    private observable: SimpleObservable<Uint8Array>;

    public constructor(private client: MatrixClient) {
        this.recorder.ondataavailable = (a: ArrayBuffer) => {
            // TODO: @@ TravisR: We'll have to decode each frame and convert it to an EQ to observe
            const buf = new Uint8Array(a);
            const newBuf = new Uint8Array(this.buffer.length + buf.length);
            newBuf.set(this.buffer, 0);
            newBuf.set(buf, this.buffer.length);
            this.buffer = newBuf;
            this.observable.update(buf); // send the frame over the observable
        };
    }

    public get rawData(): SimpleObservable<Uint8Array> {
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
        this.observable = new SimpleObservable<Uint8Array>();
        return this.recorder.start().then(() => this.recording = true);
    }

    public async stop(): Promise<Uint8Array> {
        if (!this.recording) {
            throw new Error("No recording to stop");
        }
        return new Promise<Uint8Array>(resolve => {
            this.recorder.stop().then(() => {
                this.recording = false;
                return this.recorder.close();
            }).then(() => resolve(this.buffer));
        });
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
