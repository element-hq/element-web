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
    ClientEvent,
    ClientEventHandlerMap,
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
import { createReconnectedListener } from "../../utils/connection";
import { localNotificationsAreSilenced } from "../../utils/notifications";

export enum VoiceBroadcastRecordingEvent {
    StateChanged = "liveness_changed",
    TimeLeftChanged = "time_left_changed",
}

export type VoiceBroadcastRecordingState = VoiceBroadcastInfoState | "connection_error";

interface EventMap {
    [VoiceBroadcastRecordingEvent.StateChanged]: (state: VoiceBroadcastRecordingState) => void;
    [VoiceBroadcastRecordingEvent.TimeLeftChanged]: (timeLeft: number) => void;
}

export class VoiceBroadcastRecording
    extends TypedEventEmitter<VoiceBroadcastRecordingEvent, EventMap>
    implements IDestroyable
{
    private state: VoiceBroadcastRecordingState;
    private recorder: VoiceBroadcastRecorder | null = null;
    private dispatcherRef: string;
    private chunkEvents = new VoiceBroadcastChunkEvents();
    private chunkRelationHelper: RelationsHelper;
    private maxLength: number;
    private timeLeft: number;
    private toRetry: Array<() => Promise<void>> = [];
    private reconnectedListener: ClientEventHandlerMap[ClientEvent.Sync];
    private roomId: string;
    private infoEventId: string;

    /**
     * Broadcast chunks have a sequence number to bring them in the correct order and to know if a message is missing.
     * This variable holds the last sequence number.
     * Starts with 0 because there is no chunk at the beginning of a broadcast.
     * Will be incremented when a chunk message is created.
     */
    private sequence = 0;

    public constructor(
        public readonly infoEvent: MatrixEvent,
        private client: MatrixClient,
        initialState?: VoiceBroadcastInfoState,
    ) {
        super();
        this.maxLength = getMaxBroadcastLength();
        this.timeLeft = this.maxLength;
        this.infoEventId = this.determineEventIdFromInfoEvent();
        this.roomId = this.determineRoomIdFromInfoEvent();

        if (initialState) {
            this.state = initialState;
        } else {
            this.state = this.determineInitialStateFromInfoEvent();
        }

        // TODO Michael W: listen for state updates

        this.infoEvent.on(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
        this.dispatcherRef = dis.register(this.onAction);
        this.chunkRelationHelper = this.initialiseChunkEventRelation();
        this.reconnectedListener = createReconnectedListener(this.onReconnect);
        this.client.on(ClientEvent.Sync, this.reconnectedListener);
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
            (!event.getId() && !event.getTxnId()) ||
            event.getContent()?.msgtype !== MsgType.Audio // don't add non-audio event
        ) {
            return;
        }

        this.chunkEvents.addEvent(event);
    };

    private determineEventIdFromInfoEvent(): string {
        const infoEventId = this.infoEvent.getId();

        if (!infoEventId) {
            throw new Error("Cannot create broadcast for info event without Id.");
        }

        return infoEventId;
    }

    private determineRoomIdFromInfoEvent(): string {
        const roomId = this.infoEvent.getRoomId();

        if (!roomId) {
            throw new Error(`Cannot create broadcast for unknown room (info event ${this.infoEventId})`);
        }

        return roomId;
    }

    /**
     * Determines the initial broadcast state.
     * Checks all related events. If one has the "stopped" state → stopped, else started.
     */
    private determineInitialStateFromInfoEvent(): VoiceBroadcastRecordingState {
        const room = this.client.getRoom(this.roomId);
        const relations = room
            ?.getUnfilteredTimelineSet()
            ?.relations?.getChildEventsForEvent(this.infoEventId, RelationType.Reference, VoiceBroadcastInfoEventType);
        const relatedEvents = relations?.getRelations();
        return !relatedEvents?.find((event: MatrixEvent) => {
            return event.getContent()?.state === VoiceBroadcastInfoState.Stopped;
        })
            ? VoiceBroadcastInfoState.Started
            : VoiceBroadcastInfoState.Stopped;
    }

    public getTimeLeft(): number {
        return this.timeLeft;
    }

    /**
     * Retries failed actions on reconnect.
     */
    private onReconnect = async (): Promise<void> => {
        // Do nothing if not in connection_error state.
        if (this.state !== "connection_error") return;

        // Copy the array, so that it is possible to remove elements from it while iterating over the original.
        const toRetryCopy = [...this.toRetry];

        for (const retryFn of this.toRetry) {
            try {
                await retryFn();
                // Successfully retried. Remove from array copy.
                toRetryCopy.splice(toRetryCopy.indexOf(retryFn), 1);
            } catch {
                // The current retry callback failed. Stop the loop.
                break;
            }
        }

        this.toRetry = toRetryCopy;

        if (this.toRetry.length === 0) {
            // Everything has been successfully retried. Recover from error state to paused.
            await this.pause();
        }
    };

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
        if (
            (
                [VoiceBroadcastInfoState.Stopped, VoiceBroadcastInfoState.Paused] as VoiceBroadcastRecordingState[]
            ).includes(this.state)
        )
            return;

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

        if (
            (
                [VoiceBroadcastInfoState.Started, VoiceBroadcastInfoState.Resumed] as VoiceBroadcastRecordingState[]
            ).includes(this.getState())
        ) {
            return this.pause();
        }
    };

    public getState(): VoiceBroadcastRecordingState {
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
        this.client.off(ClientEvent.Sync, this.reconnectedListener);
    }

    private onBeforeRedaction = (): void => {
        if (this.getState() !== VoiceBroadcastInfoState.Stopped) {
            this.setState(VoiceBroadcastInfoState.Stopped);
            // destroy cleans up everything
            this.destroy();
        }
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action !== "call_state") return;

        // pause on any call action
        this.pause();
    };

    private setState(state: VoiceBroadcastRecordingState): void {
        this.state = state;
        this.emit(VoiceBroadcastRecordingEvent.StateChanged, this.state);
    }

    private onCurrentChunkLengthUpdated = (currentChunkLength: number): void => {
        this.setTimeLeft(this.maxLength - this.chunkEvents.getLengthSeconds() - currentChunkLength);
    };

    private onChunkRecorded = async (chunk: ChunkRecordedPayload): Promise<void> => {
        const uploadAndSendFn = async (): Promise<void> => {
            const { url, file } = await this.uploadFile(chunk);
            await this.sendVoiceMessage(chunk, url, file);
        };

        await this.callWithRetry(uploadAndSendFn);
    };

    /**
     * This function is called on connection errors.
     * It sets the connection error state and stops the recorder.
     */
    private async onConnectionError(): Promise<void> {
        this.playConnectionErrorAudioNotification().catch(() => {
            // Error logged in playConnectionErrorAudioNotification().
        });
        await this.stopRecorder(false);
        this.setState("connection_error");
    }

    private async playConnectionErrorAudioNotification(): Promise<void> {
        if (localNotificationsAreSilenced(this.client)) {
            return;
        }

        // Audio files are added to the document in Element Web.
        // See <audio> elements in https://github.com/vector-im/element-web/blob/develop/src/vector/index.html
        const audioElement = document.querySelector<HTMLAudioElement>("audio#errorAudio");

        try {
            await audioElement?.play();
        } catch (e) {
            logger.warn("error playing 'errorAudio'", e);
        }
    }

    private async uploadFile(chunk: ChunkRecordedPayload): ReturnType<typeof uploadFile> {
        return uploadFile(
            this.client,
            this.roomId,
            new Blob([chunk.buffer], {
                type: this.getRecorder().contentType,
            }),
        );
    }

    private async sendVoiceMessage(chunk: ChunkRecordedPayload, url?: string, file?: IEncryptedFile): Promise<void> {
        /**
         * Increment the last sequence number and use it for this message.
         * Done outside of the sendMessageFn to get a scoped value.
         * Also see {@link VoiceBroadcastRecording.sequence}.
         */
        const sequence = ++this.sequence;

        const sendMessageFn = async (): Promise<void> => {
            const content = createVoiceMessageContent(
                url,
                this.getRecorder().contentType,
                Math.round(chunk.length * 1000),
                chunk.buffer.length,
                file,
            );
            content["m.relates_to"] = {
                rel_type: RelationType.Reference,
                event_id: this.infoEventId,
            };
            content["io.element.voice_broadcast_chunk"] = {
                sequence,
            };

            await this.client.sendMessage(this.roomId, content);
        };

        await this.callWithRetry(sendMessageFn);
    }

    /**
     * Sends an info state event with given state.
     * On error stores a resend function and setState(state) in {@link toRetry} and
     * sets the broadcast state to connection_error.
     */
    private async sendInfoStateEvent(state: VoiceBroadcastInfoState): Promise<void> {
        const sendEventFn = async (): Promise<void> => {
            await this.client.sendStateEvent(
                this.roomId,
                VoiceBroadcastInfoEventType,
                {
                    device_id: this.client.getDeviceId(),
                    state,
                    last_chunk_sequence: this.sequence,
                    ["m.relates_to"]: {
                        rel_type: RelationType.Reference,
                        event_id: this.infoEventId,
                    },
                } as VoiceBroadcastInfoEventContent,
                this.client.getSafeUserId(),
            );
        };

        await this.callWithRetry(sendEventFn);
    }

    /**
     * Calls the function.
     * On failure adds it to the retry list and triggers connection error.
     * {@link toRetry}
     * {@link onConnectionError}
     */
    private async callWithRetry(retryAbleFn: () => Promise<void>): Promise<void> {
        try {
            await retryAbleFn();
        } catch {
            this.toRetry.push(retryAbleFn);
            this.onConnectionError();
        }
    }

    private async stopRecorder(emit = true): Promise<void> {
        if (!this.recorder) {
            return;
        }

        try {
            const lastChunk = await this.recorder.stop();
            if (lastChunk && emit) {
                await this.onChunkRecorded(lastChunk);
            }
        } catch (err) {
            logger.warn("error stopping voice broadcast recorder", err);
        }
    }
}
