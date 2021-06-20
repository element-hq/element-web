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

import {AsyncStoreWithClient} from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import {ActionPayload} from "../dispatcher/payloads";
import {VoiceRecording} from "../voice/VoiceRecording";

interface IState {
    recording?: VoiceRecording;
}

export class VoiceRecordingStore extends AsyncStoreWithClient<IState> {
    private static internalInstance: VoiceRecordingStore;

    public constructor() {
        super(defaultDispatcher, {});
    }

    /**
     * Gets the active recording instance, if any.
     */
    public get activeRecording(): VoiceRecording | null {
        return this.state.recording;
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
     * Starts a new recording if one isn't already in progress. Note that this simply
     * creates a recording instance - whether or not recording is actively in progress
     * can be seen via the VoiceRecording class.
     * @returns {VoiceRecording} The recording.
     */
    public startRecording(): VoiceRecording {
        if (!this.matrixClient) throw new Error("Cannot start a recording without a MatrixClient");
        if (this.state.recording) throw new Error("A recording is already in progress");

        const recording = new VoiceRecording(this.matrixClient);

        // noinspection JSIgnoredPromiseFromCall - we can safely run this async
        this.updateState({recording});

        return recording;
    }

    /**
     * Disposes of the current recording, no matter the state of it.
     * @returns {Promise<void>} Resolves when complete.
     */
    public disposeRecording(): Promise<void> {
        if (this.state.recording) {
            this.state.recording.destroy(); // stops internally
        }
        return this.updateState({recording: null});
    }
}

window.mxVoiceRecordingStore = VoiceRecordingStore.instance;
