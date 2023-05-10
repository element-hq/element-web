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

import { IEncryptedFile, MatrixClient } from "matrix-js-sdk/src/matrix";
import { SimpleObservable } from "matrix-widget-api";

import { uploadFile } from "../ContentMessages";
import { concat } from "../utils/arrays";
import { IDestroyable } from "../utils/IDestroyable";
import { Singleflight } from "../utils/Singleflight";
import { Playback } from "./Playback";
import { IRecordingUpdate, RecordingState, VoiceRecording } from "./VoiceRecording";

export interface IUpload {
    mxc?: string; // for unencrypted uploads
    encrypted?: IEncryptedFile;
}

/**
 * This class can be used to record a single voice message.
 */
export class VoiceMessageRecording implements IDestroyable {
    private lastUpload?: IUpload;
    private buffer = new Uint8Array(0); // use this.audioBuffer to access
    private playback?: Playback;

    public constructor(private matrixClient: MatrixClient, private voiceRecording: VoiceRecording) {
        this.voiceRecording.onDataAvailable = this.onDataAvailable;
    }

    public async start(): Promise<void> {
        if (this.lastUpload || this.hasRecording) {
            throw new Error("Recording already prepared");
        }

        return this.voiceRecording.start();
    }

    public async stop(): Promise<Uint8Array> {
        await this.voiceRecording.stop();
        return this.audioBuffer;
    }

    public on(event: string | symbol, listener: (...args: any[]) => void): this {
        this.voiceRecording.on(event, listener);
        return this;
    }

    public off(event: string | symbol, listener: (...args: any[]) => void): this {
        this.voiceRecording.off(event, listener);
        return this;
    }

    public emit(event: string, ...args: any[]): boolean {
        return this.voiceRecording.emit(event, ...args);
    }

    public get hasRecording(): boolean {
        return this.buffer.length > 0;
    }

    public get isRecording(): boolean {
        return this.voiceRecording.isRecording;
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
            return new Playback(this.audioBuffer.buffer, this.voiceRecording.amplitudes); // cast to ArrayBuffer proper;
        });
        return this.playback;
    }

    public async upload(inRoomId: string): Promise<IUpload> {
        if (!this.hasRecording) {
            throw new Error("No recording available to upload");
        }

        if (this.lastUpload) return this.lastUpload;

        try {
            this.emit(RecordingState.Uploading);
            const { url: mxc, file: encrypted } = await uploadFile(
                this.matrixClient,
                inRoomId,
                new Blob([this.audioBuffer], {
                    type: this.contentType,
                }),
            );
            this.lastUpload = { mxc, encrypted };
            this.emit(RecordingState.Uploaded);
        } catch (e) {
            this.emit(RecordingState.Ended);
            throw e;
        }
        return this.lastUpload;
    }

    public get durationSeconds(): number {
        return this.voiceRecording.durationSeconds;
    }

    public get contentType(): string {
        return this.voiceRecording.contentType;
    }

    public get contentLength(): number {
        return this.buffer.length;
    }

    public get liveData(): SimpleObservable<IRecordingUpdate> {
        return this.voiceRecording.liveData;
    }

    public get isSupported(): boolean {
        return this.voiceRecording.isSupported;
    }

    public destroy(): void {
        this.playback?.destroy();
        this.voiceRecording.destroy();
    }

    private onDataAvailable = (data: ArrayBuffer): void => {
        const buf = new Uint8Array(data);
        this.buffer = concat(this.buffer, buf);
    };

    private get audioBuffer(): Uint8Array {
        // We need a clone of the buffer to avoid accidentally changing the position
        // on the real thing.
        return this.buffer.slice(0);
    }
}

export const createVoiceMessageRecording = (matrixClient: MatrixClient): VoiceMessageRecording => {
    return new VoiceMessageRecording(matrixClient, new VoiceRecording());
};
