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

import { logger } from "matrix-js-sdk/src/logger";
import {
    EventType,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    RelationType,
} from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import {
    ChunkRecordedPayload,
    createVoiceBroadcastRecorder,
    getMaxBroadcastLength,
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecorder,
    VoiceBroadcastRecorderEvent,
} from "..";
import { uploadFile } from "../../ContentMessages";
import { IEncryptedFile } from "../../customisations/models/IMediaEventContent";
import { createVoiceMessageContent } from "../../utils/createVoiceMessageContent";
import { IDestroyable } from "../../utils/IDestroyable";
import dis from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { VoiceBroadcastChunkEvents } from "../utils/VoiceBroadcastChunkEvents";
import { RelationsHelper, RelationsHelperEvent } from "../../events/RelationsHelper";

export enum VoiceBroadcastRecordingEvent {
    StateChanged = "liveness_changed",
    TimeLeftChanged = "time_left_changed",
}

interface EventMap {
    [VoiceBroadcastRecordingEvent.StateChanged]: (state: VoiceBroadcastInfoState) => void;
    [VoiceBroadcastRecordingEvent.TimeLeftChanged]: (timeLeft: number) => void;
}

export class VoiceBroadcastRecording
    extends TypedEventEmitter<VoiceBroadcastRecordingEvent, EventMap>
    implements IDestroyable {
    private state: VoiceBroadcastInfoState;
    private recorder: VoiceBroadcastRecorder;
    private sequence = 1;
    private dispatcherRef: string;
    private chunkEvents = new VoiceBroadcastChunkEvents();
    private chunkRelationHelper: RelationsHelper;
    private maxLength: number;
    private timeLeft: number;

    public constructor(
        public readonly infoEvent: MatrixEvent,
        private client: MatrixClient,
        initialState?: VoiceBroadcastInfoState,
    ) {
        super();
        this.maxLength = getMaxBroadcastLength();
        this.timeLeft = this.maxLength;

        if (initialState) {
            this.state = initialState;
        } else {
            this.setInitialStateFromInfoEvent();
        }

        // TODO Michael W: listen for state updates

        this.infoEvent.on(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
        this.dispatcherRef = dis.register(this.onAction);
        this.chunkRelationHelper = this.initialiseChunkEventRelation();
    }

    private initialiseChunkEventRelation(): RelationsHelper {
        const relationsHelper = new RelationsHelper(
            this.infoEvent,
            RelationType.Reference,
            EventType.RoomMessage,
            this.client,
        );
        relationsHelper.on(RelationsHelperEvent.Add, this.onChunkEvent);

        relationsHelper.emitFetchCurrent().catch((err) => {
            logger.warn("error fetching server side relation for voice broadcast chunks", err);
            // fall back to local events
            relationsHelper.emitCurrent();
        });

        return relationsHelper;
    }

    private onChunkEvent = (event: MatrixEvent): void => {
        if (
            (!event.getId() && !event.getTxnId())
            || event.getContent()?.msgtype !== MsgType.Audio // don't add non-audio event
        ) {
            return;
        }

        this.chunkEvents.addEvent(event);
    };

    private setInitialStateFromInfoEvent(): void {
        const room = this.client.getRoom(this.infoEvent.getRoomId());
        const relations = room?.getUnfilteredTimelineSet()?.relations?.getChildEventsForEvent(
            this.infoEvent.getId(),
            RelationType.Reference,
            VoiceBroadcastInfoEventType,
        );
        const relatedEvents = relations?.getRelations();
        this.state = !relatedEvents?.find((event: MatrixEvent) => {
            return event.getContent()?.state === VoiceBroadcastInfoState.Stopped;
        }) ? VoiceBroadcastInfoState.Started : VoiceBroadcastInfoState.Stopped;
    }

    public getTimeLeft(): number {
        return this.timeLeft;
    }

    private async setTimeLeft(timeLeft: number): Promise<void> {
        if (timeLeft <= 0) {
            // time is up - stop the recording
            return await this.stop();
        }

        // do never increase time left; no action if equals
        if (timeLeft >= this.timeLeft) return;

        this.timeLeft = timeLeft;
        this.emit(VoiceBroadcastRecordingEvent.TimeLeftChanged, timeLeft);
    }

    public async start(): Promise<void> {
        return this.getRecorder().start();
    }

    public async stop(): Promise<void> {
        if (this.state === VoiceBroadcastInfoState.Stopped) return;

        this.setState(VoiceBroadcastInfoState.Stopped);
        await this.stopRecorder();
        await this.sendInfoStateEvent(VoiceBroadcastInfoState.Stopped);
    }

    public async pause(): Promise<void> {
        // stopped or already paused recordings cannot be paused
        if ([VoiceBroadcastInfoState.Stopped, VoiceBroadcastInfoState.Paused].includes(this.state)) return;

        this.setState(VoiceBroadcastInfoState.Paused);
        await this.stopRecorder();
        await this.sendInfoStateEvent(VoiceBroadcastInfoState.Paused);
    }

    public async resume(): Promise<void> {
        if (this.state !== VoiceBroadcastInfoState.Paused) return;

        this.setState(VoiceBroadcastInfoState.Resumed);
        await this.getRecorder().start();
        await this.sendInfoStateEvent(VoiceBroadcastInfoState.Resumed);
    }

    public toggle = async (): Promise<void> => {
        if (this.getState() === VoiceBroadcastInfoState.Paused) return this.resume();

        if ([VoiceBroadcastInfoState.Started, VoiceBroadcastInfoState.Resumed].includes(this.getState())) {
            return this.pause();
        }
    };

    public getState(): VoiceBroadcastInfoState {
        return this.state;
    }

    private getRecorder(): VoiceBroadcastRecorder {
        if (!this.recorder) {
            this.recorder = createVoiceBroadcastRecorder();
            this.recorder.on(VoiceBroadcastRecorderEvent.ChunkRecorded, this.onChunkRecorded);
            this.recorder.on(VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, this.onCurrentChunkLengthUpdated);
        }

        return this.recorder;
    }

    public async destroy(): Promise<void> {
        if (this.recorder) {
            this.recorder.stop();
            this.recorder.destroy();
        }

        this.infoEvent.off(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
        this.removeAllListeners();
        dis.unregister(this.dispatcherRef);
        this.chunkEvents = new VoiceBroadcastChunkEvents();
        this.chunkRelationHelper.destroy();
    }

    private onBeforeRedaction = () => {
        if (this.getState() !== VoiceBroadcastInfoState.Stopped) {
            this.setState(VoiceBroadcastInfoState.Stopped);
            // destroy cleans up everything
            this.destroy();
        }
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action !== "call_state") return;

        // pause on any call action
        this.pause();
    };

    private setState(state: VoiceBroadcastInfoState): void {
        this.state = state;
        this.emit(VoiceBroadcastRecordingEvent.StateChanged, this.state);
    }

    private onCurrentChunkLengthUpdated = (currentChunkLength: number) => {
        this.setTimeLeft(this.maxLength - this.chunkEvents.getLengthSeconds() - currentChunkLength);
    };

    private onChunkRecorded = async (chunk: ChunkRecordedPayload): Promise<void> => {
        const { url, file } = await this.uploadFile(chunk);
        await this.sendVoiceMessage(chunk, url, file);
    };

    private uploadFile(chunk: ChunkRecordedPayload): ReturnType<typeof uploadFile> {
        return uploadFile(
            this.client,
            this.infoEvent.getRoomId(),
            new Blob(
                [chunk.buffer],
                {
                    type: this.getRecorder().contentType,
                },
            ),
        );
    }

    private async sendVoiceMessage(chunk: ChunkRecordedPayload, url: string, file: IEncryptedFile): Promise<void> {
        const content = createVoiceMessageContent(
            url,
            this.getRecorder().contentType,
            Math.round(chunk.length * 1000),
            chunk.buffer.length,
            file,
        );
        content["m.relates_to"] = {
            rel_type: RelationType.Reference,
            event_id: this.infoEvent.getId(),
        };
        content["io.element.voice_broadcast_chunk"] = {
            sequence: this.sequence++,
        };

        await this.client.sendMessage(this.infoEvent.getRoomId(), content);
    }

    private async sendInfoStateEvent(state: VoiceBroadcastInfoState): Promise<void> {
        // TODO Michael W: add error handling for state event
        await this.client.sendStateEvent(
            this.infoEvent.getRoomId(),
            VoiceBroadcastInfoEventType,
            {
                device_id: this.client.getDeviceId(),
                state,
                last_chunk_sequence: this.sequence,
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: this.infoEvent.getId(),
                },
            } as VoiceBroadcastInfoEventContent,
            this.client.getUserId(),
        );
    }

    private async stopRecorder(): Promise<void> {
        if (!this.recorder) {
            return;
        }

        try {
            const lastChunk = await this.recorder.stop();
            if (lastChunk) {
                await this.onChunkRecorded(lastChunk);
            }
        } catch (err) {
            logger.warn("error stopping voice broadcast recorder", err);
        }
    }
}
