/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

// @ts-ignore - `.ts` is needed here to make TS happy
import { Request, Response } from "./workers/playback.worker";
import { WorkerManager } from "./WorkerManager";
import playbackWorkerFactory from "./workers/playbackWorkerFactory";

export class PlaybackEncoder {
    private static internalInstance = new PlaybackEncoder();

    public static get instance(): PlaybackEncoder {
        return PlaybackEncoder.internalInstance;
    }

    private readonly worker = new WorkerManager<Request, Response>(playbackWorkerFactory());

    public getPlaybackWaveform(input: Float32Array): Promise<number[]> {
        return this.worker.call({ data: Array.from(input) }).then((resp) => resp.waveform);
    }
}
