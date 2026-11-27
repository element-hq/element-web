/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { assembleFile, bytesEqual, concatBytes, dataView, readAll, startsWith, writeAscii } from "./bytes";
import { buildExif, emptyExifFields, readExifDisplayFields } from "./exif";
import { MetadataStripError } from "./MetadataStripError";
import { buildRiffHeader, readRiffChunks } from "./riff";

/** Chunks needed to decode an image. `EXIF`, `XMP` and anything unrecognised are dropped. */
const KEPT_CHUNKS = new Set(["VP8X", "VP8 ", "VP8L", "ALPH", "ANIM", "ANMF", "ICCP"]);

const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

/** Builds an `EXIF` chunk holding the given TIFF structure. */
function buildExifChunk(tiff: Uint8Array): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(8);
    writeAscii(header, 0, "EXIF");
    dataView(header).setUint32(4, tiff.length, true);
    // The TIFF structures we build are always an even length, so no padding byte is needed.
    return concatBytes(header, tiff);
}

/**
 * Removes metadata from a WebP without re-encoding it.
 *
 * If there was an `EXIF` chunk then a new one holding only the fields which affect display (orientation and
 * colour space) is written in its place.
 *
 * @param file - the WebP
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripWebpMetadata(file: File): Promise<File> {
    const bytes = await readAll(file);
    const { form, chunks, end } = await readRiffChunks(bytes);
    if (form !== "WEBP") throw new MetadataStripError("Not a WebP");

    const parts: Uint8Array<ArrayBuffer>[] = [];
    let originalExif: Uint8Array | undefined;
    let exifFields = emptyExifFields();
    let vp8xIndex: number | undefined;
    let changed = end < bytes.length;

    for (const chunk of chunks) {
        if (KEPT_CHUNKS.has(chunk.id)) {
            if (chunk.id === "VP8X") vp8xIndex = parts.length;
            parts.push(bytes.subarray(chunk.offset, chunk.end));
        } else if (chunk.id === "EXIF" && originalExif === undefined) {
            originalExif = bytes.subarray(chunk.offset, chunk.end);
            let tiff = bytes.subarray(chunk.dataOffset, chunk.dataOffset + chunk.size);
            // Some writers wrongly include the JPEG-style prefix.
            if (startsWith(tiff, "Exif\0\0")) tiff = tiff.subarray(6);
            exifFields = readExifDisplayFields(tiff);
        } else {
            changed = true;
        }
    }

    let exif: Uint8Array<ArrayBuffer> | undefined;
    if (originalExif) {
        const tiff = buildExif(exifFields);
        // Only the extended format can carry Exif.
        if (tiff && vp8xIndex !== undefined) {
            exif = buildExifChunk(tiff);
            // Metadata chunks belong after the image data.
            parts.push(exif);
            if (!bytesEqual(exif, originalExif)) changed = true;
        } else {
            changed = true;
        }
    }

    if (!changed) return file;

    // The extended format's header flags which metadata chunks are present, so they must match what we kept.
    if (vp8xIndex !== undefined) {
        const vp8x = parts[vp8xIndex].slice();
        vp8x[8] = (vp8x[8] & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) | (exif ? VP8X_EXIF_FLAG : 0);
        parts[vp8xIndex] = vp8x;
    }

    const bodyLength = parts.reduce((total, part) => total + part.length, 0);
    return assembleFile(file, [buildRiffHeader("WEBP", bodyLength), ...parts]);
}
