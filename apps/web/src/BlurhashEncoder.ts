/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Request, type Response } from "./workers/blurhash.worker.ts";
import { WorkerManager } from "./WorkerManager";
import blurhashWorkerFactory from "./workers/blurhashWorkerFactory";

export class BlurhashEncoder {
    private static internalInstance = new BlurhashEncoder();

    public static get instance(): BlurhashEncoder {
        return BlurhashEncoder.internalInstance;
    }

    private readonly worker = new WorkerManager<Request, Response>(blurhashWorkerFactory());

    public getBlurhash(imageData: ImageData): Promise<string> {
        return this.worker.call({ imageData }).then((resp) => resp.blurhash);
    }
}
