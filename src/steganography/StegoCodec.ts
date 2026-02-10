/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Unified steganography codec that orchestrates emoji, image, and error
 * correction strategies.
 *
 * Automatically selects the best encoding strategy based on payload size:
 *   - < 64 bytes  → single emoji / short emoji sequence
 *   - 64–1024 bytes → emoji string
 *   - > 1024 bytes  → image LSB
 *
 * Integrates with Matrix E2EE: the codec operates on already-encrypted payloads.
 * The Matrix client handles key management and encryption; this codec handles
 * steganographic concealment.
 */

import { crc32 } from "./crc32";
import { decodeEmoji, encodeEmoji, hasStegoMarker, looksLikeStegoEmoji } from "./EmojiStego";
import {
    calculateCapacity,
    dataUrlToImageData,
    decodeImage,
    encodeImage,
    imageDataToDataUrl,
} from "./ImageStego";
import { rsDecode, rsEncode } from "./ReedSolomon";
import {
    DEFAULT_STEGO_CONFIG,
    StegoStrategy,
    type StegoConfig,
    type StegoDecodeResult,
    type StegoEncodeOptions,
    type StegoMessage,
} from "./types";

/**
 * The main steganography codec.
 *
 * Usage:
 * ```ts
 * const codec = new StegoCodec();
 *
 * // Encode: plaintext → encrypted → stego carrier
 * const encrypted = await matrixEncrypt(plaintext);
 * const message = await codec.encode(encrypted, { strategy: StegoStrategy.Emoji });
 * // message.carrier is an emoji string like "🐶🎩🌸..."
 *
 * // Decode: stego carrier → encrypted → plaintext
 * const result = await codec.decode(carrier);
 * const plaintext = await matrixDecrypt(result.payload);
 * ```
 */
export class StegoCodec {
    private config: StegoConfig;

    public constructor(config?: Partial<StegoConfig>) {
        this.config = { ...DEFAULT_STEGO_CONFIG, ...config };
    }

    /**
     * Select the best encoding strategy for a payload of given size.
     */
    public selectStrategy(payloadSize: number): StegoStrategy {
        if (payloadSize <= this.config.emojiStringThreshold) {
            return StegoStrategy.Emoji;
        }
        if (payloadSize <= this.config.maxEmojiPayloadBytes) {
            return StegoStrategy.EmojiString;
        }
        return StegoStrategy.Image;
    }

    /**
     * Encode an encrypted payload into a steganographic carrier.
     *
     * @param encryptedPayload - Already-encrypted message bytes.
     * @param options - Encoding options (strategy, expiry, cover image, etc.)
     * @returns A StegoMessage containing the carrier and metadata.
     */
    public async encode(encryptedPayload: Uint8Array, options: StegoEncodeOptions = {}): Promise<StegoMessage> {
        const strategy = options.strategy ?? this.selectStrategy(encryptedPayload.length);
        const expiryMs = options.expiryMs ?? this.config.defaultExpiryMs;
        const expiresAt = Date.now() + expiryMs;
        const useErrorCorrection = options.errorCorrection !== false;

        // Apply Reed-Solomon error correction if enabled
        let payload = encryptedPayload;
        if (useErrorCorrection && (strategy === StegoStrategy.Emoji || strategy === StegoStrategy.EmojiString)) {
            payload = rsEncode(encryptedPayload, this.config.reedSolomonSymbols);
        }

        let carrier: string;

        switch (strategy) {
            case StegoStrategy.Emoji:
            case StegoStrategy.EmojiString:
                carrier = encodeEmoji(payload, expiresAt, strategy);
                break;

            case StegoStrategy.Image: {
                const coverImage = options.coverImage;
                if (!coverImage) {
                    throw new Error("Image steganography requires a cover image");
                }

                let imageData: ImageData;
                if (typeof coverImage === "string") {
                    imageData = await dataUrlToImageData(coverImage);
                } else {
                    imageData = coverImage;
                }

                const capacity = calculateCapacity(imageData.width, imageData.height);
                if (payload.length > capacity) {
                    throw new Error(
                        `Payload (${payload.length} bytes) exceeds image capacity (${capacity} bytes). ` +
                            `Use a larger image (current: ${imageData.width}x${imageData.height}).`,
                    );
                }

                const encoded = encodeImage(imageData, payload, expiresAt);
                if (!encoded) {
                    throw new Error("Failed to encode payload into image");
                }

                carrier = imageDataToDataUrl(encoded);
                break;
            }
        }

        const checksum = crc32(encryptedPayload);

        return {
            header: {
                version: 1,
                strategy,
                payloadLength: encryptedPayload.length,
                checksum,
                expiresAt,
                eventId: options.eventId,
            },
            encryptedPayload,
            carrier,
            strategy,
        };
    }

