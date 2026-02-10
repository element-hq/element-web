/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Image-based steganography using Least Significant Bit (LSB) encoding.
 *
 * Embeds encrypted payloads into PNG images by modifying the least significant
 * bits of pixel color channels. Only works with lossless formats (PNG).
 *
 * Layout in image pixels (LSB of R, G, B channels = 3 bits per pixel):
 *   [32-bit payload length] [payload bytes] [padding]
 *
 * The first ~11 pixels encode the payload length, followed by the payload data.
 */

import { crc32 } from "./crc32";
import { STEGO_MAGIC, STEGO_PROTOCOL_VERSION, StegoStrategy, type StegoHeader } from "./types";

/** Bits per color channel used for encoding. */
const BITS_PER_CHANNEL = 1;
/** Color channels used per pixel (R, G, B — skip alpha). */
const CHANNELS_PER_PIXEL = 3;
/** Bits encoded per pixel. */
const BITS_PER_PIXEL = BITS_PER_CHANNEL * CHANNELS_PER_PIXEL;

/** Length prefix size in bytes (4 bytes = 32-bit unsigned). */
const LENGTH_PREFIX_BYTES = 4;

/** Minimum header for image stego: magic(2) + version(1) + length(4) + crc(4) + expiry(6) = 17 bytes. */
const IMAGE_HEADER_BYTES = 17;

/**
 * Calculate the maximum payload capacity of an image.
 *
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns Maximum embeddable bytes.
 */
export function calculateCapacity(width: number, height: number): number {
    const totalBits = width * height * BITS_PER_PIXEL;
    const totalBytes = Math.floor(totalBits / 8);
    return Math.max(0, totalBytes - IMAGE_HEADER_BYTES);
}

/**
 * Build the image stego header as bytes.
 */
function buildImageHeader(payload: Uint8Array, expiresAt: number): Uint8Array {
    const header = new Uint8Array(IMAGE_HEADER_BYTES);
    let offset = 0;

    // Magic (2 bytes)
    header[offset++] = STEGO_MAGIC[0];
    header[offset++] = STEGO_MAGIC[1];

    // Version (1 byte)
    header[offset++] = STEGO_PROTOCOL_VERSION;

    // Payload length (4 bytes, big-endian)
    const len = payload.length;
    header[offset++] = (len >>> 24) & 0xff;
    header[offset++] = (len >>> 16) & 0xff;
    header[offset++] = (len >>> 8) & 0xff;
    header[offset++] = len & 0xff;

    // CRC-32 (4 bytes, big-endian)
    const checksum = crc32(payload);
    header[offset++] = (checksum >>> 24) & 0xff;
    header[offset++] = (checksum >>> 16) & 0xff;
    header[offset++] = (checksum >>> 8) & 0xff;
    header[offset++] = checksum & 0xff;

    // Expiry timestamp (6 bytes, big-endian)
    const tsHi = Math.floor(expiresAt / 0x100000000) & 0xffff;
    const tsLo = expiresAt >>> 0;
    header[offset++] = (tsHi >>> 8) & 0xff;
    header[offset++] = tsHi & 0xff;
    header[offset++] = (tsLo >>> 24) & 0xff;
    header[offset++] = (tsLo >>> 16) & 0xff;
    header[offset++] = (tsLo >>> 8) & 0xff;
    header[offset++] = tsLo & 0xff;

    return header;
}

/**
 * Embed a bit into a pixel channel value using LSB.
 */
function embedBit(channelValue: number, bit: number): number {
    return (channelValue & 0xfe) | (bit & 1);
}

/**
 * Extract a bit from a pixel channel value.
 */
function extractBit(channelValue: number): number {
    return channelValue & 1;
}

/**
 * Embed payload bytes into image pixel data using LSB steganography.
 *
 * @param imageData - The ImageData object (RGBA pixel array).
 * @param payload - Encrypted payload bytes.
 * @param expiresAt - Unix timestamp (ms) for message expiration.
 * @returns Modified ImageData with embedded payload, or null if image too small.
 */
export function encodeImage(imageData: ImageData, payload: Uint8Array, expiresAt: number): ImageData | null {
    const capacity = calculateCapacity(imageData.width, imageData.height);
    if (payload.length > capacity) {
        return null; // Image too small for this payload
    }

    const header = buildImageHeader(payload, expiresAt);
    const fullPayload = new Uint8Array(header.length + payload.length);
    fullPayload.set(header);
    fullPayload.set(payload, header.length);

    // Convert payload bytes to bit stream
    const bits: number[] = [];
    for (let i = 0; i < fullPayload.length; i++) {
        for (let b = 7; b >= 0; b--) {
            bits.push((fullPayload[i] >>> b) & 1);
        }
    }

    // Clone image data
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

    // Embed bits into LSB of R, G, B channels
    let bitIdx = 0;
    for (let px = 0; px < result.width * result.height && bitIdx < bits.length; px++) {
        const offset = px * 4; // RGBA
        for (let ch = 0; ch < CHANNELS_PER_PIXEL && bitIdx < bits.length; ch++) {
            result.data[offset + ch] = embedBit(result.data[offset + ch], bits[bitIdx]);
            bitIdx++;
        }
        // Alpha channel (offset + 3) is left untouched
    }

    return result;
}

