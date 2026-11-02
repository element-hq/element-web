/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MetadataStripError } from "./MetadataStripError";

/** A piece of an output file: either a slice of the original file or newly written bytes. */
export type FilePart = Blob | Uint8Array<ArrayBuffer>;

/**
 * Reads a whole blob into memory.
 */
export async function readAll(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await blob.arrayBuffer());
}

/** Reads `length` bytes of a blob at `offset`. The result is cut short if it runs past the end of the blob. */
export type BlobRangeReader = (offset: number, length: number) => Promise<Uint8Array<ArrayBuffer>>;

/**
 * Creates a reader for byte ranges of a blob which reads at least `windowSize` bytes at a time. Walking many
 * small structures then needs neither a read for each nor the whole blob in memory.
 */
export function createBlobRangeReader(blob: Blob, windowSize = 64 * 1024): BlobRangeReader {
    let windowStart = 0;
    let window = new Uint8Array(0);
    return async (offset, length) => {
        if (offset < windowStart || offset + length > windowStart + window.length) {
            windowStart = offset;
            window = new Uint8Array(await blob.slice(offset, offset + Math.max(length, windowSize)).arrayBuffer());
        }
        const start = offset - windowStart;
        return window.subarray(start, start + length);
    };
}

/**
 * Returns a view over `bytes` for reading multibyte integers.
 */
export function dataView(bytes: Uint8Array): DataView {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Reads `length` bytes at `offset` as a latin1 string, e.g. a four-character code.
 */
export function readAscii(bytes: Uint8Array, offset: number, length: number): string {
    if (offset + length > bytes.length) {
        throw new MetadataStripError(`Unexpected end of data reading string at ${offset}`);
    }
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/**
 * Writes a latin1 string into `bytes` at `offset`.
 */
export function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
    for (let i = 0; i < value.length; i++) {
        bytes[offset + i] = value.charCodeAt(i);
    }
}

/**
 * Whether `bytes` contains `prefix` at `offset`.
 */
export function startsWith(bytes: Uint8Array, prefix: string, offset = 0): boolean {
    if (offset + prefix.length > bytes.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        if (bytes[offset + i] !== prefix.charCodeAt(i)) return false;
    }
    return true;
}

/**
 * Whether two byte arrays hold the same bytes.
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Joins byte arrays into one.
 */
export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

/**
 * Builds a new file from `parts` which keeps the name, type and modification time of `original`, so that
 * the upload is labelled exactly as the original would have been.
 */
export function assembleFile(original: File, parts: FilePart[]): File {
    return new File(parts, original.name, { type: original.type, lastModified: original.lastModified });
}

let crcTable: Uint32Array | undefined;

/**
 * Computes the CRC-32 used by PNG chunks.
 */
export function crc32(bytes: Uint8Array): number {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            crcTable[n] = c >>> 0;
        }
    }

    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
