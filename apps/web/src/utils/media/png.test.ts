/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import { dataView } from "./bytes";
import { PNG_SIGNATURE, type PngChunk, readPngChunks } from "./png";

/** Builds a PNG chunk holding `data`, with a zero CRC as the walker does not check it. */
function chunk(type: string, data: Uint8Array | number = 0): Uint8Array<ArrayBuffer> {
    const body = typeof data === "number" ? new Uint8Array(data) : data;
    const bytes = new Uint8Array(12 + body.length);
    dataView(bytes).setUint32(0, body.length);
    for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
    bytes.set(body, 8);
    return bytes;
}

function png(...parts: Uint8Array<ArrayBuffer>[]): Blob {
    return new Blob([Buffer.from(PNG_SIGNATURE, "latin1"), ...parts], { type: "image/png" });
}

async function collect(blob: Blob): Promise<PngChunk[]> {
    const chunks: PngChunk[] = [];
    for await (const chunk of readPngChunks(blob)) chunks.push(chunk);
    return chunks;
}

describe("readPngChunks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("lists the chunks with their positions", async () => {
        const chunks = await collect(png(chunk("IHDR", 13), chunk("tEXt", 5), chunk("IEND")));

        expect(chunks.map(({ type, start, end }) => ({ type, start, end }))).toEqual([
            { type: "IHDR", start: 8, end: 33 },
            { type: "tEXt", start: 33, end: 50 },
            { type: "IEND", start: 50, end: 62 },
        ]);
    });

    it("reads a chunk's data on request", async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const chunks = await collect(png(chunk("IHDR", 13), chunk("pHYs", data), chunk("IEND")));

        await expect(chunks[1].readData()).resolves.toEqual(data);
    });

    it("stops at IEND, ignoring anything after it", async () => {
        const chunks = await collect(png(chunk("IHDR", 13), chunk("IEND"), new Uint8Array([1, 2, 3])));
        expect(chunks.map(({ type }) => type)).toEqual(["IHDR", "IEND"]);
    });

    it("does not read past the chunks the caller asks for", async () => {
        const blob = png(chunk("IHDR", 13), chunk("IDAT", 1_000_000), chunk("IEND"));
        const slice = vi.spyOn(blob, "slice");

        for await (const { type } of readPngChunks(blob)) {
            if (type === "IHDR") break;
        }

        const furthest = Math.max(...slice.mock.calls.map(([, end]) => end ?? blob.size));
        expect(furthest).toBeLessThan(100_000);
    });

    it("rejects a blob which is not a PNG", async () => {
        await expect(collect(new Blob(["not a png"]))).rejects.toThrow("Not a PNG");
    });

    it("rejects a chunk which runs past the end of the blob", async () => {
        const truncated = chunk("IDAT", 100).subarray(0, 50);
        await expect(collect(png(chunk("IHDR", 13), truncated))).rejects.toThrow("Bad PNG chunk length");
    });

    it("rejects a PNG which ends without IEND", async () => {
        await expect(collect(png(chunk("IHDR", 13)))).rejects.toThrow("Unexpected end of PNG");
    });
});
