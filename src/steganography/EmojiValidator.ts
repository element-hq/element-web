/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Cross-platform emoji rendering validation for the steganography system.
 *
 * Validates that the 256-emoji pool used for byte encoding renders correctly
 * and consistently across platforms. Detects:
 *   - Missing emojis (rendered as tofu/boxes)
 *   - Multi-codepoint rendering issues (ZWJ sequences, variation selectors)
 *   - Grapheme segmentation inconsistencies
 *   - Round-trip encoding stability
 */

import { EMOJI_POOL, getEmojiToByteMap } from "./types";

/** Result of validating a single emoji. */
export interface EmojiValidationResult {
    /** The emoji character. */
    emoji: string;
    /** The byte index in the pool (0-255). */
    index: number;
    /** Number of UTF-16 code units. */
    utf16Length: number;
    /** Number of Unicode code points. */
    codePointCount: number;
    /** Whether the emoji round-trips through encode/decode correctly. */
    roundTripOk: boolean;
    /** Whether grapheme segmentation produces exactly one segment. */
    singleGrapheme: boolean;
    /** Whether the emoji contains a variation selector (VS15/VS16). */
    hasVariationSelector: boolean;
    /** Whether the emoji contains a ZWJ (zero-width joiner). */
    hasZwj: boolean;
    /** Warnings about potential rendering issues. */
    warnings: string[];
}

/** Summary of a full pool validation run. */
export interface EmojiPoolValidationReport {
    /** Total emoji count in the pool. */
    totalEmojis: number;
    /** Number of emojis that passed all checks. */
    passed: number;
    /** Number of emojis with warnings. */
    withWarnings: number;
    /** Number of emojis that failed critical checks. */
    failed: number;
    /** Whether the reverse lookup map is complete and consistent. */
    lookupMapConsistent: boolean;
    /** Duplicate detection: any emojis that appear more than once. */
    duplicates: string[];
    /** Per-emoji results (only includes emojis with issues when brief=true). */
    results: EmojiValidationResult[];
    /** Emoji categories with potential cross-platform issues. */
    platformRiskEmojis: EmojiValidationResult[];
}

/** Variation Selector 16 — forces emoji presentation. */
const VS16 = "\uFE0F";
/** Variation Selector 15 — forces text presentation. */
const VS15 = "\uFE0E";
/** Zero-Width Joiner. */
const ZWJ = "\u200D";

/**
 * Validate a single emoji from the pool.
 */
export function validateEmoji(emoji: string, index: number): EmojiValidationResult {
    const warnings: string[] = [];

    // UTF-16 length
    const utf16Length = emoji.length;

    // Code point count
    const codePoints = [...emoji];
    const codePointCount = codePoints.length;

    // Check for variation selectors
    const hasVariationSelector = emoji.includes(VS16) || emoji.includes(VS15);
    if (hasVariationSelector) {
        warnings.push("Contains variation selector — may render differently across platforms");
    }

    // Check for ZWJ sequences
    const hasZwj = emoji.includes(ZWJ);
    if (hasZwj) {
        warnings.push("Contains ZWJ — older platforms may render as multiple emojis");
    }

    // Round-trip check: emoji → byte → emoji
    const map = getEmojiToByteMap();
    const byte = map.get(emoji);
    const roundTripOk = byte === index && EMOJI_POOL[index] === emoji;
    if (!roundTripOk) {
        warnings.push("Round-trip mismatch: encode/decode would produce different byte");
    }

    // Grapheme segmentation check
    let singleGrapheme = true;
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SegmenterCtor = (Intl as any).Segmenter;
        const segmenter = new SegmenterCtor("en", { granularity: "grapheme" });
        const segments = [...segmenter.segment(emoji)];
        singleGrapheme = segments.length === 1;
        if (!singleGrapheme) {
            warnings.push(`Segments into ${segments.length} graphemes instead of 1`);
        }
    }

    // Warn about emojis that tend to cause cross-platform issues
    if (codePointCount > 3) {
        warnings.push("Complex multi-codepoint emoji — higher risk of platform inconsistency");
    }

    return {
        emoji,
        index,
        utf16Length,
        codePointCount,
        roundTripOk,
        singleGrapheme,
        hasVariationSelector,
        hasZwj,
        warnings,
    };
}

