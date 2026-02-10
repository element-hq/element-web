/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Core types for the Matrix steganography messaging system.
 *
 * This module provides steganographic encoding of encrypted Matrix messages
 * into innocuous-looking emoji sequences or images, with ephemeral 72-hour
 * message lifetimes.
 */

/** Strategy used for steganographic encoding. */
export enum StegoStrategy {
    /** Short messages encoded as emoji sequences (< 64 bytes). */
    Emoji = "emoji",
    /** Medium/long messages encoded as emoji strings (64-1024 bytes). */
    EmojiString = "emoji_string",
    /** Large payloads embedded in PNG images via LSB (> 1024 bytes). */
    Image = "image",
}

/** Metadata prepended to every steganographic payload. */
export interface StegoHeader {
    /** Protocol version for forward compatibility. */
    version: number;
    /** Which encoding strategy was used. */
    strategy: StegoStrategy;
    /** Length of the encrypted payload in bytes. */
    payloadLength: number;
    /** CRC-32 checksum of the encrypted payload. */
    checksum: number;
    /** Unix timestamp (ms) when the message expires. */
    expiresAt: number;
    /** Matrix event ID for correlation, if sent via Matrix. */
    eventId?: string;
}

/** A fully encoded steganographic message ready for transport. */
export interface StegoMessage {
    /** The header describing this message. */
    header: StegoHeader;
    /** The encrypted payload bytes. */
    encryptedPayload: Uint8Array;
    /** The steganographic carrier — emoji string or image data URL. */
    carrier: string;
    /** The strategy used. */
    strategy: StegoStrategy;
}

/** Result of decoding a steganographic carrier. */
export interface StegoDecodeResult {
    /** The decrypted plaintext message. */
    plaintext: string;
    /** The header that was embedded. */
    header: StegoHeader;
    /** Whether the checksum matched. */
    checksumValid: boolean;
    /** Whether the message has expired. */
    expired: boolean;
}

/** Detailed error codes for decode failures. */
export enum StegoDecodeErrorCode {
    /** The carrier is not a recognized stego format. */
    NotStegoContent = "not_stego_content",
    /** The carrier has a valid stego marker but the header is malformed. */
    MalformedHeader = "malformed_header",
    /** The payload data is truncated or shorter than the header declares. */
    TruncatedPayload = "truncated_payload",
    /** CRC-32 checksum mismatch and Reed-Solomon could not recover the data. */
    ChecksumMismatch = "checksum_mismatch",
    /** Reed-Solomon detected uncorrectable corruption. */
    UncorrectableCorruption = "uncorrectable_corruption",
    /** The message has expired past its expiry timestamp. */
    Expired = "expired",
    /** The carrier looked like an image but could not be decoded. */
    ImageDecodeFailed = "image_decode_failed",
    /** An unknown emoji was encountered during decoding. */
    UnknownEmoji = "unknown_emoji",
    /** The protocol version is unsupported. */
    UnsupportedVersion = "unsupported_version",
}

/** Structured decode error with diagnostic information. */
export interface StegoDecodeError {
    /** Machine-readable error code. */
    code: StegoDecodeErrorCode;
    /** Human-readable error message. */
    message: string;
    /** Whether Reed-Solomon recovery was attempted. */
    rsAttempted: boolean;
    /** Whether Reed-Solomon corrected some errors (partial recovery). */
    rsCorrected: boolean;
    /** The partially decoded header, if available. */
    partialHeader?: StegoHeader;
}

/** User-facing error descriptions for each error code. */
export const DECODE_ERROR_MESSAGES: Record<StegoDecodeErrorCode, string> = {
    [StegoDecodeErrorCode.NotStegoContent]: "This message does not contain hidden content",
    [StegoDecodeErrorCode.MalformedHeader]: "The hidden message header is damaged",
    [StegoDecodeErrorCode.TruncatedPayload]: "The hidden message is incomplete — part of the data is missing",
    [StegoDecodeErrorCode.ChecksumMismatch]: "The hidden message was corrupted during transport",
    [StegoDecodeErrorCode.UncorrectableCorruption]: "The hidden message is too damaged to recover",
    [StegoDecodeErrorCode.Expired]: "This hidden message has expired",
    [StegoDecodeErrorCode.ImageDecodeFailed]: "Could not extract hidden data from the image",
    [StegoDecodeErrorCode.UnknownEmoji]: "The message contains unrecognized characters — it may have been modified",
    [StegoDecodeErrorCode.UnsupportedVersion]: "This message uses a newer protocol version — update your app",
};

