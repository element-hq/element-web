/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { crc32 } from "../../../src/steganography/crc32";

describe("crc32", () => {
    it("should return 0 for empty input", () => {
        expect(crc32(new Uint8Array([]))).toBe(0);
    });

    it("should compute correct CRC-32 for known values", () => {
        // "Hello" → CRC-32 = 0xF7D18982
        const data = new TextEncoder().encode("Hello");
        const result = crc32(data);
        expect(result).toBe(0xf7d18982);
    });

    it("should produce different checksums for different inputs", () => {
        const a = crc32(new TextEncoder().encode("foo"));
        const b = crc32(new TextEncoder().encode("bar"));
        expect(a).not.toBe(b);
    });

    it("should produce consistent results for same input", () => {
        const data = new TextEncoder().encode("test data");
        expect(crc32(data)).toBe(crc32(data));
    });

    it("should handle single byte", () => {
        const result = crc32(new Uint8Array([0x00]));
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should handle large inputs", () => {
        const data = new Uint8Array(10000).fill(0xab);
        const result = crc32(data);
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThanOrEqual(0);
    });
});
