/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Emoji-based steganography encoder/decoder.
 *
 * Encodes arbitrary byte payloads into sequences of emojis from a fixed
 * 256-emoji pool, with an invisible zero-width marker prefix for detection.
 *
 * Header layout (encoded as emojis):
 *   [MAGIC_0] [MAGIC_1] [VERSION] [STRATEGY] [LEN_HI] [LEN_LO] [CRC_0..CRC_3] [EXPIRY_0..EXPIRY_5]
 *
 * Total header: 16 emojis, followed by payload emojis.
 */

import { crc32 } from "./crc32";
import {
    EMOJI_POOL,
    STEGO_MAGIC,
    STEGO_MARKER,
    STEGO_PROTOCOL_VERSION,
    StegoStrategy,
    getEmojiToByteMap,
    type StegoHeader,
} from "./types";

/** Header size in bytes (and therefore emojis). */
const HEADER_SIZE = 16;

/** Encode a single byte as an emoji. */
function byteToEmoji(byte: number): string {
    return EMOJI_POOL[byte & 0xff];
}

/** Decode a single emoji back to a byte. Returns -1 if not found. */
function emojiToByte(emoji: string): number {
    const map = getEmojiToByteMap();
    return map.get(emoji) ?? -1;
}

/** Encode a number into big-endian bytes of specified width. */
function numberToBytes(value: number, width: number): number[] {
    const bytes: number[] = [];
    for (let i = width - 1; i >= 0; i--) {
        bytes.push((value >>> (i * 8)) & 0xff);
    }
    return bytes;
}

/** Decode big-endian bytes back to a number. */
function bytesToNumber(bytes: number[]): number {
    let value = 0;
    for (const b of bytes) {
        value = (value << 8) | (b & 0xff);
    }
    return value >>> 0;
}

/**
 * Encode a 48-bit timestamp into 6 bytes.
 * JavaScript timestamps fit in 48 bits until year 10889.
 */
function timestampToBytes(ts: number): number[] {
    const hi = Math.floor(ts / 0x100000000) & 0xffff;
    const lo = ts >>> 0;
    return [...numberToBytes(hi, 2), ...numberToBytes(lo, 4)];
}

/** Decode 6 bytes back to a 48-bit timestamp. */
function bytesToTimestamp(bytes: number[]): number {
    const hi = bytesToNumber(bytes.slice(0, 2));
    const lo = bytesToNumber(bytes.slice(2, 6));
    return hi * 0x100000000 + lo;
}

/** Build the binary header from a StegoHeader. */
function buildHeaderBytes(header: StegoHeader): Uint8Array {
    const bytes = new Uint8Array(HEADER_SIZE);
    let offset = 0;

    // Magic (2 bytes)
    bytes[offset++] = STEGO_MAGIC[0];
    bytes[offset++] = STEGO_MAGIC[1];

    // Version (1 byte)
    bytes[offset++] = header.version & 0xff;

    // Strategy (1 byte)
    const strategyMap: Record<StegoStrategy, number> = {
        [StegoStrategy.Emoji]: 0,
        [StegoStrategy.EmojiString]: 1,
        [StegoStrategy.Image]: 2,
    };
    bytes[offset++] = strategyMap[header.strategy];

    // Payload length (2 bytes, big-endian, max 65535)
    const lenBytes = numberToBytes(header.payloadLength, 2);
    bytes[offset++] = lenBytes[0];
    bytes[offset++] = lenBytes[1];

    // CRC-32 (4 bytes, big-endian)
    const crcBytes = numberToBytes(header.checksum, 4);
    for (const b of crcBytes) bytes[offset++] = b;

    // Expiry timestamp (6 bytes)
    const tsBytes = timestampToBytes(header.expiresAt);
    for (const b of tsBytes) bytes[offset++] = b;

    return bytes;
}

/** Parse binary header bytes back into a StegoHeader. */
function parseHeaderBytes(bytes: Uint8Array): StegoHeader | null {
    if (bytes.length < HEADER_SIZE) return null;

    // Verify magic
    if (bytes[0] !== STEGO_MAGIC[0] || bytes[1] !== STEGO_MAGIC[1]) {
        return null;
    }

    const version = bytes[2];
    const strategyByte = bytes[3];
    const strategies: StegoStrategy[] = [StegoStrategy.Emoji, StegoStrategy.EmojiString, StegoStrategy.Image];
    const strategy = strategies[strategyByte];
    if (!strategy) return null;

    const payloadLength = bytesToNumber([bytes[4], bytes[5]]);
    const checksum = bytesToNumber([bytes[6], bytes[7], bytes[8], bytes[9]]);
    const expiresAt = bytesToTimestamp([bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]);

    return {
        version,
        strategy,
        payloadLength,
        checksum,
        expiresAt,
    };
}

