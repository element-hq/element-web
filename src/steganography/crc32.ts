/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * CRC-32 checksum implementation for steganography payload integrity.
 * Uses the standard CRC-32/ISO-HDLC polynomial (0xEDB88320).
 */

let crcTable: Uint32Array | undefined;

/** Generate the CRC-32 lookup table (lazy, computed once). */
function ensureCrcTable(): Uint32Array {
    if (crcTable) return crcTable;

    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        crcTable[i] = c >>> 0;
    }
    return crcTable;
}

/** Compute CRC-32 checksum of the given byte array. */
export function crc32(data: Uint8Array): number {
    const table = ensureCrcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
