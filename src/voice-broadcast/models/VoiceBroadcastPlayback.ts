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
    MsgType,
    RelationType,
} from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";
import { SimpleObservable } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import { Playback, PlaybackInterface, PlaybackState } from "../../audio/Playback";
import { PlaybackManager } from "../../audio/PlaybackManager";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import { IDestroyable } from "../../utils/IDestroyable";
import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";
import { RelationsHelper, RelationsHelperEvent } from "../../events/RelationsHelper";
import { VoiceBroadcastChunkEvents } from "../utils/VoiceBroadcastChunkEvents";

export enum VoiceBroadcastPlaybackState {
    Paused,
    Playing,
    Stopped,
    Buffering,
}

export enum VoiceBroadcastPlaybackEvent {
    PositionChanged = "position_changed",
    LengthChanged = "length_changed",
    StateChanged = "state_changed",
    InfoStateChanged = "info_state_changed",
}

interface EventMap {
    [VoiceBroadcastPlaybackEvent.PositionChanged]: (position: number) => void;
    [VoiceBroadcastPlaybackEvent.LengthChanged]: (length: number) => void;
    [VoiceBroadcastPlaybackEvent.StateChanged]: (
        state: VoiceBroadcastPlaybackState,
        playback: VoiceBroadcastPlayback
    ) => void;
    [VoiceBroadcastPlaybackEvent.InfoStateChanged]: (state: VoiceBroadcastInfoState) => void;
}