    /**
     * Decode a steganographic carrier back into an encrypted payload.
     *
     * This method auto-detects the strategy:
     *   - Strings starting with stego marker or matching emoji patterns → emoji decode
     *   - Data URLs (image/png) → image decode
     *
     * @param carrier - The steganographic carrier (emoji string or image data URL).
     * @returns Decode result with payload and metadata, or null if not a stego message.
     */
    public async decode(carrier: string): Promise<{ payload: Uint8Array; header: StegoDecodeResult } | null> {
        // Try emoji decode first
        if (this.looksLikeEmojiStego(carrier)) {
            return this.decodeEmojiCarrier(carrier);
        }

        // Try image decode
        if (carrier.startsWith("data:image/png")) {
            return this.decodeImageCarrier(carrier);
        }

        // Unknown carrier type
        return null;
    }

    /**
     * Check if a string might contain a steganographic payload.
     * Fast, lightweight check for scanning incoming messages.
     */
    public looksLikeStego(content: string): boolean {
        return this.looksLikeEmojiStego(content) || content.startsWith("data:image/png");
    }

    /**
     * Check if a string looks like emoji steganography.
     */
    public looksLikeEmojiStego(content: string): boolean {
        return hasStegoMarker(content) || looksLikeStegoEmoji(content);
    }

    /**
     * Decode an emoji carrier string.
     */
    private decodeEmojiCarrier(carrier: string): { payload: Uint8Array; header: StegoDecodeResult } | null {
        const result = decodeEmoji(carrier);
        if (!result) return null;

        const { header, payload } = result;

        // Try Reed-Solomon decoding
        let decodedPayload = payload;
        let rsApplied = false;

        if (
            header.strategy === StegoStrategy.Emoji ||
            header.strategy === StegoStrategy.EmojiString
        ) {
            const rsDecoded = rsDecode(payload, this.config.reedSolomonSymbols);
            if (rsDecoded) {
                decodedPayload = rsDecoded;
                rsApplied = true;
            }
            // If RS decode fails, use raw payload (might still be valid if no RS was applied)
        }

        const expired = header.expiresAt > 0 && Date.now() > header.expiresAt;
        const actualChecksum = crc32(decodedPayload);
        const checksumValid = rsApplied ? true : actualChecksum === header.checksum;

        return {
            payload: decodedPayload,
            header: {
                plaintext: "", // Caller must decrypt
                header,
                checksumValid,
                expired,
            },
        };
    }

    /**
     * Decode an image carrier.
     */
    private async decodeImageCarrier(
        carrier: string,
    ): Promise<{ payload: Uint8Array; header: StegoDecodeResult } | null> {
        const imageData = await dataUrlToImageData(carrier);
        const result = decodeImage(imageData);
        if (!result) return null;

        const { header, payload } = result;
        const expired = header.expiresAt > 0 && Date.now() > header.expiresAt;
        const actualChecksum = crc32(payload);
        const checksumValid = actualChecksum === header.checksum;

        return {
            payload,
            header: {
                plaintext: "",
                header,
                checksumValid,
                expired,
            },
        };
    }
}

/** Singleton codec instance with default config. */
let defaultCodec: StegoCodec | undefined;

/** Get the default StegoCodec instance. */
export function getDefaultCodec(): StegoCodec {
    if (!defaultCodec) {
        defaultCodec = new StegoCodec();
    }
    return defaultCodec;
}
