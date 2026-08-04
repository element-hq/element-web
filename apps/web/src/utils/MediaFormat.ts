/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// Format labels for files staged in the composer. Image formats come from the mime type;
// nothing exposes a video's codec, so that is read out of the container headers.

import { logger as rootLogger } from "matrix-js-sdk/src/logger";

const logger = rootLogger.getChild("MediaFormat");

const SNIFF_CHUNK_SIZE = 512 * 1024;

const IMAGE_FORMAT_LABELS: Record<string, string> = {
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/apng": "APNG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/avif": "AVIF",
    "image/svg+xml": "SVG",
    "image/bmp": "BMP",
    "image/x-icon": "ICO",
    "image/tiff": "TIFF",
    "image/heic": "HEIC",
    "image/heif": "HEIF",
};

const VIDEO_CONTAINER_LABELS: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
    "video/mpeg": "mpeg",
    "video/ogg": "ogv",
    "video/3gpp": "3gp",
    "video/x-flv": "flv",
};

// Sample entry formats found in the stsd box.
const MP4_CODEC_LABELS: Record<string, string> = {
    avc1: "h264",
    avc3: "h264",
    hev1: "h265",
    hvc1: "h265",
    av01: "av1",
    vp09: "vp9",
    vp08: "vp8",
    mp4v: "mpeg4",
    s263: "h263",
};

const MATROSKA_CODEC_LABELS: Record<string, string> = {
    "V_VP8": "vp8",
    "V_VP9": "vp9",
    "V_AV1": "av1",
    "V_MPEG4/ISO/AVC": "h264",
    "V_MPEGH/ISO/HEVC": "h265",
    "V_MPEG4/ISO/ASP": "mpeg4",
    "V_MPEG2": "mpeg2",
    "V_THEORA": "theora",
};

export function imageFormatLabel(mimeType: string): string {
    const known = IMAGE_FORMAT_LABELS[mimeType.toLowerCase()];
    if (known) return known;
    return subtypeFallback(mimeType);
}

export function videoContainerLabel(mimeType: string, fileName: string): string {
    const known = VIDEO_CONTAINER_LABELS[mimeType.toLowerCase()];
    if (known) return known;

    const extension = fileName.split(".").pop();
    if (extension && extension !== fileName && extension.length <= 5) {
        return extension.toLowerCase();
    }
    return subtypeFallback(mimeType);
}

function subtypeFallback(mimeType: string): string {
    const subtype = mimeType.split("/")[1];
    if (!subtype) return "";
    return subtype.replace(/^x-/, "").toUpperCase();
}

/**
 * Read the container headers to work out which video codec a file holds, e.g. "h264".
 * Resolves undefined if the container is unsupported or the codec cannot be found.
 */
export async function sniffVideoCodec(file: File): Promise<string | undefined> {
    try {
        const head = new Uint8Array(await file.slice(0, SNIFF_CHUNK_SIZE).arrayBuffer());

        if (isMatroska(head)) {
            return findMatroskaCodec(head);
        }

        if (isIsoBaseMedia(head)) {
            const fromHead = findMp4Codec(head);
            if (fromHead) return fromHead;
            // Files not written for streaming keep moov at the end.
            if (file.size > SNIFF_CHUNK_SIZE) {
                const tail = new Uint8Array(await file.slice(Math.max(0, file.size - SNIFF_CHUNK_SIZE)).arrayBuffer());
                return findMp4CodecUnaligned(tail);
            }
        }
    } catch (e) {
        logger.warn("Failed to sniff video codec", e);
    }
    return undefined;
}

function readFourCc(bytes: Uint8Array, offset: number): string {
    return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function isIsoBaseMedia(bytes: Uint8Array): boolean {
    return bytes.length > 12 && readFourCc(bytes, 4) === "ftyp";
}

function isMatroska(bytes: Uint8Array): boolean {
    // EBML magic, shared by Matroska and WebM.
    return bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

const MP4_CONTAINER_BOXES = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

function findMp4Codec(bytes: Uint8Array, start = 0, end = bytes.length): string | undefined {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = start;

    while (offset + 8 <= end) {
        let size = view.getUint32(offset);
        const type = readFourCc(bytes, offset + 4);
        let headerSize = 8;

        if (size === 1) {
            // 64-bit size follows the type.
            if (offset + 16 > end) break;
            size = Number(view.getBigUint64(offset + 8));
            headerSize = 16;
        } else if (size === 0) {
            size = end - offset;
        }

        if (size < headerSize) break;

        if (type === "stsd") {
            // Skip version+flags, entry count and the sample entry size to reach the format.
            const formatOffset = offset + headerSize + 8 + 4;
            if (formatOffset + 4 > end) return undefined;
            // Muxers often put the audio track first, so skip anything that is not a known
            // video codec rather than reporting it as one.
            const known = MP4_CODEC_LABELS[readFourCc(bytes, formatOffset)];
            if (known) return known;
        }

        if (MP4_CONTAINER_BOXES.has(type)) {
            const found = findMp4Codec(bytes, offset + headerSize, Math.min(offset + size, end));
            if (found) return found;
        }

        offset += size;
    }

    return undefined;
}

/**
 * Parse a buffer that does not start on a box boundary, as happens when slicing the tail of
 * a file, by scanning for the moov type and stepping back over its size field.
 */
function findMp4CodecUnaligned(bytes: Uint8Array): string | undefined {
    for (let i = 4; i + 8 <= bytes.length; i++) {
        // "moov"
        if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x6f || bytes[i + 2] !== 0x6f || bytes[i + 3] !== 0x76) continue;
        const found = findMp4Codec(bytes, i - 4, bytes.length);
        if (found) return found;
    }
    return undefined;
}

// Scans for the CodecID element rather than doing a full EBML parse.
function findMatroskaCodec(bytes: Uint8Array): string | undefined {
    for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] !== 0x86) continue;

        // Only the single-byte length form is plausible for a codec string.
        const length = bytes[i + 1] & 0x7f;
        if (!(bytes[i + 1] & 0x80) || length < 2 || length > 30 || i + 2 + length > bytes.length) continue;

        let value = "";
        for (let j = 0; j < length; j++) {
            value += String.fromCharCode(bytes[i + 2 + j]);
        }

        if (!value.startsWith("V_")) continue;
        return MATROSKA_CODEC_LABELS[value] ?? value.slice(2).toLowerCase();
    }
    return undefined;
}