export class VoiceBroadcastPlayback
    extends TypedEventEmitter<VoiceBroadcastPlaybackEvent, EventMap>
    implements IDestroyable, PlaybackInterface {
    private state = VoiceBroadcastPlaybackState.Stopped;
    private chunkEvents = new VoiceBroadcastChunkEvents();
    private playbacks = new Map<string, Playback>();
    private currentlyPlaying: MatrixEvent | null = null;
    /** @var total duration of all chunks in milliseconds */
    private duration = 0;
    /** @var current playback position in milliseconds */
    private position = 0;
    public readonly liveData = new SimpleObservable<number[]>();

    // set vial addInfoEvent() in constructor
    private infoState!: VoiceBroadcastInfoState;
    private lastInfoEvent!: MatrixEvent;

    // set via setUpRelationsHelper() in constructor
    private chunkRelationHelper!: RelationsHelper;
    private infoRelationHelper!: RelationsHelper;

    public constructor(
        public readonly infoEvent: MatrixEvent,
        private client: MatrixClient,
    ) {
        super();
        this.addInfoEvent(this.infoEvent);
        this.setUpRelationsHelper();
    }

    private async setUpRelationsHelper(): Promise<void> {
        this.infoRelationHelper = new RelationsHelper(
            this.infoEvent,
            RelationType.Reference,
            VoiceBroadcastInfoEventType,
            this.client,
        );
        this.infoRelationHelper.getCurrent().forEach(this.addInfoEvent);

        if (this.infoState !== VoiceBroadcastInfoState.Stopped) {
            // Only required if not stopped. Stopped is the final state.
            this.infoRelationHelper.on(RelationsHelperEvent.Add, this.addInfoEvent);

            try {
                await this.infoRelationHelper.emitFetchCurrent();
            } catch (err) {
                logger.warn("error fetching server side relation for voice broadcast info", err);
                // fall back to local events
                this.infoRelationHelper.emitCurrent();
            }
        }

        this.chunkRelationHelper = new RelationsHelper(
            this.infoEvent,
            RelationType.Reference,
            EventType.RoomMessage,
            this.client,
        );
        this.chunkRelationHelper.on(RelationsHelperEvent.Add, this.addChunkEvent);

        try {
            // TODO Michael W: only fetch events if needed, blocked by PSF-1708
            await this.chunkRelationHelper.emitFetchCurrent();
        } catch (err) {
            logger.warn("error fetching server side relation for voice broadcast chunks", err);
            // fall back to local events
            this.chunkRelationHelper.emitCurrent();
        }
    }

    private addChunkEvent = async (event: MatrixEvent): Promise<boolean> => {
        if (event.getContent()?.msgtype !== MsgType.Audio) {
            // skip non-audio event
            return false;
        }

        this.chunkEvents.addEvent(event);
        this.setDuration(this.chunkEvents.getLength());

        if (this.getState() !== VoiceBroadcastPlaybackState.Stopped) {
            await this.enqueueChunk(event);
        }

        if (this.getState() === VoiceBroadcastPlaybackState.Buffering) {
            await this.start();
        }

        return true;
    };

    private addInfoEvent = (event: MatrixEvent): void => {
        if (this.lastInfoEvent && this.lastInfoEvent.getTs() >= event.getTs()) {
            // Only handle newer events
            return;
        }

        const state = event.getContent()?.state;

        if (!Object.values(VoiceBroadcastInfoState).includes(state)) {
            // Do not handle unknown voice broadcast states
            return;
        }

        this.lastInfoEvent = event;
        this.setInfoState(state);
    };

    private async enqueueChunks(): Promise<void> {
        const promises = this.chunkEvents.getEvents().reduce((promises, event: MatrixEvent) => {
            if (!this.playbacks.has(event.getId() || "")) {
                promises.push(this.enqueueChunk(event));
            }
            return promises;
        }, [] as Promise<void>[]);

        await Promise.all(promises);
    }

    private async enqueueChunk(chunkEvent: MatrixEvent): Promise<void> {
        const eventId = chunkEvent.getId();

        if (!eventId) {
            logger.warn("got voice broadcast chunk event without ID", this.infoEvent, chunkEvent);
            return;
        }

        const helper = new MediaEventHelper(chunkEvent);
        const blob = await helper.sourceBlob.value;
        const buffer = await blob.arrayBuffer();
        const playback = PlaybackManager.instance.createPlaybackInstance(buffer);
        await playback.prepare();
        playback.clockInfo.populatePlaceholdersFrom(chunkEvent);
        this.playbacks.set(eventId, playback);
        playback.on(UPDATE_EVENT, (state) => this.onPlaybackStateChange(chunkEvent, state));
        playback.clockInfo.liveData.onUpdate(([position]) => {
            this.onPlaybackPositionUpdate(chunkEvent, position);
        });
    }

    private onPlaybackPositionUpdate = (
        event: MatrixEvent,
        position: number,
    ): void => {
        if (event !== this.currentlyPlaying) return;

        const newPosition = this.chunkEvents.getLengthTo(event) + (position * 1000); // observable sends seconds

        // do not jump backwards - this can happen when transiting from one to another chunk
        if (newPosition < this.position) return;

        this.setPosition(newPosition);
    };

    private setDuration(duration: number): void {
        const shouldEmit = this.duration !== duration;
        this.duration = duration;

        if (shouldEmit) {
            this.emit(VoiceBroadcastPlaybackEvent.LengthChanged, this.duration);
            this.liveData.update([this.timeSeconds, this.durationSeconds]);
        }
    }

    private setPosition(position: number): void {
        const shouldEmit = this.position !== position;
        this.position = position;

        if (shouldEmit) {
            this.emit(VoiceBroadcastPlaybackEvent.PositionChanged, this.position);
            this.liveData.update([this.timeSeconds, this.durationSeconds]);
        }
    }

    private onPlaybackStateChange = async (event: MatrixEvent, newState: PlaybackState): Promise<void> => {
        if (event !== this.currentlyPlaying) return;
        if (newState !== PlaybackState.Stopped) return;

        await this.playNext();
    };

    private async playNext(): Promise<void> {
        if (!this.currentlyPlaying) return;

        const next = this.chunkEvents.getNext(this.currentlyPlaying);

        if (next) {
            return this.playEvent(next);
        }

        if (this.getInfoState() === VoiceBroadcastInfoState.Stopped) {
            this.stop();
        } else {
            // No more chunks available, although the broadcast is not finished → enter buffering state.
            this.setState(VoiceBroadcastPlaybackState.Buffering);
        }
    }

    private async playEvent(event: MatrixEvent): Promise<void> {
        this.setState(VoiceBroadcastPlaybackState.Playing);
        this.currentlyPlaying = event;
        await this.getPlaybackForEvent(event)?.play();
    }

    private getPlaybackForEvent(event: MatrixEvent): Playback | undefined {
        const eventId = event.getId();

        if (!eventId) {
            logger.warn("event without id occurred");
            return;
        }

        const playback = this.playbacks.get(eventId);

        if (!playback) {
            // logging error, because this should not happen
            logger.warn("unable to find playback for event", event);
        }

        return playback;
    }

    public get currentState(): PlaybackState {
        return PlaybackState.Playing;
    }

    public get timeSeconds(): number {
        return this.position / 1000;
    }

    public get durationSeconds(): number {
        return this.duration / 1000;
    }

    public async skipTo(timeSeconds: number): Promise<void> {
        const time = timeSeconds * 1000;
        const event = this.chunkEvents.findByTime(time);

        if (!event) return;

        const currentPlayback = this.currentlyPlaying
            ? this.getPlaybackForEvent(this.currentlyPlaying)
            : null;

        const skipToPlayback = this.getPlaybackForEvent(event);

        if (!skipToPlayback) {
            logger.error("voice broadcast chunk to skip to not found", event);
            return;
        }

        this.currentlyPlaying = event;

        if (currentPlayback && currentPlayback !== skipToPlayback) {
            currentPlayback.off(UPDATE_EVENT, this.onPlaybackStateChange);
            await currentPlayback.stop();
            currentPlayback.on(UPDATE_EVENT, this.onPlaybackStateChange);
        }

        const offsetInChunk = time - this.chunkEvents.getLengthTo(event);
        await skipToPlayback.skipTo(offsetInChunk / 1000);

        if (currentPlayback !== skipToPlayback) {
            await skipToPlayback.play();
        }

        this.setPosition(time);
    }

    public async start(): Promise<void> {
        await this.enqueueChunks();
        const chunkEvents = this.chunkEvents.getEvents();

        const toPlay = this.getInfoState() === VoiceBroadcastInfoState.Stopped
            ? chunkEvents[0] // start at the beginning for an ended voice broadcast
            : chunkEvents[chunkEvents.length - 1]; // start at the current chunk for an ongoing voice broadcast

        if (this.playbacks.has(toPlay?.getId() || "")) {
            return this.playEvent(toPlay);
        }

        this.setState(VoiceBroadcastPlaybackState.Buffering);
    }

    public stop(): void {
        this.setState(VoiceBroadcastPlaybackState.Stopped);
        this.currentlyPlaying = null;
        this.setPosition(0);
    }

    public pause(): void {
        // stopped voice broadcasts cannot be paused
        if (this.getState() === VoiceBroadcastPlaybackState.Stopped) return;

        this.setState(VoiceBroadcastPlaybackState.Paused);
        if (!this.currentlyPlaying) return;
        this.getPlaybackForEvent(this.currentlyPlaying)?.pause();
    }

    public resume(): void {
        if (!this.currentlyPlaying) {
            // no playback to resume, start from the beginning
            this.start();
            return;
        }

        this.setState(VoiceBroadcastPlaybackState.Playing);
        this.getPlaybackForEvent(this.currentlyPlaying)?.play();
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
        this.emit(VoiceBroadcastPlaybackEvent.StateChanged, state, this);
    }

    public getInfoState(): VoiceBroadcastInfoState {
        return this.infoState;
    }

    private setInfoState(state: VoiceBroadcastInfoState): void {
        if (this.infoState === state) {
            return;
        }

        this.infoState = state;
        this.emit(VoiceBroadcastPlaybackEvent.InfoStateChanged, state);
    }

    public destroy(): void {
        this.chunkRelationHelper.destroy();
        this.infoRelationHelper.destroy();
        this.removeAllListeners();

        this.chunkEvents = new VoiceBroadcastChunkEvents();
        this.playbacks.forEach(p => p.destroy());
        this.playbacks = new Map<string, Playback>();
    }
}