/** Options for encoding a message. */
export interface StegoEncodeOptions {
    /** Force a specific strategy instead of auto-selecting. */
    strategy?: StegoStrategy;
    /** Custom expiry duration in milliseconds. Defaults to 72 hours. */
    expiryMs?: number;
    /** Matrix event ID to embed in the header. */
    eventId?: string;
    /** Cover image for image steganography (PNG data URL or ImageData). */
    coverImage?: string | ImageData;
    /** Whether to apply Reed-Solomon error correction. Defaults to true. */
    errorCorrection?: boolean;
}

/** Configuration for the steganography system. */
export interface StegoConfig {
    /** Default message lifetime in milliseconds. */
    defaultExpiryMs: number;
    /** Maximum payload size in bytes before falling back to image stego. */
    maxEmojiPayloadBytes: number;
    /** Threshold between single emoji and emoji string strategies. */
    emojiStringThreshold: number;
    /** Number of Reed-Solomon error correction symbols. */
    reedSolomonSymbols: number;
}

/** Default configuration values. */
export const DEFAULT_STEGO_CONFIG: StegoConfig = {
    defaultExpiryMs: 72 * 60 * 60 * 1000, // 72 hours
    maxEmojiPayloadBytes: 1024,
    emojiStringThreshold: 64,
    reedSolomonSymbols: 16,
};

/** Protocol version. */
export const STEGO_PROTOCOL_VERSION = 1;

/**
 * Pool of 256 visually distinct emojis for byte-to-emoji mapping.
 * Selected for cross-platform rendering consistency and visual distinctness.
 */
export const EMOJI_POOL: readonly string[] = [
    // Animals (0x00-0x1F)
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
    "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
    "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺",
    "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞",
    // Nature (0x20-0x3F)
    "🌸", "🌺", "🌻", "🌹", "🌷", "🌱", "🌲", "🌳",
    "🌴", "🌵", "🍀", "🍁", "🍂", "🍃", "🌿", "🌾",
    "🍄", "🌰", "🌊", "🌋", "🌍", "🌙", "⭐", "🌈",
    "☀️", "🌤", "⛅", "🌧", "⛈", "🌩", "🌨", "❄️",
    // Food (0x40-0x5F)
    "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
    "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅",
    "🥑", "🍆", "🥦", "🥬", "🌶", "🌽", "🥕", "🧄",
    "🧅", "🥔", "🍠", "🥐", "🍞", "🥖", "🧀", "🥚",
    // Activities (0x60-0x7F)
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉",
    "🥏", "🎱", "🏓", "🏸", "🏒", "🥅", "⛳", "🏹",
    "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛷", "⛸",
    "🥌", "🎿", "⛷", "🏂", "🪂", "🏋", "🤸", "🤺",
    // Objects (0x80-0x9F)
    "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁",
    "🎷", "🎺", "🎸", "🪕", "🎻", "🎲", "🎯", "🎳",
    "🎮", "🎰", "🧩", "🎪", "🎠", "🎡", "🎢", "🚂",
    "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊",
    // Transport (0xA0-0xBF)
    "🚗", "🚕", "🚙", "🚌", "🚎", "🏎", "🚓", "🚑",
    "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍", "🛵",
    "🚲", "🛴", "🚏", "🛣", "🛤", "⛽", "🚨", "🚥",
    "🚦", "🛑", "🚧", "⚓", "⛵", "🚤", "🛳", "⛴",
    // Symbols (0xC0-0xDF)
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
    "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉", "☸️",
    "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈",
    // Misc (0xE0-0xFF)
    "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫",
    "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫",
    "⬛", "⬜", "◻️", "◼️", "🔶", "🔷", "🔸", "🔹",
    "🔺", "🔻", "💠", "🔘", "🔳", "🔲", "🏁", "🚩",
] as const;

/** Reverse lookup: emoji → byte value. Built lazily. */
let emojiToByteMap: Map<string, number> | undefined;

/** Get the reverse emoji→byte lookup map. */
export function getEmojiToByteMap(): Map<string, number> {
    if (!emojiToByteMap) {
        emojiToByteMap = new Map();
        for (let i = 0; i < EMOJI_POOL.length; i++) {
            emojiToByteMap.set(EMOJI_POOL[i], i);
        }
    }
    return emojiToByteMap;
}

/** Magic bytes that identify a stego header in an emoji sequence. */
export const STEGO_MAGIC = [0xde, 0xad] as const;

/** Zero-width joiner character for stealth markers. */
export const ZWJ = "\u200D";
/** Zero-width non-joiner character. */
export const ZWNJ = "\u200C";
/** Zero-width space character. */
export const ZWS = "\u200B";

/** Stego marker prefix: ZWJ + ZWNJ + ZWS — invisible to humans. */
export const STEGO_MARKER = `${ZWJ}${ZWNJ}${ZWS}`;
