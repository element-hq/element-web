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

import {
    EventType,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    RelationType,
} from "matrix-js-sdk/src/matrix";
import { Relations, RelationsEvent } from "matrix-js-sdk/src/models/relations";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { Playback, PlaybackState } from "../../audio/Playback";
import { PlaybackManager } from "../../audio/PlaybackManager";
import { getReferenceRelationsForEvent } from "../../events";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import { IDestroyable } from "../../utils/IDestroyable";
import { VoiceBroadcastChunkEventType } from "..";

export enum VoiceBroadcastPlaybackState {
    Paused,
    Playing,
    Stopped,
}

export enum VoiceBroadcastPlaybackEvent {
    LengthChanged = "length_changed",
    StateChanged = "state_changed",
}

interface EventMap {
    [VoiceBroadcastPlaybackEvent.LengthChanged]: (length: number) => void;
    [VoiceBroadcastPlaybackEvent.StateChanged]: (state: VoiceBroadcastPlaybackState) => void;
}

export class VoiceBroadcastPlayback
    extends TypedEventEmitter<VoiceBroadcastPlaybackEvent, EventMap>
    implements IDestroyable {
    private state = VoiceBroadcastPlaybackState.Stopped;
    private chunkEvents = new Map<string, MatrixEvent>();
    /** Holds the playback qeue with a 1-based index (sequence number) */
    private queue: Playback[] = [];
    private currentlyPlaying: Playback;
    private relations: Relations;

    public constructor(
        public readonly infoEvent: MatrixEvent,
        private client: MatrixClient,
    ) {
        super();
        this.setUpRelations();
    }

    private addChunkEvent(event: MatrixEvent): boolean {
        const eventId = event.getId();

        if (!eventId
            || eventId.startsWith("~!") // don't add local events
            || event.getContent()?.msgtype !== MsgType.Audio // don't add non-audio event
            || this.chunkEvents.has(eventId)) {
            return false;
        }

        this.chunkEvents.set(eventId, event);
        return true;
    }

    private setUpRelations(): void {
        const relations = getReferenceRelationsForEvent(this.infoEvent, EventType.RoomMessage, this.client);

        if (!relations) {
            // No related events, yet. Set up relation watcher.
            this.infoEvent.on(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
            return;
        }

        this.relations = relations;
        relations.getRelations()?.forEach(e => this.addChunkEvent(e));
        relations.on(RelationsEvent.Add, this.onRelationsEventAdd);

        if (this.chunkEvents.size > 0) {
            this.emitLengthChanged();
        }
    }

    private onRelationsEventAdd = (event: MatrixEvent) => {
        if (this.addChunkEvent(event)) {
            this.emitLengthChanged();
        }
    };

    private emitLengthChanged(): void {
        this.emit(VoiceBroadcastPlaybackEvent.LengthChanged, this.chunkEvents.size);
    }

    private onRelationsCreated = (relationType: string) => {
        if (relationType !== RelationType.Reference) {
            return;
        }

        this.infoEvent.off(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
        this.setUpRelations();
    };

    private async loadChunks(): Promise<void> {
        const relations = getReferenceRelationsForEvent(this.infoEvent, EventType.RoomMessage, this.client);
        const chunkEvents = relations?.getRelations();

        if (!chunkEvents) {
            return;
        }

        for (const chunkEvent of chunkEvents) {
            await this.enqueueChunk(chunkEvent);
        }
    }

    private async enqueueChunk(chunkEvent: MatrixEvent) {
        const sequenceNumber = parseInt(chunkEvent.getContent()?.[VoiceBroadcastChunkEventType]?.sequence, 10);
        if (isNaN(sequenceNumber)) return;

        const helper = new MediaEventHelper(chunkEvent);
        const blob = await helper.sourceBlob.value;
        const buffer = await blob.arrayBuffer();
        const playback = PlaybackManager.instance.createPlaybackInstance(buffer);
        await playback.prepare();
        playback.clockInfo.populatePlaceholdersFrom(chunkEvent);
        this.queue[sequenceNumber] = playback;
        playback.on(UPDATE_EVENT, (state) => this.onPlaybackStateChange(playback, state));
    }

    private onPlaybackStateChange(playback: Playback, newState: PlaybackState) {
        if (newState !== PlaybackState.Stopped) {
            return;
        }

        const next = this.queue[this.queue.indexOf(playback) + 1];

        if (next) {
            this.currentlyPlaying = next;
            next.play();
            return;
        }

        this.setState(VoiceBroadcastPlaybackState.Stopped);
    }

    public async start(): Promise<void> {
        if (this.queue.length === 0) {
            await this.loadChunks();
        }

        if (this.queue.length === 0 || !this.queue[1]) {
            // set to stopped fi the queue is empty of the first chunk (sequence number: 1-based index) is missing
            this.setState(VoiceBroadcastPlaybackState.Stopped);
            return;
        }

        this.setState(VoiceBroadcastPlaybackState.Playing);
        // index of the first schunk is the first sequence number
        const first = this.queue[1];
        this.currentlyPlaying = first;
        await first.play();
    }

    public get length(): number {
        return this.chunkEvents.size;
    }

    public stop(): void {
        this.setState(VoiceBroadcastPlaybackState.Stopped);

        if (this.currentlyPlaying) {
            this.currentlyPlaying.stop();
        }
    }

    public pause(): void {
        if (!this.currentlyPlaying) return;

        this.setState(VoiceBroadcastPlaybackState.Paused);
        this.currentlyPlaying.pause();
    }

    public resume(): void {
        if (!this.currentlyPlaying) return;

        this.setState(VoiceBroadcastPlaybackState.Playing);
        this.currentlyPlaying.play();
    }

    /**
     * Toggles the playback:
     * stopped → playing
     * playing → paused
     * paused → playing
     */
    public async toggle() {
        if (this.state === VoiceBroadcastPlaybackState.Stopped) {
            await this.start();
            return;
        }

        if (this.state === VoiceBroadcastPlaybackState.Paused) {
            this.resume();
            return;
        }

        this.pause();
    }

    public getState(): VoiceBroadcastPlaybackState {
        return this.state;
    }

    private setState(state: VoiceBroadcastPlaybackState): void {
        if (this.state === state) {
            return;
        }

        this.state = state;
        this.emit(VoiceBroadcastPlaybackEvent.StateChanged, state);
    }

    private destroyQueue(): void {
        this.queue.forEach(p => p.destroy());
        this.queue = [];
    }

    public destroy(): void {
        if (this.relations) {
            this.relations.off(RelationsEvent.Add, this.onRelationsEventAdd);
        }

        this.infoEvent.off(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
        this.removeAllListeners();
        this.destroyQueue();
    }
}
