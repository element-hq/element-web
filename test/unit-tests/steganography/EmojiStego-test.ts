/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import {
    encodeEmoji,
    decodeEmoji,
    hasStegoMarker,
    looksLikeStegoEmoji,
    segmentEmojis,
} from "../../../src/steganography/EmojiStego";
import { EMOJI_POOL, STEGO_MARKER, StegoStrategy, getEmojiToByteMap } from "../../../src/steganography/types";

describe("EmojiStego", () => {
    describe("encodeEmoji / decodeEmoji", () => {
        it("should round-trip a short payload", () => {
            const payload = new TextEncoder().encode("Hi");
            const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

            const carrier = encodeEmoji(payload, expiresAt, StegoStrategy.Emoji);
            expect(typeof carrier).toBe("string");
            expect(carrier.length).toBeGreaterThan(0);

            const result = decodeEmoji(carrier);
            expect(result).not.toBeNull();
            expect(result!.payload).toEqual(payload);
            expect(result!.header.strategy).toBe(StegoStrategy.Emoji);
            expect(result!.header.payloadLength).toBe(payload.length);
        });

        it("should round-trip a medium payload as emoji string", () => {
            const message = "This is a longer message that tests emoji string encoding.";
            const payload = new TextEncoder().encode(message);
            const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

            const carrier = encodeEmoji(payload, expiresAt, StegoStrategy.EmojiString);
            const result = decodeEmoji(carrier);

            expect(result).not.toBeNull();
            expect(new TextDecoder().decode(result!.payload)).toBe(message);
            expect(result!.header.strategy).toBe(StegoStrategy.EmojiString);
        });

        it("should preserve the expiry timestamp", () => {
            const payload = new Uint8Array([1, 2, 3]);
            const expiresAt = 1800000000000; // Far future

            const carrier = encodeEmoji(payload, expiresAt, StegoStrategy.Emoji);
            const result = decodeEmoji(carrier);

            expect(result).not.toBeNull();
            expect(result!.header.expiresAt).toBe(expiresAt);
        });

        it("should include the stego marker prefix", () => {
            const payload = new Uint8Array([42]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);

            expect(carrier.startsWith(STEGO_MARKER)).toBe(true);
        });

        it("should decode without the stego marker", () => {
            const payload = new Uint8Array([10, 20, 30]);
            const expiresAt = Date.now() + 1000;
            const carrier = encodeEmoji(payload, expiresAt, StegoStrategy.Emoji);

            // Strip marker
            const stripped = carrier.substring(STEGO_MARKER.length);
            const result = decodeEmoji(stripped);

            expect(result).not.toBeNull();
            expect(result!.payload).toEqual(payload);
        });

        it("should return null for invalid input", () => {
            expect(decodeEmoji("just some text")).toBeNull();
            expect(decodeEmoji("")).toBeNull();
            expect(decodeEmoji("🐶")).toBeNull(); // Too short
        });

        it("should handle empty payload", () => {
            const payload = new Uint8Array([]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);
            const result = decodeEmoji(carrier);

            expect(result).not.toBeNull();
            expect(result!.payload.length).toBe(0);
        });

        it("should handle payload with all byte values", () => {
            const payload = new Uint8Array(256);
            for (let i = 0; i < 256; i++) payload[i] = i;

            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.EmojiString);
            const result = decodeEmoji(carrier);

            expect(result).not.toBeNull();
            expect(result!.payload).toEqual(payload);
        });
    });

    describe("hasStegoMarker", () => {
        it("should detect the stego marker", () => {
            expect(hasStegoMarker(STEGO_MARKER + "🐶🎩")).toBe(true);
        });

        it("should return false for normal text", () => {
            expect(hasStegoMarker("Hello world")).toBe(false);
            expect(hasStegoMarker("🐶🎩")).toBe(false);
        });
    });

    describe("looksLikeStegoEmoji", () => {
        it("should detect encoded emoji sequences", () => {
            const payload = new Uint8Array([1, 2, 3]);
            const carrier = encodeEmoji(payload, Date.now() + 1000, StegoStrategy.Emoji);
            expect(looksLikeStegoEmoji(carrier)).toBe(true);
        });

        it("should return false for random emojis", () => {
            expect(looksLikeStegoEmoji("🎉🎊🎈")).toBe(false);
        });
    });

    describe("segmentEmojis", () => {
        it("should segment a string of emojis", () => {
            const emojis = "🐶🐱🐭";
            const segments = segmentEmojis(emojis);
            expect(segments.length).toBe(3);
            expect(segments).toEqual(["🐶", "🐱", "🐭"]);
        });

        it("should skip non-emoji characters", () => {
            const mixed = "🐶hello🐱";
            const segments = segmentEmojis(mixed);
            expect(segments).toEqual(["🐶", "🐱"]);
        });
    });

    describe("EMOJI_POOL", () => {
        it("should contain exactly 256 unique emojis", () => {
            expect(EMOJI_POOL.length).toBe(256);
            const unique = new Set(EMOJI_POOL);
            expect(unique.size).toBe(256);
        });

        it("should have a working reverse lookup map", () => {
            const map = getEmojiToByteMap();
            expect(map.size).toBe(256);

            for (let i = 0; i < 256; i++) {
                expect(map.get(EMOJI_POOL[i])).toBe(i);
            }
        });
    });
});
