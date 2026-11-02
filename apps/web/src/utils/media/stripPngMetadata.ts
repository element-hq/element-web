/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    assembleFile,
    bytesEqual,
    concatBytes,
    crc32,
    createBlobRangeReader,
    dataView,
    type FilePart,
    readAscii,
    startsWith,
    writeAscii,
} from "./bytes";
import { buildExif, emptyExifFields, readExifDisplayFields } from "./exif";
import { MetadataStripError } from "./MetadataStripError";

const SIGNATURE = "\x89PNG\r\n\x1a\n";

/**
 * Ancillary chunks which affect how the image is drawn. All other ancillary chunks are dropped: text
 * (`tEXt`, `zTXt`, `iTXt`, which is where XMP lives), timestamps (`tIME`), Exif (`eXIf`) and anything
 * unrecognised. Critical chunks are always kept as the image cannot be decoded without them.
 */
const KEPT_ANCILLARY_CHUNKS = new Set([
    "tRNS",
    "cHRM",
    "gAMA",
    "iCCP",
    "sBIT",
    "sRGB",
    "cICP",
    "mDCV",
    "mDCv",
    "cLLI",
    "cLLi",
    "bKGD",
    "hIST",
    "pHYs",
    "sPLT",
    // APNG animation
    "acTL",
    "fcTL",
    "fdAT",
]);

/** Builds an `eXIf` chunk holding the given TIFF structure. */
function buildExifChunk(tiff: Uint8Array): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(8);
    dataView(header).setUint32(0, tiff.length);
    writeAscii(header, 4, "eXIf");
    const crc = new Uint8Array(4);
    dataView(crc).setUint32(0, crc32(concatBytes(header.subarray(4), tiff)));
    return concatBytes(header, tiff, crc);
}

/**
 * Removes metadata from a PNG or APNG without re-encoding it.
 *
 * If there was an `eXIf` chunk then a new one holding only the fields which affect display (orientation and
 * colour space) is written in its place.
 *
 * @param file - the PNG
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripPngMetadata(file: File): Promise<File> {
    // Only the chunk headers and the Exif chunk are needed, so read those rather than the whole file.
    const read = createBlobRangeReader(file);
    if (!startsWith(await read(0, SIGNATURE.length), SIGNATURE)) throw new MetadataStripError("Not a PNG");

    const parts: FilePart[] = [file.slice(0, SIGNATURE.length)];
    let originalExif: Uint8Array | undefined;
    let exifFields = emptyExifFields();
    let changed = false;

    let offset = SIGNATURE.length;
    let ended = false;
    while (!ended) {
        const header = await read(offset, 8);
        if (header.length < 8) throw new MetadataStripError("Unexpected end of file");
        const length = dataView(header).getUint32(0);
        const type = readAscii(header, 4, 4);
        const end = offset + 12 + length;
        if (end > file.size) throw new MetadataStripError(`Bad chunk length at ${offset}`);

        // The case of the first letter says whether a decoder needs the chunk.
        const isCritical = type.charCodeAt(0) < 0x61;
        if (isCritical || KEPT_ANCILLARY_CHUNKS.has(type)) {
            parts.push(file.slice(offset, end));
        } else if (type === "eXIf" && originalExif === undefined) {
            originalExif = await read(offset, end - offset);
            exifFields = readExifDisplayFields(originalExif.subarray(8, originalExif.length - 4));
        } else {
            changed = true;
        }

        ended = type === "IEND";
        offset = end;
    }
    if (offset < file.size) changed = true;

    if (originalExif) {
        const tiff = buildExif(exifFields);
        if (tiff) {
            // Exif must come before the image data, so put it straight after the IHDR chunk.
            const exif = buildExifChunk(tiff);
            parts.splice(2, 0, exif);
            if (!bytesEqual(exif, originalExif)) changed = true;
        } else {
            changed = true;
        }
    }

    return changed ? assembleFile(file, parts) : file;
}
