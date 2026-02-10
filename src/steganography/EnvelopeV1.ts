/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { STEGO_MAGIC, STEGO_PROTOCOL_VERSION, StegoStrategy } from "./types";

const FLAG_NONCE = 1 << 0;
const FLAG_AUTH_TAG = 1 << 1;
const FLAG_CRC32 = 1 << 2;
const FLAG_RS_PARITY = 1 << 3;

const MAX_SAFE_U64 = BigInt(Number.MAX_SAFE_INTEGER);

export interface EnvelopeV1 {
    readonly version: 1;
    readonly strategy: StegoStrategy;
    readonly createdTs: number;
    readonly expiryTs: number;
    readonly ciphertext: Uint8Array;
    readonly nonce?: Uint8Array;
    readonly authTag?: Uint8Array;
    readonly crc32?: number;
    readonly rsParity?: Uint8Array;
}

function encodeStrategy(strategy: StegoStrategy): number {
    switch (strategy) {
        case StegoStrategy.Emoji:
            return 0;
        case StegoStrategy.EmojiString:
            return 1;
        case StegoStrategy.Image:
            return 2;
    }
}

function decodeStrategy(mode: number): StegoStrategy {
    switch (mode) {
        case 0:
            return StegoStrategy.Emoji;
        case 1:
            return StegoStrategy.EmojiString;
        case 2:
            return StegoStrategy.Image;
        default:
            throw new Error(`Invalid envelope mode: ${mode}`);
    }
}

