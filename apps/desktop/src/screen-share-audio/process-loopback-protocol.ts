/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

const magic = 0x414d4350;
const version = 1;
const headerBytes = 48;
const maxPayloadBytes = 192_000;
const maxBufferedBytes = (headerBytes + maxPayloadBytes) * 2;

export type ProcessLoopbackPacket =
    | { type: "start" }
    | { type: "pcm"; sequence: number; startFrame: number; data: ArrayBuffer }
    | { type: "end"; reason: number };

export class ProcessLoopbackProtocolParser {
    private buffer: Buffer = Buffer.alloc(0);
    private started = false;
    private ended = false;
    private failed = false;
    private expectedSequence = 0;
    private expectedStartFrame = 0;

    public constructor(
        private readonly onPacket: (packet: ProcessLoopbackPacket) => void,
        private readonly onError: (error: Error) => void,
    ) {}

    public push(chunk: Buffer): void {
        if (this.failed || chunk.length === 0) return;
        if (this.ended) return this.fail("trailing data after END");
        if (this.buffer.length + chunk.length > maxBufferedBytes) return this.fail("protocol buffer cap exceeded");
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
        while (this.buffer.length >= headerBytes && !this.failed) {
            const payloadBytes = this.buffer.readUInt32LE(12);
            if (payloadBytes > maxPayloadBytes) return this.fail("PCM payload cap exceeded");
            const packetBytes = headerBytes + payloadBytes;
            if (this.buffer.length < packetBytes) return;
            const packet = this.buffer.subarray(0, packetBytes);
            this.buffer = this.buffer.subarray(packetBytes);
            this.parse(packet, payloadBytes);
        }
    }

    public finish(): void {
        if (this.failed) return;
        if (this.buffer.length) return this.fail("truncated protocol packet");
        if (!this.ended) this.fail("producer EOF before END");
    }

    private parse(packet: Buffer, payloadBytes: number): void {
        if (
            packet.readUInt32LE(0) !== magic ||
            packet.readUInt16LE(4) !== version ||
            packet.readUInt32LE(8) !== headerBytes
        ) {
            return this.fail("unsupported protocol header");
        }
        const type = packet.readUInt16LE(6);
        const sequence = Number(packet.readBigUInt64LE(16));
        const startFrame = Number(packet.readBigUInt64LE(24));
        if (!Number.isSafeInteger(sequence) || !Number.isSafeInteger(startFrame)) {
            return this.fail("protocol counter exceeds JavaScript range");
        }
        if (type === 1) {
            if (this.started || payloadBytes !== 16 || sequence !== 0 || startFrame !== 0) {
                return this.fail("invalid START packet");
            }
            const payload = packet.subarray(headerBytes);
            if (
                payload.readUInt32LE(0) !== 48_000 ||
                payload.readUInt16LE(4) !== 2 ||
                payload.readUInt16LE(6) !== 16 ||
                payload.readUInt16LE(8) !== 4 ||
                payload.readUInt32LE(12) !== 192_000
            ) {
                return this.fail("unsupported PCM format");
            }
            this.started = true;
            this.onPacket({ type: "start" });
            return;
        }
        if (type === 2) {
            if (
                !this.started ||
                this.ended ||
                payloadBytes === 0 ||
                payloadBytes % 4 !== 0 ||
                sequence !== this.expectedSequence ||
                startFrame !== this.expectedStartFrame
            ) {
                return this.fail("invalid or discontinuous PCM packet");
            }
            const payload = packet.subarray(headerBytes);
            this.expectedSequence++;
            this.expectedStartFrame += payloadBytes / 4;
            this.onPacket({
                type: "pcm",
                sequence,
                startFrame,
                data: payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer,
            });
            return;
        }
        if (
            type !== 3 ||
            !this.started ||
            this.ended ||
            payloadBytes !== 0 ||
            sequence !== this.expectedSequence ||
            startFrame !== this.expectedStartFrame
        ) {
            return this.fail("invalid END packet");
        }
        this.ended = true;
        this.onPacket({ type: "end", reason: packet.readUInt32LE(36) });
    }

    private fail(message: string): void {
        if (this.failed) return;
        this.failed = true;
        this.buffer = Buffer.alloc(0);
        this.onError(new Error(message));
    }
}
