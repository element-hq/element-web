/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createBlobRangeReader, dataView, readAscii, startsWith } from "./bytes";

/** The eight bytes at the start of every PNG. */
export const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";

/** A chunk of a PNG, as found by {@link readPngChunks}. */
export interface PngChunk {
    /** The four-character chunk type, such as `IHDR`. */
    type: string;
    /** Offset of the chunk in the file, including its length and type fields. */
    start: number;
    /** Offset just past the chunk's CRC. */
    end: number;
    /** Reads the chunk's data, without its length, type or CRC. */
    readData(): Promise<Uint8Array<ArrayBuffer>>;
}

/**
 * Walks the chunks of a PNG, up to and including `IEND`. Only the chunk headers are read, plus the data of any
 * chunk whose {@link PngChunk.readData} is called, so callers looking for an early chunk can stop without
 * reading the rest of the file.
 *
 * Chunk CRCs are not checked.
 *
 * @param blob - the PNG
 * @yields each chunk in file order
 * @throws {Error} if the blob is not a PNG, or a chunk runs past the end of it
 */
export async function* readPngChunks(blob: Blob): AsyncGenerator<PngChunk, void, undefined> {
    const read = createBlobRangeReader(blob);
    if (!startsWith(await read(0, PNG_SIGNATURE.length), PNG_SIGNATURE)) throw new Error("Not a PNG");

    let offset = PNG_SIGNATURE.length;
    let type: string | undefined;
    while (type !== "IEND") {
        const header = await read(offset, 8);
        if (header.length < 8) throw new Error("Unexpected end of PNG");
        const length = dataView(header).getUint32(0);
        type = readAscii(header, 4, 4);
        const start = offset;
        const end = start + 12 + length;
        if (end > blob.size) throw new Error(`Bad PNG chunk length at ${start}`);

        yield { type, start, end, readData: () => read(start + 8, length) };
        offset = end;
    }
}