function assertTimestamp(name: string, value: number): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${name} must be a non-negative integer`);
    }
}

function writeU64BE(value: number): number[] {
    assertTimestamp("timestamp", value);
    let n = BigInt(value);
    const out = new Array<number>(8);
    for (let i = 7; i >= 0; i--) {
        out[i] = Number(n & 0xffn);
        n >>= 8n;
    }
    return out;
}

function readU64BE(data: Uint8Array, offset: number): { value: number; offset: number } {
    if (offset + 8 > data.length) throw new Error("Unexpected end of envelope while reading u64");
    let value = 0n;
    for (let i = 0; i < 8; i++) value = (value << 8n) | BigInt(data[offset + i]);
    if (value > MAX_SAFE_U64) throw new Error("u64 value exceeds Number.MAX_SAFE_INTEGER");
    return { value: Number(value), offset: offset + 8 };
}

function writeVarint(value: number): number[] {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error("Varint value must be a non-negative integer");
    }

    const bytes: number[] = [];
    let v = value;
    do {
        let b = v & 0x7f;
        v >>>= 7;
        if (v > 0) b |= 0x80;
        bytes.push(b);
    } while (v > 0);

    return bytes;
}

function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number; offset: number } {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;

    while (offset < data.length) {
        const b = data[offset++];
        bytesRead++;

        if (bytesRead > 5) {
            throw new Error("Varint too long");
        }

        value |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) {
            if (!Number.isSafeInteger(value) || value < 0) {
                throw new Error("Varint out of safe integer range");
            }
            const canonicalLength = writeVarint(value).length;
            if (canonicalLength !== bytesRead) {
                throw new Error("Non-canonical varint encoding");
            }
            return { value, bytesRead, offset };
        }

        shift += 7;
    }

    throw new Error("Unexpected end of envelope while reading varint");
}

function readBytes(data: Uint8Array, offset: number, len: number, field: string): { value: Uint8Array; offset: number } {
    if (len < 0 || offset + len > data.length) {
        throw new Error(`Unexpected end of envelope while reading ${field}`);
    }
    return { value: data.slice(offset, offset + len), offset: offset + len };
}

/**
 * Serialize EnvelopeV1 into a compact binary representation.
 */
export function serializeEnvelopeV1(envelope: EnvelopeV1): Uint8Array {
    if (envelope.version !== STEGO_PROTOCOL_VERSION) {
        throw new Error(`Envelope version must be ${STEGO_PROTOCOL_VERSION}`);
    }

    assertTimestamp("createdTs", envelope.createdTs);
    assertTimestamp("expiryTs", envelope.expiryTs);

    if (envelope.expiryTs < envelope.createdTs) {
        throw new Error("expiryTs must be greater than or equal to createdTs");
    }

    if (!(envelope.ciphertext instanceof Uint8Array)) {
        throw new Error("ciphertext must be a Uint8Array");
    }

    const hasNonce = envelope.nonce !== undefined;
    const hasAuthTag = envelope.authTag !== undefined;
    const hasCrc = envelope.crc32 !== undefined;
    const hasRs = envelope.rsParity !== undefined;

    if (hasCrc && (!Number.isInteger(envelope.crc32) || envelope.crc32! < 0 || envelope.crc32! > 0xffffffff)) {
        throw new Error("crc32 must be a uint32 when present");
    }

    let flags = 0;
    if (hasNonce) flags |= FLAG_NONCE;
    if (hasAuthTag) flags |= FLAG_AUTH_TAG;
    if (hasCrc) flags |= FLAG_CRC32;
    if (hasRs) flags |= FLAG_RS_PARITY;

    const bytes: number[] = [];
    bytes.push(STEGO_MAGIC[0], STEGO_MAGIC[1]);
    bytes.push(envelope.version);
    bytes.push(encodeStrategy(envelope.strategy));
    bytes.push(flags);
    bytes.push(...writeU64BE(envelope.createdTs));
    bytes.push(...writeU64BE(envelope.expiryTs));
    bytes.push(...writeVarint(envelope.ciphertext.length));
    bytes.push(...envelope.ciphertext);

    if (hasNonce) {
        bytes.push(...writeVarint(envelope.nonce!.length));
        bytes.push(...envelope.nonce!);
    }

    if (hasAuthTag) {
        bytes.push(...writeVarint(envelope.authTag!.length));
        bytes.push(...envelope.authTag!);
    }

    if (hasCrc) {
        const crc = envelope.crc32! >>> 0;
        bytes.push((crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
    }

    if (hasRs) {
        bytes.push(...writeVarint(envelope.rsParity!.length));
        bytes.push(...envelope.rsParity!);
    }

    return Uint8Array.from(bytes);
}

/**
 * Deserialize and strictly validate an EnvelopeV1 payload.
 */
export function deserializeEnvelopeV1(data: Uint8Array): EnvelopeV1 {
    if (!(data instanceof Uint8Array)) {
        throw new Error("Envelope data must be a Uint8Array");
    }

    let offset = 0;

    if (data.length < 2 + 1 + 1 + 1 + 8 + 8 + 1) {
        throw new Error("Envelope too short");
    }

    if (data[offset++] !== STEGO_MAGIC[0] || data[offset++] !== STEGO_MAGIC[1]) {
        throw new Error("Invalid envelope magic");
    }

    const version = data[offset++];
    if (version !== STEGO_PROTOCOL_VERSION) {
        throw new Error(`Unsupported envelope version: ${version}`);
    }

    const strategy = decodeStrategy(data[offset++]);
    const flags = data[offset++];

    const created = readU64BE(data, offset);
    offset = created.offset;

    const expiry = readU64BE(data, offset);
    offset = expiry.offset;

    if (expiry.value < created.value) {
        throw new Error("expiryTs must be greater than or equal to createdTs");
    }

    const ciphertextLen = readVarint(data, offset);
    offset = ciphertextLen.offset;

    const ciphertext = readBytes(data, offset, ciphertextLen.value, "ciphertext");
    offset = ciphertext.offset;

    let nonce: Uint8Array | undefined;
    let authTag: Uint8Array | undefined;
    let crc32: number | undefined;
    let rsParity: Uint8Array | undefined;

    if (flags & FLAG_NONCE) {
        const len = readVarint(data, offset);
        offset = len.offset;
        const value = readBytes(data, offset, len.value, "nonce");
        nonce = value.value;
        offset = value.offset;
    }

    if (flags & FLAG_AUTH_TAG) {
        const len = readVarint(data, offset);
        offset = len.offset;
        const value = readBytes(data, offset, len.value, "authTag");
        authTag = value.value;
        offset = value.offset;
    }

    if (flags & FLAG_CRC32) {
        if (offset + 4 > data.length) throw new Error("Unexpected end of envelope while reading crc32");
        crc32 = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
        offset += 4;
    }

    if (flags & FLAG_RS_PARITY) {
        const len = readVarint(data, offset);
        offset = len.offset;
        const value = readBytes(data, offset, len.value, "rsParity");
        rsParity = value.value;
        offset = value.offset;
    }

    const unknownFlags = flags & ~(FLAG_NONCE | FLAG_AUTH_TAG | FLAG_CRC32 | FLAG_RS_PARITY);
    if (unknownFlags !== 0) {
        throw new Error(`Unknown envelope flags: ${unknownFlags}`);
    }

    if (offset !== data.length) {
        throw new Error("Envelope has trailing bytes");
    }

    return {
        version: STEGO_PROTOCOL_VERSION,
        strategy,
        createdTs: created.value,
        expiryTs: expiry.value,
        ciphertext: ciphertext.value,
        nonce,
        authTag,
        crc32,
        rsParity,
    };
}
