/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Optional } from "matrix-events-sdk";
import { Room, IEventRelation, RelationType } from "matrix-js-sdk/src/matrix";

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { createVoiceMessageRecording, VoiceMessageRecording } from "../audio/VoiceMessageRecording";

const SEPARATOR = "|";

interface IState {
    [voiceRecordingId: string]: Optional<VoiceMessageRecording>;
}

export class VoiceRecordingStore extends AsyncStoreWithClient<IState> {
    private static internalInstance: VoiceRecordingStore;

    public constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): VoiceRecordingStore {
        if (!this.internalInstance) {
            this.internalInstance = new VoiceRecordingStore();
            this.internalInstance.start();
        }
        return this.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // Nothing to do, but we're required to override the function
        return;
    }

    public static getVoiceRecordingId(room: Room, relation?: IEventRelation): string {
        if (relation?.rel_type === "io.element.thread" || relation?.rel_type === RelationType.Thread) {
            return room.roomId + SEPARATOR + relation.event_id;
        } else {
            return room.roomId;
        }
    }

    /**
     * Gets the active recording instance, if any.
     * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to get the recording in.
     * @returns {Optional<VoiceRecording>} The recording, if any.
     */
    public getActiveRecording(voiceRecordingId: string): Optional<VoiceMessageRecording> {
        return this.state[voiceRecordingId];
    }

    /**
     * Starts a new recording if one isn't already in progress. Note that this simply
     * creates a recording instance - whether or not recording is actively in progress
     * can be seen via the VoiceRecording class.
     * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to start recording in.
     * @returns {VoiceRecording} The recording.
     */
    public startRecording(voiceRecordingId?: string): VoiceMessageRecording {
        if (!this.matrixClient) throw new Error("Cannot start a recording without a MatrixClient");
        if (!voiceRecordingId) throw new Error("Recording must be associated with a room");
        if (this.state[voiceRecordingId]) throw new Error("A recording is already in progress");

        const recording = createVoiceMessageRecording(this.matrixClient);

        // noinspection JSIgnoredPromiseFromCall - we can safely run this async
        this.updateState({ ...this.state, [voiceRecordingId]: recording });

        return recording;
    }

    /**
     * Disposes of the current recording, no matter the state of it.
     * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to dispose of the recording in.
     * @returns {Promise<void>} Resolves when complete.
     */
    public disposeRecording(voiceRecordingId: string): Promise<void> {
        this.state[voiceRecordingId]?.destroy(); // stops internally

        const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            [voiceRecordingId]: _toDelete,
            ...newState
        } = this.state;
        // unexpectedly AsyncStore.updateState merges state
        // AsyncStore.reset actually just *sets*
        return this.reset(newState);
    }
}

window.mxVoiceRecordingStore = VoiceRecordingStore.instance;
