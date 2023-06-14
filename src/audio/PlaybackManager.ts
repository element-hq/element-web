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

import { Playback, PlaybackState } from "./Playback";
import { ManagedPlayback } from "./ManagedPlayback";
import { DEFAULT_WAVEFORM } from "./consts";

/**
 * Handles management of playback instances to ensure certain functionality, like
 * one playback operating at any one time.
 */
export class PlaybackManager {
    private static internalInstance: PlaybackManager;

    private instances: ManagedPlayback[] = [];

    public static get instance(): PlaybackManager {
        if (!PlaybackManager.internalInstance) {
            PlaybackManager.internalInstance = new PlaybackManager();
        }
        return PlaybackManager.internalInstance;
    }

    /**
     * Pauses all other playback instances. If no playback is provided, all playing
     * instances are paused.
     * @param playback Optional. The playback to leave untouched.
     */
    public pauseAllExcept(playback?: Playback): void {
        this.instances
            .filter((p) => p !== playback && p.currentState === PlaybackState.Playing)
            .forEach((p) => p.pause());
    }

    public destroyPlaybackInstance(playback: ManagedPlayback): void {
        this.instances = this.instances.filter((p) => p !== playback);
    }

    public createPlaybackInstance(buf: ArrayBuffer, waveform = DEFAULT_WAVEFORM): Playback {
        const instance = new ManagedPlayback(this, buf, waveform);
        this.instances.push(instance);
        return instance;
    }
}
