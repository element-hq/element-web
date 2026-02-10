/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Matrix Steganography Messaging System
 *
 * Provides steganographic encoding of encrypted Matrix messages into
 * innocuous-looking emoji sequences or images, with ephemeral 72-hour
 * message lifetimes.
 *
 * Architecture:
 *   - EmojiStego: Encode/decode bytes ↔ emoji sequences
 *   - ImageStego: Encode/decode bytes ↔ PNG LSB
 *   - ReedSolomon: Error correction for emoji payloads
 *   - StegoCodec: Unified codec with auto-strategy selection
 *   - StegoDetector: Scan incoming messages for stego content
 *   - EphemeralManager: 72-hour message lifecycle management
 *
 * Workflow:
 *   1. User types message → encrypted via Matrix E2EE
 *   2. Encrypted payload → StegoCodec → emoji string or stego image
 *   3. Carrier sent via Matrix or copy/pasted to any external platform
 *   4. Receiver's app detects stego → StegoCodec → decrypt → display
 *   5. Message auto-deletes after 72 hours
 */

export { StegoCodec, getDefaultCodec, type DecodeOutcome } from "./StegoCodec";
export { encodeEmoji, decodeEmoji, hasStegoMarker, looksLikeStegoEmoji, segmentEmojis } from "./EmojiStego";
export {
    encodeImage,
    decodeImage,
    calculateCapacity,
    dataUrlToImageData,
    imageDataToDataUrl,
} from "./ImageStego";
export { rsEncode, rsDecode, rsHasErrors } from "./ReedSolomon";
export { crc32 } from "./crc32";
export {
    validateEmoji,
    validateEmojiPool,
    validateUtf8RoundTrip,
    validateBijection,
    type EmojiValidationResult,
    type EmojiPoolValidationReport,
} from "./EmojiValidator";
export { serializeEnvelopeV1, deserializeEnvelopeV1, type EnvelopeV1 } from "./EnvelopeV1";
export { StegoDetector, getStegoDetector, type StegoDetection, type StegoDetectionCallback } from "./StegoDetector";
export {
    EphemeralManager,
    getEphemeralManager,
    type EphemeralMessageRecord,
    type EphemeralManagerOptions,
} from "./ephemeral/EphemeralManager";
export {
    StegoStrategy,
    EMOJI_POOL,
    STEGO_MARKER,
    STEGO_MAGIC,
    STEGO_PROTOCOL_VERSION,
    DEFAULT_STEGO_CONFIG,
    getEmojiToByteMap,
    type StegoHeader,
    type StegoMessage,
    type StegoDecodeResult,
    type StegoEncodeOptions,
    type StegoConfig,
    StegoDecodeErrorCode,
    DECODE_ERROR_MESSAGES,
    type StegoDecodeError,
} from "./types";
