/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Request, type Response } from "./workers/playback.worker";
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
