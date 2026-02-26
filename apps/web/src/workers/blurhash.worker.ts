/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { encode } from "blurhash";

import { type WorkerPayload } from "./worker";

const ctx: Worker = self as any;

export interface Request {
    imageData: ImageData;
}

export interface Response {
    blurhash: string;
}

ctx.addEventListener("message", (event: MessageEvent<Request & WorkerPayload>): void => {
    const { seq, imageData } = event.data;
    const blurhash = encode(
        imageData.data,
        imageData.width,
        imageData.height,
        // use 4 components on the longer dimension, if square then both
        imageData.width >= imageData.height ? 4 : 3,
        imageData.height >= imageData.width ? 4 : 3,
    );

    ctx.postMessage({ seq, blurhash });
});
