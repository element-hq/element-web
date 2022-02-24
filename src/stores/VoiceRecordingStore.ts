/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { ActionPayload } from "../dispatcher/payloads";
import { VoiceRecording } from "../audio/VoiceRecording";

interface IState {
    [roomId: string]: Optional<VoiceRecording>;
}

export class VoiceRecordingStore extends AsyncStoreWithClient<IState> {
    private static internalInstance: VoiceRecordingStore;

    public constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): VoiceRecordingStore {
        if (!VoiceRecordingStore.internalInstance) {
            VoiceRecordingStore.internalInstance = new VoiceRecordingStore();
        }
        return VoiceRecordingStore.internalInstance;
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // Nothing to do, but we're required to override the function
        return;
    }

    /**
     * Gets the active recording instance, if any.
     * @param {string} roomId The room ID to get the recording in.
     * @returns {Optional<VoiceRecording>} The recording, if any.
     */
    public getActiveRecording(roomId: string): Optional<VoiceRecording> {
        return this.state[roomId];
    }

    /**
     * Starts a new recording if one isn't already in progress. Note that this simply
     * creates a recording instance - whether or not recording is actively in progress
     * can be seen via the VoiceRecording class.
     * @param {string} roomId The room ID to start recording in.
     * @returns {VoiceRecording} The recording.
     */
    public startRecording(roomId: string): VoiceRecording {
        if (!this.matrixClient) throw new Error("Cannot start a recording without a MatrixClient");
        if (!roomId) throw new Error("Recording must be associated with a room");
        if (this.state[roomId]) throw new Error("A recording is already in progress");

        const recording = new VoiceRecording(this.matrixClient);

        // noinspection JSIgnoredPromiseFromCall - we can safely run this async
        this.updateState({ ...this.state, [roomId]: recording });

        return recording;
    }

    /**
     * Disposes of the current recording, no matter the state of it.
     * @param {string} roomId The room ID to dispose of the recording in.
     * @returns {Promise<void>} Resolves when complete.
     */
    public disposeRecording(roomId: string): Promise<void> {
        if (this.state[roomId]) {
            this.state[roomId].destroy(); // stops internally
        }

        const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            [roomId]: _toDelete,
            ...newState
        } = this.state;
        // unexpectedly AsyncStore.updateState merges state
        // AsyncStore.reset actually just *sets*
        return this.reset(newState);
    }
}

window.mxVoiceRecordingStore = VoiceRecordingStore.instance;