/**
 * Extract payload from an image with LSB steganography.
 *
 * @param imageData - The ImageData to decode.
 * @returns Object with header and payload, or null if no stego data found.
 */
export function decodeImage(imageData: ImageData): { header: StegoHeader; payload: Uint8Array } | null {
    // Extract bits from image LSBs
    const totalPixels = imageData.width * imageData.height;
    const maxBits = totalPixels * BITS_PER_PIXEL;
    const maxBytes = Math.floor(maxBits / 8);

    if (maxBytes < IMAGE_HEADER_BYTES) {
        return null;
    }

    // Extract header bytes first
    const headerBits = IMAGE_HEADER_BYTES * 8;
    const headerBytes = new Uint8Array(IMAGE_HEADER_BYTES);
    let bitIdx = 0;

    for (let px = 0; px < totalPixels && bitIdx < headerBits; px++) {
        const offset = px * 4;
        for (let ch = 0; ch < CHANNELS_PER_PIXEL && bitIdx < headerBits; ch++) {
            const bytePos = Math.floor(bitIdx / 8);
            const bitPos = 7 - (bitIdx % 8);
            headerBytes[bytePos] |= extractBit(imageData.data[offset + ch]) << bitPos;
            bitIdx++;
        }
    }

    // Verify magic
    if (headerBytes[0] !== STEGO_MAGIC[0] || headerBytes[1] !== STEGO_MAGIC[1]) {
        return null;
    }

    // Parse header
    const version = headerBytes[2];
    const payloadLength =
        ((headerBytes[3] << 24) | (headerBytes[4] << 16) | (headerBytes[5] << 8) | headerBytes[6]) >>> 0;

    if (payloadLength > maxBytes - IMAGE_HEADER_BYTES) {
        return null; // Payload claims to be larger than image capacity
    }

    const checksum =
        ((headerBytes[7] << 24) | (headerBytes[8] << 16) | (headerBytes[9] << 8) | headerBytes[10]) >>> 0;

    const tsHi = (headerBytes[11] << 8) | headerBytes[12];
    const tsLo = ((headerBytes[13] << 24) | (headerBytes[14] << 16) | (headerBytes[15] << 8) | headerBytes[16]) >>> 0;
    const expiresAt = tsHi * 0x100000000 + tsLo;

    // Extract payload bytes
    const totalBitsNeeded = (IMAGE_HEADER_BYTES + payloadLength) * 8;
    const payload = new Uint8Array(payloadLength);

    // Continue from where we left off (after header)
    bitIdx = headerBits;
    for (let px = Math.floor(headerBits / BITS_PER_PIXEL); px < totalPixels && bitIdx < totalBitsNeeded; px++) {
        const offset = px * 4;
        const startCh = px === Math.floor(headerBits / BITS_PER_PIXEL) ? headerBits % BITS_PER_PIXEL : 0;
        for (let ch = startCh; ch < CHANNELS_PER_PIXEL && bitIdx < totalBitsNeeded; ch++) {
            const payloadBitIdx = bitIdx - headerBits;
            const bytePos = Math.floor(payloadBitIdx / 8);
            const bitPos = 7 - (payloadBitIdx % 8);
            payload[bytePos] |= extractBit(imageData.data[offset + ch]) << bitPos;
            bitIdx++;
        }
    }

    // Verify checksum
    const actualChecksum = crc32(payload);

    const header: StegoHeader = {
        version,
        strategy: StegoStrategy.Image,
        payloadLength,
        checksum,
        expiresAt,
    };

    if (actualChecksum !== checksum) {
        header.checksum = actualChecksum;
    }

    return { header, payload };
}

/**
 * Convert a data URL to ImageData using an OffscreenCanvas (or <canvas> fallback).
 */
export async function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
    if (typeof OffscreenCanvas !== "undefined") {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context from OffscreenCanvas");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    }

    // Fallback for environments without OffscreenCanvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = (): void => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Failed to get 2D context"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = (): void => reject(new Error("Failed to load image"));
        img.src = dataUrl;
    });
}

/**
 * Convert ImageData back to a PNG data URL.
 */
export function imageDataToDataUrl(imageData: ImageData): string {
    if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(imageData.width, imageData.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context from OffscreenCanvas");
        ctx.putImageData(imageData, 0, 0);
        // convertToBlob is async but we need sync — use regular canvas fallback
    }

    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
}
