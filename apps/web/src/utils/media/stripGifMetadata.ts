/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile, type FilePart, readAll, readAscii, startsWith } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";

const EXTENSION_INTRODUCER = 0x21;
const IMAGE_SEPARATOR = 0x2c;
const TRAILER = 0x3b;

const GRAPHIC_CONTROL_LABEL = 0xf9;
const PLAIN_TEXT_LABEL = 0x01;
const APPLICATION_LABEL = 0xff;

/** Application extensions which affect playback or colour. Others, such as XMP, are dropped. */
const KEPT_APPLICATIONS = new Set(["NETSCAPE2.0", "ANIMEXTS1.0", "ICCRGBG1012"]);

/** Size in bytes of a colour table described by a packed field, or 0 if the table is absent. */
function colourTableSize(packed: number): number {
    return packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
}

/**
 * Returns the offset just past a run of data sub-blocks, which ends with an empty block.
 */
function skipSubBlocks(bytes: Uint8Array, offset: number): number {
    for (;;) {
        if (offset >= bytes.length) throw new MetadataStripError("Unexpected end of file");
        const size = bytes[offset];
        offset += 1 + size;
        if (size === 0) return offset;
    }
}

/**
 * Removes comments and metadata application extensions (such as XMP) from a GIF without re-encoding it.
 * Animation and colour profile extensions are kept.
 *
 * @param file - the GIF
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripGifMetadata(file: File): Promise<File> {
    const bytes = await readAll(file);
    if (!startsWith(bytes, "GIF87a") && !startsWith(bytes, "GIF89a")) throw new MetadataStripError("Not a GIF");
    if (bytes.length < 13) throw new MetadataStripError("Unexpected end of file");

    // Header, logical screen descriptor and global colour table.
    let offset = 13 + colourTableSize(bytes[10]);
    const parts: FilePart[] = [file.slice(0, offset)];
    let changed = false;

    for (;;) {
        if (offset >= bytes.length) throw new MetadataStripError("Unexpected end of file");
        const introducer = bytes[offset];

        if (introducer === TRAILER) {
            parts.push(file.slice(offset, offset + 1));
            if (offset + 1 < bytes.length) changed = true;
            break;
        }

        if (introducer === IMAGE_SEPARATOR) {
            if (offset + 10 > bytes.length) throw new MetadataStripError("Unexpected end of file");
            // Image descriptor, local colour table, then the LZW minimum code size and image data.
            const dataStart = offset + 10 + colourTableSize(bytes[offset + 9]) + 1;
            const end = skipSubBlocks(bytes, dataStart);
            parts.push(file.slice(offset, end));
            offset = end;
            continue;
        }

        if (introducer !== EXTENSION_INTRODUCER) throw new MetadataStripError(`Unknown GIF block at ${offset}`);
        if (offset + 2 > bytes.length) throw new MetadataStripError("Unexpected end of file");
        const label = bytes[offset + 1];
        const end = skipSubBlocks(bytes, offset + 2);

        let keep = label === GRAPHIC_CONTROL_LABEL || label === PLAIN_TEXT_LABEL;
        if (label === APPLICATION_LABEL && bytes[offset + 2] === 11) {
            keep = KEPT_APPLICATIONS.has(readAscii(bytes, offset + 3, 11));
        }

        if (keep) {
            parts.push(file.slice(offset, end));
        } else {
            changed = true;
        }
        offset = end;
    }

    return changed ? assembleFile(file, parts) : file;
}
