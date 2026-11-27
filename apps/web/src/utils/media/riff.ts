/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * RIFF (Resource Interchange File Format) is the container used by WebP and WAV. A file is a 12-byte header
 * (`RIFF`, a little-endian 32-bit size and a four-character form type such as `WEBP` or `WAVE`) followed by a
 * sequence of chunks, each an ID, a size and data padded to an even length.
 */

import { dataView, readAscii, readBytes, writeAscii } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";

/** The location of a chunk within a RIFF file. */
export interface RiffChunk {
    /** The four-character chunk ID. */
    id: string;
    /** Offset of the chunk header. */
    offset: number;
    /** Offset of the chunk data. */
    dataOffset: number;
    /** Length of the chunk data, excluding the padding byte. */
    size: number;
    /** Offset just past the chunk, including its padding byte. */
    end: number;
}

/** The top-level structure of a RIFF file. */
export interface RiffFile {
    /** The form type, e.g. `WEBP` or `WAVE`. */
    form: string;
    chunks: RiffChunk[];
    /** Offset just past the RIFF data; anything after it is not part of the file. */
    end: number;
}

/**
 * Lists the top-level chunks of a RIFF file, reading only their headers.
 *
 * @param file - the whole file, either in memory or as a blob
 */
export async function readRiffChunks(file: Blob | Uint8Array): Promise<RiffFile> {
    const length = file instanceof Blob ? file.size : file.length;
    const read = (start: number, end: number): Promise<Uint8Array> | Uint8Array =>
        file instanceof Blob ? readBytes(file, start, end) : file.subarray(start, end);

    if (length < 12) throw new MetadataStripError("Not a RIFF file");
    const header = await read(0, 12);
    if (readAscii(header, 0, 4) !== "RIFF") throw new MetadataStripError("Not a RIFF file");
    const end = 8 + dataView(header).getUint32(4, true);
    if (end > length) throw new MetadataStripError("RIFF size is larger than the file");

    const chunks: RiffChunk[] = [];
    let offset = 12;
    while (offset + 8 <= end) {
        const chunkHeader = await read(offset, offset + 8);
        const id = readAscii(chunkHeader, 0, 4);
        const size = dataView(chunkHeader).getUint32(4, true);
        const dataOffset = offset + 8;
        if (dataOffset + size > end) throw new MetadataStripError(`Bad RIFF chunk size at ${offset}`);
        // Chunks are padded to an even length, but tolerate a missing pad byte on the last chunk.
        const chunkEnd = Math.min(dataOffset + size + (size & 1), end);
        chunks.push({ id, offset, dataOffset, size, end: chunkEnd });
        offset = chunkEnd;
    }

    return { form: readAscii(header, 8, 4), chunks, end };
}

/**
 * Builds a RIFF header for a file of the given form whose chunks total `bodyLength` bytes.
 */
export function buildRiffHeader(form: string, bodyLength: number): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(12);
    writeAscii(header, 0, "RIFF");
    dataView(header).setUint32(4, 4 + bodyLength, true);
    writeAscii(header, 8, form);
    return header;
}
