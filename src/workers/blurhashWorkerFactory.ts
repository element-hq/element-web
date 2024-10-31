/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

export default function factory(options?: WorkerOptions | undefined): Worker {
    return new Worker(
        /* webpackChunkName: "blurhash.worker" */ new URL("./blurhash.worker.ts", import.meta.url),
        options,
    );
}
