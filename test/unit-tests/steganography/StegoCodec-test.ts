/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { StegoCodec, getDefaultCodec } from "../../../src/steganography/StegoCodec";
import { StegoStrategy } from "../../../src/steganography/types";

describe("StegoCodec", () => {
    let codec: StegoCodec;

    beforeEach(() => {
        codec = new StegoCodec();
    });

    describe("selectStrategy", () => {
        it("should select Emoji for small payloads", () => {
            expect(codec.selectStrategy(10)).toBe(StegoStrategy.Emoji);
            expect(codec.selectStrategy(64)).toBe(StegoStrategy.Emoji);
        });

        it("should select EmojiString for medium payloads", () => {
            expect(codec.selectStrategy(65)).toBe(StegoStrategy.EmojiString);
            expect(codec.selectStrategy(500)).toBe(StegoStrategy.EmojiString);
            expect(codec.selectStrategy(1024)).toBe(StegoStrategy.EmojiString);
        });

        it("should select Image for large payloads", () => {
            expect(codec.selectStrategy(1025)).toBe(StegoStrategy.Image);
            expect(codec.selectStrategy(10000)).toBe(StegoStrategy.Image);
        });
    });

    describe("encode / decode emoji", () => {
        it("should encode and decode a short message", async () => {
            const payload = new TextEncoder().encode("Hi");

            const message = await codec.encode(payload, {
                strategy: StegoStrategy.Emoji,
            });

            expect(message.strategy).toBe(StegoStrategy.Emoji);
            expect(message.carrier).toBeTruthy();
            expect(message.header.payloadLength).toBe(payload.length);

            const decoded = await codec.decode(message.carrier);
            expect(decoded).not.toBeNull();
            // After RS decode, we should get the original payload
            expect(decoded!.payload.length).toBeGreaterThanOrEqual(payload.length);
        });

        it("should encode and decode a medium message", async () => {
            const text = "The quick brown fox jumps over the lazy dog. ".repeat(2);
            const payload = new TextEncoder().encode(text);

            const message = await codec.encode(payload, {
                strategy: StegoStrategy.EmojiString,
            });

            expect(message.strategy).toBe(StegoStrategy.EmojiString);
            const decoded = await codec.decode(message.carrier);
            expect(decoded).not.toBeNull();
        });

        it("should auto-select strategy based on payload size", async () => {
            const short = new Uint8Array(10);
            const medium = new Uint8Array(100);

            const shortMsg = await codec.encode(short);
            expect(shortMsg.strategy).toBe(StegoStrategy.Emoji);

            const medMsg = await codec.encode(medium);
            expect(medMsg.strategy).toBe(StegoStrategy.EmojiString);
        });

        it("should encode without error correction when disabled", async () => {
            const payload = new TextEncoder().encode("test");

            const withEC = await codec.encode(payload, {
                strategy: StegoStrategy.Emoji,
                errorCorrection: true,
            });

            const withoutEC = await codec.encode(payload, {
                strategy: StegoStrategy.Emoji,
                errorCorrection: false,
            });

            // Without EC should produce a shorter carrier
            expect(withoutEC.carrier.length).toBeLessThan(withEC.carrier.length);
        });
    });

    describe("encode with custom expiry", () => {
        it("should use custom expiry time", async () => {
            const payload = new Uint8Array([1, 2, 3]);
            const oneHourMs = 60 * 60 * 1000;

            const before = Date.now();
            const message = await codec.encode(payload, {
                strategy: StegoStrategy.Emoji,
                expiryMs: oneHourMs,
            });
            const after = Date.now();

            expect(message.header.expiresAt).toBeGreaterThanOrEqual(before + oneHourMs);
            expect(message.header.expiresAt).toBeLessThanOrEqual(after + oneHourMs);
        });
    });

    describe("looksLikeStego", () => {
        it("should detect encoded emoji carriers", async () => {
            const payload = new TextEncoder().encode("test");
            const message = await codec.encode(payload, { strategy: StegoStrategy.Emoji });

            expect(codec.looksLikeStego(message.carrier)).toBe(true);
        });

        it("should not detect normal text", () => {
            expect(codec.looksLikeStego("Hello world")).toBe(false);
            expect(codec.looksLikeStego("Just some emojis 🎉🎊")).toBe(false);
        });

        it("should detect PNG data URLs as potential image stego", () => {
            expect(codec.looksLikeStego("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
        });
    });

    describe("decode invalid input", () => {
        it("should return null for plain text", async () => {
            const result = await codec.decode("Hello world");
            expect(result).toBeNull();
        });

        it("should return null for empty string", async () => {
            const result = await codec.decode("");
            expect(result).toBeNull();
        });

        it("should return null for random emojis", async () => {
            const result = await codec.decode("🎉🎊🎈🎁");
            expect(result).toBeNull();
        });
    });

    describe("getDefaultCodec", () => {
        it("should return a singleton instance", () => {
            const a = getDefaultCodec();
            const b = getDefaultCodec();
            expect(a).toBe(b);
        });

        it("should be a StegoCodec instance", () => {
            expect(getDefaultCodec()).toBeInstanceOf(StegoCodec);
        });
    });

    describe("encode with Image strategy", () => {
        it("should throw without a cover image", async () => {
            const payload = new Uint8Array(2000);

            await expect(
                codec.encode(payload, { strategy: StegoStrategy.Image }),
            ).rejects.toThrow("cover image");
        });
    });

    describe("custom configuration", () => {
        it("should respect custom thresholds", () => {
            const custom = new StegoCodec({
                emojiStringThreshold: 10,
                maxEmojiPayloadBytes: 50,
            });

            expect(custom.selectStrategy(11)).toBe(StegoStrategy.EmojiString);
            expect(custom.selectStrategy(51)).toBe(StegoStrategy.Image);
        });
    });
});
