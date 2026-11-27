/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile, type FilePart, readBytes, startsWith } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";
import { skipId3v2 } from "./mp3";

const STREAMINFO = 0;
const PADDING = 1;
const SEEKTABLE = 3;
const CUESHEET = 5;

/**
 * Metadata blocks needed to play the stream. Vorbis comments, pictures, application data and anything
 * unrecognised are dropped.
 */
const KEPT_BLOCKS = new Set([STREAMINFO, PADDING, SEEKTABLE, CUESHEET]);

const LAST_BLOCK_FLAG = 0x80;

/**
 * Removes Vorbis comments, pictures and application blocks from a FLAC file, along with any ID3 tag in
 * front of it. Seek points are relative to the first audio frame, so they stay valid.
 *
 * @param file - the FLAC file
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripFlacMetadata(file: File): Promise<File> {
    const start = await skipId3v2(file);
    if (!startsWith(await readBytes(file, start, start + 4), "fLaC")) throw new MetadataStripError("Not a FLAC file");

    const blocks: Uint8Array<ArrayBuffer>[] = [];
    let changed = start > 0;
    let offset = start + 4;
    let last = false;
    while (!last) {
        const header = await readBytes(file, offset, offset + 4);
        last = (header[0] & LAST_BLOCK_FLAG) !== 0;
        const type = header[0] & ~LAST_BLOCK_FLAG;
        const end = offset + 4 + ((header[1] << 16) | (header[2] << 8) | header[3]);
        if (end > file.size) throw new MetadataStripError(`Bad FLAC block length at ${offset}`);

        if (KEPT_BLOCKS.has(type)) {
            blocks.push(await readBytes(file, offset, end));
        } else {
            changed = true;
        }
        offset = end;
    }
    if (!changed) return file;
    if (blocks.length === 0) throw new MetadataStripError("FLAC file without STREAMINFO");

    // Only the final kept block may carry the last-block flag.
    blocks.forEach((block, i) => {
        block[0] = (block[0] & ~LAST_BLOCK_FLAG) | (i === blocks.length - 1 ? LAST_BLOCK_FLAG : 0);
    });

    const parts: FilePart[] = [file.slice(start, start + 4), ...blocks, file.slice(offset)];
    return assembleFile(file, parts);
}
