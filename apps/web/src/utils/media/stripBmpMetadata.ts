/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile, bytesEqual, dataView, readAll, startsWith } from "./bytes";
import { MetadataStripError } from "./MetadataStripError";

const FILE_HEADER_LENGTH = 14;
const V5_HEADER_LENGTH = 124;

/** Offsets within a BITMAPV5HEADER. */
const CS_TYPE = 56;
const PROFILE_DATA = 112;
const PROFILE_SIZE = 116;

/** A colour space which is a path to a profile on the sender's disk. */
const PROFILE_LINKED = 0x4c494e4b; // "LINK"
const LCS_SRGB = 0x73524742; // "sRGB"

/**
 * Removes the little metadata a BMP can hold: the path to a linked colour profile, which names a file on the
 * sender's computer (and so often their user name), and the reserved header fields some tools use to stash
 * data. A linked profile can't be used by anyone else, so the image is marked as sRGB instead. Embedded
 * profiles are kept.
 *
 * @param file - the BMP image
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripBmpMetadata(file: File): Promise<File> {
    const original = await readAll(file);
    if (!startsWith(original, "BM") || original.length < FILE_HEADER_LENGTH + 4) {
        throw new MetadataStripError("Not a BMP");
    }

    const bytes = original.slice();
    const view = dataView(bytes);
    // bfReserved1 and bfReserved2
    bytes.fill(0, 6, 10);

    const infoHeaderLength = view.getUint32(FILE_HEADER_LENGTH, true);
    if (infoHeaderLength >= V5_HEADER_LENGTH) {
        if (FILE_HEADER_LENGTH + V5_HEADER_LENGTH > bytes.length) throw new MetadataStripError("Truncated BMP");
        const header = FILE_HEADER_LENGTH;
        if (view.getUint32(header + CS_TYPE, true) === PROFILE_LINKED) {
            // The profile offset is relative to the start of the info header.
            const start = header + view.getUint32(header + PROFILE_DATA, true);
            const end = start + view.getUint32(header + PROFILE_SIZE, true);
            if (end > bytes.length) throw new MetadataStripError("BMP profile outside the file");
            bytes.fill(0, start, end);
            view.setUint32(header + CS_TYPE, LCS_SRGB, true);
            view.setUint32(header + PROFILE_DATA, 0, true);
            view.setUint32(header + PROFILE_SIZE, 0, true);
        }
    }

    return bytesEqual(bytes, original) ? file : assembleFile(file, [bytes]);
}
