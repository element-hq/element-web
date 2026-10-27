/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { encode } from "blurhash";
import { ChromaHash, init as initChromaHash } from "@visualcommons/chromahash";

import { type WorkerPayload } from "./worker";

const ctx: Worker = self as any;

export interface Request {
    imageData: ImageData;
    mode: "blurhash" | "chromahash";
}

export interface Response {
    /**
     * The encoded hash: a blurhash string, or unpadded base64 of the ChromaHash bytes.
     * Undefined if encoding failed.
     */
    hash?: string;
}

function encodeBlurhash(imageData: ImageData): string {
    return encode(
        imageData.data,
        imageData.width,
        imageData.height,
        // use 4 components on the longer dimension, if square then both
        imageData.width >= imageData.height ? 4 : 3,
        imageData.height >= imageData.width ? 4 : 3,
    );
}

async function encodeChromaHash(imageData: ImageData): Promise<string> {
    // Fetches and instantiates the wasm on first use, a no-op afterwards
    await initChromaHash();
    const rgba = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
    const { hash } = ChromaHash.encode(imageData.width, imageData.height, rgba, "sRGB");
    // Unpadded base64, as is conventional in Matrix. Avoids pulling all of matrix-js-sdk into the worker.
    return btoa(String.fromCharCode(...hash)).replace(/=+$/, "");
}

ctx.addEventListener("message", async (event: MessageEvent<Request & WorkerPayload>): Promise<void> => {
    const { seq, imageData, mode } = event.data;

    let hash: string | undefined;
    try {
        hash = mode === "chromahash" ? await encodeChromaHash(imageData) : encodeBlurhash(imageData);
    } catch (e) {
        // Always reply, the caller waits on a response for this seq
        console.error(`Failed to encode ${mode}`, e);
    }

    ctx.postMessage({ seq, hash } satisfies Response & WorkerPayload);
});
