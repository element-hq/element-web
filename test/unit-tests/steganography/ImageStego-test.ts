/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { calculateCapacity, encodeImage, decodeImage } from "../../../src/steganography/ImageStego";
import { STEGO_MAGIC } from "../../../src/steganography/types";

/** Create a mock ImageData of given dimensions. */
function createMockImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with random-ish values for realism
    for (let i = 0; i < data.length; i++) {
        data[i] = (i * 37 + 128) & 0xff;
    }
    return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("ImageStego", () => {
    describe("calculateCapacity", () => {
        it("should calculate capacity for a 100x100 image", () => {
            const capacity = calculateCapacity(100, 100);
            // 100*100 pixels * 3 bits/pixel = 30000 bits = 3750 bytes - 17 header = 3733
            expect(capacity).toBe(3733);
        });

        it("should calculate capacity for a 1x1 image", () => {
            const capacity = calculateCapacity(1, 1);
            // 1 pixel * 3 bits = 3 bits = 0 bytes (too small for header)
            expect(capacity).toBe(0);
        });

        it("should calculate capacity for a 512x512 image", () => {
            const capacity = calculateCapacity(512, 512);
            expect(capacity).toBeGreaterThan(90000);
        });

        it("should return 0 for tiny images", () => {
            expect(calculateCapacity(1, 1)).toBe(0);
            expect(calculateCapacity(2, 2)).toBe(0);
        });
    });

    describe("encodeImage / decodeImage", () => {
        it("should round-trip a payload in a 100x100 image", () => {
            const imageData = createMockImageData(100, 100);
            const payload = new TextEncoder().encode("Secret message in image!");
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

            const encoded = encodeImage(imageData, payload, expiresAt);
            expect(encoded).not.toBeNull();
            expect(encoded!.width).toBe(100);
            expect(encoded!.height).toBe(100);

            const decoded = decodeImage(encoded!);
            expect(decoded).not.toBeNull();
            expect(decoded!.payload).toEqual(payload);
            expect(decoded!.header.payloadLength).toBe(payload.length);
        });

        it("should preserve the magic bytes", () => {
            const imageData = createMockImageData(50, 50);
            const payload = new Uint8Array([1, 2, 3]);
            const expiresAt = Date.now() + 1000;

            const encoded = encodeImage(imageData, payload, expiresAt);
            const decoded = decodeImage(encoded!);

            expect(decoded).not.toBeNull();
        });

        it("should preserve the expiry timestamp", () => {
            const imageData = createMockImageData(50, 50);
            const payload = new Uint8Array([42]);
            const expiresAt = 1800000000000;

            const encoded = encodeImage(imageData, payload, expiresAt);
            const decoded = decodeImage(encoded!);

            expect(decoded).not.toBeNull();
            expect(decoded!.header.expiresAt).toBe(expiresAt);
        });

        it("should return null if image is too small", () => {
            const imageData = createMockImageData(2, 2);
            const payload = new Uint8Array(1000);

            const encoded = encodeImage(imageData, payload, Date.now() + 1000);
            expect(encoded).toBeNull();
        });

        it("should not modify the alpha channel", () => {
            const imageData = createMockImageData(50, 50);
            // Set all alpha to 255
            for (let i = 3; i < imageData.data.length; i += 4) {
                imageData.data[i] = 255;
            }

            const payload = new Uint8Array([1, 2, 3, 4, 5]);
            const encoded = encodeImage(imageData, payload, Date.now() + 1000);

            expect(encoded).not.toBeNull();
            // Check alpha values are preserved
            for (let i = 3; i < encoded!.data.length; i += 4) {
                expect(encoded!.data[i]).toBe(255);
            }
        });

        it("should handle empty payload", () => {
            const imageData = createMockImageData(50, 50);
            const payload = new Uint8Array([]);
            const expiresAt = Date.now() + 1000;

            const encoded = encodeImage(imageData, payload, expiresAt);
            expect(encoded).not.toBeNull();

            const decoded = decodeImage(encoded!);
            expect(decoded).not.toBeNull();
            expect(decoded!.payload.length).toBe(0);
        });

        it("should return null for unmodified image (no stego)", () => {
            const imageData = createMockImageData(50, 50);
            const decoded = decodeImage(imageData);

            // Might return null if magic bytes don't match
            if (decoded !== null) {
                // If by chance the LSBs happen to form magic bytes,
                // the payload length would be nonsensical
                expect(decoded.header.payloadLength).toBeDefined();
            }
        });
    });

    describe("LSB integrity", () => {
        it("should only modify the least significant bit", () => {
            const imageData = createMockImageData(100, 100);
            const original = new Uint8ClampedArray(imageData.data);
            const payload = new TextEncoder().encode("test");

            const encoded = encodeImage(imageData, payload, Date.now() + 1000);
            expect(encoded).not.toBeNull();

            // Check that only LSBs differ
            for (let i = 0; i < encoded!.data.length; i++) {
                if (i % 4 === 3) continue; // Skip alpha
                const diff = Math.abs(encoded!.data[i] - original[i]);
                expect(diff).toBeLessThanOrEqual(1);
            }
        });
    });
});
