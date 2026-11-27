/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile, dataView, readBytes, startsWith } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";
import { skipId3v2 } from "./mp3";

const ID3V1_LENGTH = 128;
const ID3V1_ENHANCED_LENGTH = 227;
const APE_FOOTER_LENGTH = 32;

/**
 * Returns the offset of the start of any ID3v1 and APEv2 tags at the end of a file.
 */
async function findTrailingTags(file: Blob, start: number): Promise<number> {
    let end = file.size;
    if (end - start >= ID3V1_LENGTH && startsWith(await readBytes(file, end - ID3V1_LENGTH, end), "TAG")) {
        end -= ID3V1_LENGTH;
        const enhancedStart = end - ID3V1_ENHANCED_LENGTH;
        if (enhancedStart >= start && startsWith(await readBytes(file, enhancedStart, enhancedStart + 4), "TAG+")) {
            end = enhancedStart;
        }
    }

    if (end - start >= APE_FOOTER_LENGTH) {
        const footer = await readBytes(file, end - APE_FOOTER_LENGTH, end);
        if (startsWith(footer, "APETAGEX")) {
            const view = dataView(footer);
            // The size covers the items and footer; a header of the same length may precede them.
            const hasHeader = (view.getUint32(20, true) & 0x80000000) !== 0;
            end -= view.getUint32(12, true) + (hasHeader ? APE_FOOTER_LENGTH : 0);
            if (end < start) throw new MetadataStripError("APE tag is larger than the file");
        }
    }
    return end;
}

/**
 * Removes ID3v2 tags from the start of an MP3, and ID3v1 and APEv2 tags from its end. These hold the title,
 * artist and cover art, and can hold arbitrary comments.
 *
 * @param file - the MP3
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripMp3Metadata(file: File): Promise<File> {
    const start = await skipId3v2(file);
    const end = await findTrailingTags(file, start);
    if (start === 0 && end === file.size) return file;
    return assembleFile(file, [file.slice(start, end)]);
}
