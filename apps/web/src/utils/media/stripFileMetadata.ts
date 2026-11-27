/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { stripBmpMetadata } from "./stripBmpMetadata";
import { stripFlacMetadata } from "./stripFlacMetadata";
import { stripGifMetadata } from "./stripGifMetadata";
import { stripJpegMetadata } from "./stripJpegMetadata";
import { MetadataStripError } from "./MetadataStripError";
import { stripMp3Metadata } from "./stripMp3Metadata";
import { stripPngMetadata } from "./stripPngMetadata";
import { stripWavMetadata } from "./stripWavMetadata";
import { stripWebpMetadata } from "./stripWebpMetadata";

type StripImplementation = (file: File) => Promise<File>;

/**
 * The stripper for each supported MIME type. Only image and audio types are listed: other files are sent
 * exactly as they are.
 * Known omissions:
 * + JPEG XL
 * + HEIC
 * + HEIF
 * + AVIF
 * + SVG
 * + Audio files other than MP3, FLAC and WAV
 * + Video files
 */
const STRIP_IMPLEMENTATIONS = new Map<string, StripImplementation>([
    ["image/jpeg", stripJpegMetadata],
    ["image/png", stripPngMetadata],
    ["image/apng", stripPngMetadata],
    ["image/webp", stripWebpMetadata],
    ["image/gif", stripGifMetadata],
    ["image/bmp", stripBmpMetadata],
    ["image/x-bmp", stripBmpMetadata],
    ["image/x-ms-bmp", stripBmpMetadata],
    ["audio/mpeg", stripMp3Metadata],
    ["audio/mp3", stripMp3Metadata],
    ["audio/flac", stripFlacMetadata],
    ["audio/x-flac", stripFlacMetadata],
    ["audio/wav", stripWavMetadata],
    ["audio/wave", stripWavMetadata],
    ["audio/x-wav", stripWavMetadata],
    ["audio/vnd.wave", stripWavMetadata],
]);

/**
 * Whether {@link stripFileMetadata} knows how to remove metadata from a file of this type.
 *
 * @param mimeType - the file's MIME type, as given by `File.type`
 */
export function canStripFileMetadata(mimeType: string): boolean {
    return STRIP_IMPLEMENTATIONS.has(mimeType.toLowerCase());
}

/**
 * Removes metadata which could identify the sender, such as location, device, timestamps and authorship,
 * from an image or audio file. The media itself is never re-encoded, and the orientation, colour and HDR
 * information needed to display an image correctly are kept.
 *
 * The format is chosen from `file.type`; files of other types are returned unchanged.
 *
 * @param file - the file to strip
 * @returns a new file with the same name and type, or `file` itself if there was no metadata to remove or
 *     its type is not supported
 * @throws {MetadataStripError} if the file could not be parsed, in which case it may still hold metadata
 */
export async function stripFileMetadata(file: File): Promise<File> {
    const strip = STRIP_IMPLEMENTATIONS.get(file.type.toLowerCase());
    if (!strip) return file;

    try {
        return await strip(file);
    } catch (e) {
        if (e instanceof MetadataStripError) throw e;
        // Reads past the end of a truncated or malformed file surface as RangeErrors from DataView.
        throw new MetadataStripError(`Failed to strip metadata from ${file.type} file`, { cause: e });
    }
}
