/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { deserializeEnvelopeV1, serializeEnvelopeV1, type EnvelopeV1 } from "../../../src/steganography/EnvelopeV1";
import { STEGO_MAGIC, StegoStrategy } from "../../../src/steganography/types";

describe("EnvelopeV1", () => {
    it("should serialize and deserialize a minimal envelope", () => {
        const envelope: EnvelopeV1 = {
            version: 1,
            strategy: StegoStrategy.Emoji,
            createdTs: 1700000000000,
            expiryTs: 1700000001000,
            ciphertext: new Uint8Array([1, 2, 3, 4]),
        };

        const encoded = serializeEnvelopeV1(envelope);
        const decoded = deserializeEnvelopeV1(encoded);

        expect(decoded).toEqual(envelope);
    });

    it("should round-trip optional fields", () => {
        const envelope: EnvelopeV1 = {
            version: 1,
            strategy: StegoStrategy.Image,
            createdTs: 1700000000000,
            expiryTs: 1700009999999,
            ciphertext: new Uint8Array([9, 8, 7]),
            nonce: new Uint8Array([1, 1, 2, 3]),
            authTag: new Uint8Array([4, 5, 6]),
            crc32: 0x12345678,
            rsParity: new Uint8Array([7, 8]),
        };

        const encoded = serializeEnvelopeV1(envelope);
        const decoded = deserializeEnvelopeV1(encoded);

        expect(decoded).toEqual(envelope);
    });

    it("should reject invalid magic", () => {
        const bytes = Uint8Array.from([0, 0, 1, 0, 0]);
        expect(() => deserializeEnvelopeV1(bytes)).toThrow("Invalid envelope magic");
    });

    it("should reject unsupported version", () => {
        const bytes = Uint8Array.from([
            STEGO_MAGIC[0],
            STEGO_MAGIC[1],
            99,
            0,
            0,
            ...new Array(16).fill(0),
            0,
        ]);

        expect(() => deserializeEnvelopeV1(bytes)).toThrow("Unsupported envelope version");
    });

    it("should reject expiryTs earlier than createdTs", () => {
        const envelope: EnvelopeV1 = {
            version: 1,
            strategy: StegoStrategy.EmojiString,
            createdTs: 1000,
            expiryTs: 999,
            ciphertext: new Uint8Array([1]),
        };

        expect(() => serializeEnvelopeV1(envelope)).toThrow("expiryTs must be greater than or equal to createdTs");
    });

    it("should reject non-canonical varint encodings", () => {
        // Build a valid envelope, then patch ciphertext length varint to non-canonical form.
        const envelope: EnvelopeV1 = {
            version: 1,
            strategy: StegoStrategy.Emoji,
            createdTs: 1700000000000,
            expiryTs: 1700000000100,
            ciphertext: new Uint8Array([42]),
        };

        const encoded = serializeEnvelopeV1(envelope);
        // Header prefix: magic(2)+version(1)+mode(1)+flags(1)+created(8)+expiry(8) = 21 bytes.
        // Canonical len(1) == 0x01 -> replace with non-canonical [0x81,0x00]
        const prefix = encoded.slice(0, 21);
        const payload = encoded.slice(22); // skip original single-byte varint
        const tampered = new Uint8Array(prefix.length + 2 + payload.length);
        tampered.set(prefix, 0);
        tampered.set([0x81, 0x00], prefix.length);
        tampered.set(payload, prefix.length + 2);

        expect(() => deserializeEnvelopeV1(tampered)).toThrow("Non-canonical varint encoding");
    });

    it("should reject trailing bytes", () => {
        const envelope: EnvelopeV1 = {
            version: 1,
            strategy: StegoStrategy.Emoji,
            createdTs: 1700000000000,
            expiryTs: 1700000000100,
            ciphertext: new Uint8Array([1, 2]),
        };

        const encoded = serializeEnvelopeV1(envelope);
        const tampered = new Uint8Array(encoded.length + 1);
        tampered.set(encoded);
        tampered[tampered.length - 1] = 0xaa;

        expect(() => deserializeEnvelopeV1(tampered)).toThrow("Envelope has trailing bytes");
    });
});
