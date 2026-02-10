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
    STEGO_PROTOCOL_VERSION,
    StegoDecodeErrorCode,
    StegoStrategy,
    type StegoConfig,
    type StegoDecodeError,
    type StegoDecodeResult,
    type StegoEncodeOptions,
    type StegoMessage,
} from "./types";

/** Result type that carries either a successful decode or a structured error. */
export type DecodeOutcome =
    | { ok: true; payload: Uint8Array; header: StegoDecodeResult }
    | { ok: false; error: StegoDecodeError };

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
 * const result = await codec.decodeDiagnostic(carrier);
 * if (result.ok) {
 *     const plaintext = await matrixDecrypt(result.payload);
 * } else {
 *     showError(result.error.message);
 * }
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
        const result = await this.decodeDiagnostic(carrier);
        if (result.ok) {
            return { payload: result.payload, header: result.header };
        }
        // Preserve backward compatibility: NotStegoContent returns null
        if (result.error.code === StegoDecodeErrorCode.NotStegoContent) {
            return null;
        }
        return null;
    }

    /**
     * Decode with full diagnostic error reporting.
     *
     * Unlike `decode()`, this method never returns bare null — it always
     * returns a structured result explaining what happened.
     *
     * @param carrier - The steganographic carrier (emoji string or image data URL).
     * @returns DecodeOutcome with either the decoded payload or a diagnostic error.
     */
    public async decodeDiagnostic(carrier: string): Promise<DecodeOutcome> {
        // Try emoji decode first
        if (this.looksLikeEmojiStego(carrier)) {
            return this.decodeEmojiCarrierDiagnostic(carrier);
        }

        // Try image decode
        if (carrier.startsWith("data:image/png")) {
            return this.decodeImageCarrierDiagnostic(carrier);
        }

        // Unknown carrier type
        return {
            ok: false,
            error: {
                code: StegoDecodeErrorCode.NotStegoContent,
                message: "This message does not contain hidden content",
                rsAttempted: false,
                rsCorrected: false,
            },
        };
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
     * Decode an emoji carrier string (backward-compatible wrapper).
     */
    private decodeEmojiCarrier(carrier: string): { payload: Uint8Array; header: StegoDecodeResult } | null {
        const result = this.decodeEmojiCarrierDiagnostic(carrier);
        return result.ok ? { payload: result.payload, header: result.header } : null;
    }

    /**
     * Decode an emoji carrier string with full diagnostics.
     */
    private decodeEmojiCarrierDiagnostic(carrier: string): DecodeOutcome {
        const result = decodeEmoji(carrier);
        if (!result) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.MalformedHeader,
                    message: "The hidden message header is damaged or the emoji sequence is invalid",
                    rsAttempted: false,
                    rsCorrected: false,
                },
            };
        }

        const { header, payload } = result;

        // Check protocol version
        if (header.version > STEGO_PROTOCOL_VERSION) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.UnsupportedVersion,
                    message: `Protocol version ${header.version} is not supported (max: ${STEGO_PROTOCOL_VERSION})`,
                    rsAttempted: false,
                    rsCorrected: false,
                    partialHeader: header,
                },
            };
        }

        // Check expiry before spending time on RS decode
        const expired = header.expiresAt > 0 && Date.now() > header.expiresAt;
        if (expired) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.Expired,
                    message: "This hidden message has expired",
                    rsAttempted: false,
                    rsCorrected: false,
                    partialHeader: header,
                },
            };
        }

        // Try Reed-Solomon decoding
        let decodedPayload = payload;
        let rsAttempted = false;
        let rsCorrected = false;

        if (
            header.strategy === StegoStrategy.Emoji ||
            header.strategy === StegoStrategy.EmojiString
        ) {
            rsAttempted = true;
            const rsDecoded = rsDecode(payload, this.config.reedSolomonSymbols);
            if (rsDecoded) {
                // Check if RS actually corrected anything by comparing lengths
                rsCorrected = rsDecoded.length !== payload.length;
                decodedPayload = rsDecoded;
            } else {
                // RS decode failed — payload is too corrupted
                return {
                    ok: false,
                    error: {
                        code: StegoDecodeErrorCode.UncorrectableCorruption,
                        message: "The hidden message is too damaged to recover — error correction failed",
                        rsAttempted: true,
                        rsCorrected: false,
                        partialHeader: header,
                    },
                };
            }
        }

        const actualChecksum = crc32(decodedPayload);
        const checksumValid = rsAttempted ? true : actualChecksum === header.checksum;

        if (!checksumValid) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.ChecksumMismatch,
                    message: "The hidden message was corrupted during transport (checksum mismatch)",
                    rsAttempted,
                    rsCorrected,
                    partialHeader: header,
                },
            };
        }

        return {
            ok: true,
            payload: decodedPayload,
            header: {
                plaintext: "", // Caller must decrypt
                header,
                checksumValid,
                expired: false,
            },
        };
    }

    /**
     * Decode an image carrier with full diagnostics.
     */
    private async decodeImageCarrierDiagnostic(carrier: string): Promise<DecodeOutcome> {
        let imageData: ImageData;
        try {
            imageData = await dataUrlToImageData(carrier);
        } catch {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.ImageDecodeFailed,
                    message: "Could not load the image data for stego decoding",
                    rsAttempted: false,
                    rsCorrected: false,
                },
            };
        }

        const result = decodeImage(imageData);
        if (!result) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.ImageDecodeFailed,
                    message: "Could not extract hidden data from the image",
                    rsAttempted: false,
                    rsCorrected: false,
                },
            };
        }

        const { header, payload } = result;

        // Check protocol version
        if (header.version > STEGO_PROTOCOL_VERSION) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.UnsupportedVersion,
                    message: `Protocol version ${header.version} is not supported (max: ${STEGO_PROTOCOL_VERSION})`,
                    rsAttempted: false,
                    rsCorrected: false,
                    partialHeader: header,
                },
            };
        }

        const expired = header.expiresAt > 0 && Date.now() > header.expiresAt;
        if (expired) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.Expired,
                    message: "This hidden message has expired",
                    rsAttempted: false,
                    rsCorrected: false,
                    partialHeader: header,
                },
            };
        }

        const actualChecksum = crc32(payload);
        const checksumValid = actualChecksum === header.checksum;

        if (!checksumValid) {
            return {
                ok: false,
                error: {
                    code: StegoDecodeErrorCode.ChecksumMismatch,
                    message: "The hidden image message was corrupted during transport",
                    rsAttempted: false,
                    rsCorrected: false,
                    partialHeader: header,
                },
            };
        }

        return {
            ok: true,
            payload,
            header: {
                plaintext: "",
                header,
                checksumValid: true,
                expired: false,
            },
        };
    }

    /**
     * Decode an image carrier (backward-compatible wrapper).
     */
    private async decodeImageCarrier(
        carrier: string,
    ): Promise<{ payload: Uint8Array; header: StegoDecodeResult } | null> {
        const result = await this.decodeImageCarrierDiagnostic(carrier);
        return result.ok ? { payload: result.payload, header: result.header } : null;
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
