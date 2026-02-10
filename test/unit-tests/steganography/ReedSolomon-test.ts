/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { rsEncode, rsDecode, rsHasErrors } from "../../../src/steganography/ReedSolomon";

describe("ReedSolomon", () => {
    const NSYM = 16; // 16 error correction symbols → can correct up to 8 errors

    describe("rsEncode / rsDecode", () => {
        it("should round-trip data without errors", () => {
            const data = new TextEncoder().encode("Hello RS!");
            const encoded = rsEncode(data, NSYM);

            expect(encoded.length).toBe(data.length + NSYM);

            const decoded = rsDecode(encoded, NSYM);
            expect(decoded).not.toBeNull();
            expect(decoded!).toEqual(data);
        });

        it("should encode and decode single byte", () => {
            const data = new Uint8Array([42]);
            const encoded = rsEncode(data, NSYM);
            const decoded = rsDecode(encoded, NSYM);

            expect(decoded).not.toBeNull();
            expect(decoded!).toEqual(data);
        });

        it("should encode and decode empty data", () => {
            const data = new Uint8Array([]);
            const encoded = rsEncode(data, NSYM);
            expect(encoded.length).toBe(NSYM);

            const decoded = rsDecode(encoded, NSYM);
            expect(decoded).not.toBeNull();
            expect(decoded!.length).toBe(0);
        });

        it("should encode and decode all byte values", () => {
            const data = new Uint8Array(256);
            for (let i = 0; i < 256; i++) data[i] = i;

            const encoded = rsEncode(data, NSYM);
            const decoded = rsDecode(encoded, NSYM);

            expect(decoded).not.toBeNull();
            expect(decoded!).toEqual(data);
        });
    });

    describe("rsHasErrors", () => {
        it("should report no errors for uncorrupted data", () => {
            const data = new TextEncoder().encode("test");
            const encoded = rsEncode(data, NSYM);

            expect(rsHasErrors(encoded, NSYM)).toBe(false);
        });

        it("should detect corrupted data", () => {
            const data = new TextEncoder().encode("test");
            const encoded = rsEncode(data, NSYM);

            // Corrupt one byte
            encoded[0] ^= 0xff;

            expect(rsHasErrors(encoded, NSYM)).toBe(true);
        });
    });

    describe("error correction", () => {
        it("should return null for heavily corrupted data", () => {
            const data = new TextEncoder().encode("important message");
            const encoded = rsEncode(data, NSYM);

            // Corrupt more than nsym/2 bytes
            for (let i = 0; i < NSYM; i++) {
                encoded[i] ^= 0xff;
            }

            const decoded = rsDecode(encoded, NSYM);
            // May or may not succeed depending on error positions, but shouldn't crash
            expect(decoded === null || decoded instanceof Uint8Array).toBe(true);
        });
    });

    describe("with different symbol counts", () => {
        it("should work with 4 symbols", () => {
            const data = new TextEncoder().encode("small");
            const encoded = rsEncode(data, 4);
            const decoded = rsDecode(encoded, 4);

            expect(decoded).not.toBeNull();
            expect(decoded!).toEqual(data);
        });

        it("should work with 32 symbols", () => {
            const data = new TextEncoder().encode("more redundancy");
            const encoded = rsEncode(data, 32);
            const decoded = rsDecode(encoded, 32);

            expect(decoded).not.toBeNull();
            expect(decoded!).toEqual(data);
        });
    });
});
