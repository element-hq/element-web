/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { readBytes, startsWith } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";

const ID3V2_HEADER_LENGTH = 10;

/** Reads a 28-bit "syncsafe" integer, where the top bit of each byte is unused. */
function readSyncsafe(bytes: Uint8Array, offset: number): number {
    return (bytes[offset] << 21) | (bytes[offset + 1] << 14) | (bytes[offset + 2] << 7) | bytes[offset + 3];
}

/**
 * Returns the offset just past any ID3v2 tags at the start of a file.
 */
export async function skipId3v2(file: Blob, offset = 0): Promise<number> {
    while (offset + ID3V2_HEADER_LENGTH <= file.size) {
        const header = await readBytes(file, offset, offset + ID3V2_HEADER_LENGTH);
        if (!startsWith(header, "ID3")) break;
        const hasFooter = (header[5] & 0x10) !== 0;
        offset += ID3V2_HEADER_LENGTH + readSyncsafe(header, 6) + (hasFooter ? ID3V2_HEADER_LENGTH : 0);
    }
    if (offset > file.size) throw new MetadataStripError("ID3 tag is larger than the file");
    return offset;
}
