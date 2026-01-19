/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default function factory(options?: WorkerOptions | undefined): Worker {
    return new Worker(
        /* webpackChunkName: "event-index.worker" */ new URL("./webEventIndex.worker.ts", import.meta.url),
        options,
    );
}
