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

import { Optional } from "matrix-events-sdk";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { getChunkLength } from "..";
import { IRecordingUpdate, VoiceRecording } from "../../audio/VoiceRecording";
import { concat } from "../../utils/arrays";
import { IDestroyable } from "../../utils/IDestroyable";
import { Singleflight } from "../../utils/Singleflight";

export enum VoiceBroadcastRecorderEvent {
    ChunkRecorded = "chunk_recorded",
    CurrentChunkLengthUpdated = "current_chunk_length_updated",
}

interface EventMap {
    [VoiceBroadcastRecorderEvent.ChunkRecorded]: (chunk: ChunkRecordedPayload) => void;
    [VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated]: (length: number) => void;
}

export interface ChunkRecordedPayload {
    buffer: Uint8Array;
    length: number;
}

/**
 * This class provides the function to seamlessly record fixed length chunks.
 * Subscribe with on(VoiceBroadcastRecordingEvents.ChunkRecorded, (payload: ChunkRecordedPayload) => {})
 * to retrieve chunks while recording.
 */
export class VoiceBroadcastRecorder
    extends TypedEventEmitter<VoiceBroadcastRecorderEvent, EventMap>
    implements IDestroyable
{
    private headers = new Uint8Array(0);
    private chunkBuffer = new Uint8Array(0);
    // position of the previous chunk in seconds
    private previousChunkEndTimePosition = 0;
    private pagesFromRecorderCount = 0;
    // current chunk length in seconds
    private currentChunkLength = 0;

    public constructor(private voiceRecording: VoiceRecording, public readonly targetChunkLength: number) {
        super();
        this.voiceRecording.onDataAvailable = this.onDataAvailable;
    }

    public async start(): Promise<void> {
        await this.voiceRecording.start();
        this.voiceRecording.liveData.onUpdate((data: IRecordingUpdate) => {
            this.setCurrentChunkLength(data.timeSeconds - this.previousChunkEndTimePosition);
        });
        return;
    }

    /**
     * Stops the recording and returns the remaining chunk (if any).
     */
    public async stop(): Promise<Optional<ChunkRecordedPayload>> {
        await this.voiceRecording.stop();
        // forget about that call, so that we can stop it again later
        Singleflight.forgetAllFor(this.voiceRecording);
        const chunk = this.extractChunk();
        this.currentChunkLength = 0;
        this.previousChunkEndTimePosition = 0;
        this.headers = new Uint8Array(0);
        return chunk;
    }

    public get contentType(): string {
        return this.voiceRecording.contentType;
    }

    private setCurrentChunkLength(currentChunkLength: number): void {
        if (this.currentChunkLength === currentChunkLength) return;

        this.currentChunkLength = currentChunkLength;
        this.emit(VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, currentChunkLength);
    }

    public getCurrentChunkLength(): number {
        return this.currentChunkLength;
    }

    private onDataAvailable = (data: ArrayBuffer): void => {
        const dataArray = new Uint8Array(data);
        this.pagesFromRecorderCount++;

        if (this.pagesFromRecorderCount <= 2) {
            // first two pages contain the headers
            this.headers = concat(this.headers, dataArray);
            return;
        }

        this.setCurrentChunkLength(this.voiceRecording.recorderSeconds - this.previousChunkEndTimePosition);
        this.handleData(dataArray);
    };

    private handleData(data: Uint8Array): void {
        this.chunkBuffer = concat(this.chunkBuffer, data);
        this.emitChunkIfTargetLengthReached();
    }

    private emitChunkIfTargetLengthReached(): void {
        if (this.getCurrentChunkLength() >= this.targetChunkLength) {
            this.emitAndResetChunk();
        }
    }

    /**
     * Extracts the current chunk and resets the buffer.
     */
    private extractChunk(): Optional<ChunkRecordedPayload> {
        if (this.chunkBuffer.length === 0) {
            return null;
        }

        const currentRecorderTime = this.voiceRecording.recorderSeconds;
        const payload: ChunkRecordedPayload = {
            buffer: concat(this.headers, this.chunkBuffer),
            length: this.getCurrentChunkLength(),
        };
        this.chunkBuffer = new Uint8Array(0);
        this.setCurrentChunkLength(0);
        this.previousChunkEndTimePosition = currentRecorderTime;
        return payload;
    }

    private emitAndResetChunk(): void {
        if (this.chunkBuffer.length === 0) {
            return;
        }

        this.emit(VoiceBroadcastRecorderEvent.ChunkRecorded, this.extractChunk());
    }

    public destroy(): void {
        this.removeAllListeners();
        this.voiceRecording.destroy();
    }
}

export const createVoiceBroadcastRecorder = (): VoiceBroadcastRecorder => {
    const voiceRecording = new VoiceRecording();
    voiceRecording.disableMaxLength();
    return new VoiceBroadcastRecorder(voiceRecording, getChunkLength());
};