/**
 * Encode encrypted payload bytes into an emoji string.
 *
 * @param payload - The encrypted message bytes.
 * @param expiresAt - Unix timestamp (ms) when the message expires.
 * @param strategy - The stego strategy (Emoji or EmojiString).
 * @returns The emoji carrier string with invisible marker prefix.
 */
export function encodeEmoji(payload: Uint8Array, expiresAt: number, strategy: StegoStrategy): string {
    const checksum = crc32(payload);

    const header: StegoHeader = {
        version: STEGO_PROTOCOL_VERSION,
        strategy,
        payloadLength: payload.length,
        checksum,
        expiresAt,
    };

    const headerBytes = buildHeaderBytes(header);

    // Convert header + payload bytes to emoji sequence
    const emojis: string[] = [];
    for (let i = 0; i < headerBytes.length; i++) {
        emojis.push(byteToEmoji(headerBytes[i]));
    }
    for (let i = 0; i < payload.length; i++) {
        emojis.push(byteToEmoji(payload[i]));
    }

    // Prefix with invisible stego marker for detection
    return STEGO_MARKER + emojis.join("");
}

/**
 * Segment an emoji carrier string into individual emoji characters.
 * Handles multi-codepoint emojis (ZWJ sequences, variation selectors).
 */
export function segmentEmojis(text: string): string[] {
    // Use Intl.Segmenter if available (modern browsers)
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        const segments = [...segmenter.segment(text)];
        return segments.map((s) => s.segment).filter((s) => getEmojiToByteMap().has(s));
    }

    // Fallback: match emojis using the known pool
    const map = getEmojiToByteMap();
    const result: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        let matched = false;
        // Try longest match first (some emojis are multi-char)
        for (let len = Math.min(remaining.length, 8); len >= 1; len--) {
            const candidate = remaining.substring(0, len);
            if (map.has(candidate)) {
                result.push(candidate);
                remaining = remaining.substring(len);
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Skip this character
            remaining = remaining.substring(1);
        }
    }
    return result;
}

/**
 * Decode an emoji carrier string back into header + payload bytes.
 *
 * @param carrier - The emoji string (with or without stego marker).
 * @returns Object with header and payload, or null if invalid.
 */
export function decodeEmoji(carrier: string): { header: StegoHeader; payload: Uint8Array } | null {
    // Strip stego marker if present
    let text = carrier;
    if (text.startsWith(STEGO_MARKER)) {
        text = text.substring(STEGO_MARKER.length);
    }

    // Segment into individual emojis
    const emojis = segmentEmojis(text);

    if (emojis.length < HEADER_SIZE) {
        return null;
    }

    // Decode all emojis to bytes
    const allBytes = new Uint8Array(emojis.length);
    for (let i = 0; i < emojis.length; i++) {
        const byte = emojiToByte(emojis[i]);
        if (byte < 0) return null;
        allBytes[i] = byte;
    }

    // Parse header
    const header = parseHeaderBytes(allBytes);
    if (!header) return null;

    // Extract payload
    const expectedEnd = HEADER_SIZE + header.payloadLength;
    if (allBytes.length < expectedEnd) return null;

    const payload = allBytes.slice(HEADER_SIZE, expectedEnd);

    // Verify checksum
    const actualChecksum = crc32(payload);
    if (actualChecksum !== header.checksum) {
        // Return with mismatched checksum — caller can decide what to do
        return { header: { ...header, checksum: actualChecksum }, payload };
    }

    return { header, payload };
}

/**
 * Check if a string contains a stego marker (fast scan).
 */
export function hasStegoMarker(text: string): boolean {
    return text.includes(STEGO_MARKER);
}

/**
 * Check if a string looks like it could be a stego emoji sequence.
 * Performs a lightweight heuristic check without full decode.
 */
export function looksLikeStegoEmoji(text: string): boolean {
    if (hasStegoMarker(text)) return true;

    // Check if it starts with the magic emoji pair
    const stripped = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
    const emojis = segmentEmojis(stripped);
    if (emojis.length < HEADER_SIZE) return false;

    const map = getEmojiToByteMap();
    const firstByte = map.get(emojis[0]);
    const secondByte = map.get(emojis[1]);
    return firstByte === STEGO_MAGIC[0] && secondByte === STEGO_MAGIC[1];
}