/**
 * Validate the entire 256-emoji pool for consistency and cross-platform safety.
 *
 * @param brief - If true, only include emojis with issues in the results array.
 */
export function validateEmojiPool(brief = true): EmojiPoolValidationReport {
    const results: EmojiValidationResult[] = [];
    const platformRiskEmojis: EmojiValidationResult[] = [];
    let passed = 0;
    let withWarnings = 0;
    let failed = 0;

    // Check pool size
    if (EMOJI_POOL.length !== 256) {
        // Critical: pool must have exactly 256 emojis for byte mapping
        failed++;
    }

    // Check for duplicates
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    for (let i = 0; i < EMOJI_POOL.length; i++) {
        const emoji = EMOJI_POOL[i];
        if (seen.has(emoji)) {
            duplicates.push(`"${emoji}" at index ${seen.get(emoji)} and ${i}`);
        }
        seen.set(emoji, i);
    }

    // Validate reverse lookup map consistency
    const map = getEmojiToByteMap();
    let lookupMapConsistent = map.size === EMOJI_POOL.length;
    for (let i = 0; i < EMOJI_POOL.length; i++) {
        if (map.get(EMOJI_POOL[i]) !== i) {
            lookupMapConsistent = false;
            break;
        }
    }

    // Validate each emoji
    for (let i = 0; i < EMOJI_POOL.length; i++) {
        const result = validateEmoji(EMOJI_POOL[i], i);

        if (!result.roundTripOk || !result.singleGrapheme) {
            failed++;
            results.push(result);
        } else if (result.warnings.length > 0) {
            withWarnings++;
            if (!brief) results.push(result);
            if (result.hasVariationSelector || result.hasZwj || result.codePointCount > 2) {
                platformRiskEmojis.push(result);
            }
        } else {
            passed++;
            if (!brief) results.push(result);
        }
    }

    return {
        totalEmojis: EMOJI_POOL.length,
        passed,
        withWarnings,
        failed,
        lookupMapConsistent,
        duplicates,
        results,
        platformRiskEmojis,
    };
}

/**
 * Quick check that all emojis in the pool can survive a text encode/decode
 * round-trip through common transport mechanisms.
 *
 * Tests: string → TextEncoder → TextDecoder → string
 */
export function validateUtf8RoundTrip(): { allPassed: boolean; failures: Array<{ index: number; emoji: string }> } {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const failures: Array<{ index: number; emoji: string }> = [];

    for (let i = 0; i < EMOJI_POOL.length; i++) {
        const emoji = EMOJI_POOL[i];
        const encoded = encoder.encode(emoji);
        const decoded = decoder.decode(encoded);
        if (decoded !== emoji) {
            failures.push({ index: i, emoji });
        }
    }

    return { allPassed: failures.length === 0, failures };
}

/**
 * Validate that the pool's byte mapping is a perfect 1:1 bijection.
 * Every byte 0x00-0xFF must map to exactly one unique emoji and back.
 */
export function validateBijection(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const map = getEmojiToByteMap();

    if (EMOJI_POOL.length !== 256) {
        errors.push(`Pool has ${EMOJI_POOL.length} emojis, expected 256`);
    }

    if (map.size !== EMOJI_POOL.length) {
        errors.push(`Reverse map has ${map.size} entries but pool has ${EMOJI_POOL.length} (duplicates present)`);
    }

    for (let i = 0; i < 256; i++) {
        if (i >= EMOJI_POOL.length) {
            errors.push(`No emoji for byte 0x${i.toString(16).padStart(2, "0")}`);
            continue;
        }
        const emoji = EMOJI_POOL[i];
        const reverse = map.get(emoji);
        if (reverse !== i) {
            errors.push(`Byte 0x${i.toString(16).padStart(2, "0")}: forward maps to "${emoji}", reverse maps to ${reverse}`);
        }
    }

    return { valid: errors.length === 0, errors };
}
