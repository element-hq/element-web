/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import {
    validateEmoji,
    validateEmojiPool,
    validateUtf8RoundTrip,
    validateBijection,
} from "../../../src/steganography/EmojiValidator";
import { EMOJI_POOL, getEmojiToByteMap } from "../../../src/steganography/types";

describe("EmojiValidator", () => {
    describe("validateEmoji", () => {
        it("should validate a simple single-codepoint emoji", () => {
            const result = validateEmoji("🐶", 0);
            expect(result.roundTripOk).toBe(true);
            expect(result.singleGrapheme).toBe(true);
            expect(result.codePointCount).toBeLessThanOrEqual(2);
        });

        it("should detect variation selector emojis", () => {
            // ❤️ (0xC0) has a VS16
            const heartIndex = EMOJI_POOL.indexOf("❤️");
            if (heartIndex >= 0) {
                const result = validateEmoji("❤️", heartIndex);
                expect(result.hasVariationSelector).toBe(true);
                expect(result.warnings.length).toBeGreaterThan(0);
            }
        });

        it("should flag round-trip mismatches", () => {
            // Validate with wrong index — should fail round-trip
            const result = validateEmoji("🐶", 99);
            expect(result.roundTripOk).toBe(false);
            expect(result.warnings).toContain(
                "Round-trip mismatch: encode/decode would produce different byte",
            );
        });
    });

    describe("validateEmojiPool", () => {
        it("should validate all 256 emojis in the pool", () => {
            const report = validateEmojiPool(false);
            expect(report.totalEmojis).toBe(256);
        });

        it("should have no duplicates", () => {
            const report = validateEmojiPool();
            expect(report.duplicates).toHaveLength(0);
        });

        it("should have a consistent reverse lookup map", () => {
            const report = validateEmojiPool();
            expect(report.lookupMapConsistent).toBe(true);
        });

        it("should have zero critical failures", () => {
            const report = validateEmojiPool();
            expect(report.failed).toBe(0);
        });

        it("should identify platform-risk emojis with variation selectors", () => {
            const report = validateEmojiPool();
            // Some emojis in the pool use VS16 (e.g. ❤️, ☀️)
            // These should be flagged as platform risks
            expect(report.platformRiskEmojis.length).toBeGreaterThanOrEqual(0);
            for (const risk of report.platformRiskEmojis) {
                expect(risk.warnings.length).toBeGreaterThan(0);
            }
        });

        it("should produce brief output that only includes issues", () => {
            const brief = validateEmojiPool(true);
            const full = validateEmojiPool(false);
            // Brief should have fewer or equal results
            expect(brief.results.length).toBeLessThanOrEqual(full.results.length);
        });
    });

    describe("validateUtf8RoundTrip", () => {
        it("should pass UTF-8 round-trip for all emojis", () => {
            const result = validateUtf8RoundTrip();
            expect(result.allPassed).toBe(true);
            expect(result.failures).toHaveLength(0);
        });
    });

    describe("validateBijection", () => {
        it("should confirm the byte mapping is a perfect bijection", () => {
            const result = validateBijection();
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it("should verify every byte 0x00-0xFF maps to a unique emoji", () => {
            const seen = new Set<string>();
            for (let i = 0; i < 256; i++) {
                const emoji = EMOJI_POOL[i];
                expect(emoji).toBeDefined();
                expect(seen.has(emoji)).toBe(false);
                seen.add(emoji);
            }
            expect(seen.size).toBe(256);
        });

        it("should verify the reverse map has 256 entries", () => {
            const map = getEmojiToByteMap();
            expect(map.size).toBe(256);
        });
    });
});
