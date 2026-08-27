/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";

import { ProcessLoopbackProtocolParser } from "./process-loopback-protocol.js";

function packet(type: number, sequence: number, startFrame: number, payload = Buffer.alloc(0), reason = 0): Buffer {
    const result = Buffer.alloc(48 + payload.length);
    result.writeUInt32LE(0x414d4350, 0);
    result.writeUInt16LE(1, 4);
    result.writeUInt16LE(type, 6);
    result.writeUInt32LE(48, 8);
    result.writeUInt32LE(payload.length, 12);
    result.writeBigUInt64LE(BigInt(sequence), 16);
    result.writeBigUInt64LE(BigInt(startFrame), 24);
    result.writeUInt32LE(reason, 36);
    payload.copy(result, 48);
    return result;
}

function startPacket(): Buffer {
    const format = Buffer.alloc(16);
    format.writeUInt32LE(48_000, 0);
    format.writeUInt16LE(2, 4);
    format.writeUInt16LE(16, 6);
    format.writeUInt16LE(4, 8);
    format.writeUInt32LE(192_000, 12);
    return packet(1, 0, 0, format);
}

describe("process-loopback framed protocol", () => {
    it("accepts fragmented fixed-format START, contiguous PCM, and END", () => {
        const packets = vi.fn();
        const failed = vi.fn();
        const parser = new ProcessLoopbackProtocolParser(packets, failed);
        const stream = Buffer.concat([
            startPacket(),
            packet(2, 0, 0, Buffer.alloc(1_920, 1)),
            packet(2, 1, 480, Buffer.alloc(960, 2)),
            packet(3, 2, 720, undefined, 2),
        ]);
        parser.push(stream.subarray(0, 17));
        parser.push(stream.subarray(17));
        parser.finish();

        expect(failed).not.toHaveBeenCalled();
        expect(packets.mock.calls.map(([value]) => value.type)).toEqual(["start", "pcm", "pcm", "end"]);
        expect(packets.mock.calls[1][0]).toMatchObject({ sequence: 0, startFrame: 0 });
        expect(packets.mock.calls[1][0].data.byteLength).toBe(1_920);
        expect(packets.mock.calls[3][0]).toEqual({ type: "end", reason: 2 });
    });

    it("rejects unsupported format, discontinuity, truncation, and trailing data", () => {
        const invalidFormat = startPacket();
        invalidFormat.writeUInt32LE(44_100, 48);
        for (const stream of [
            invalidFormat,
            Buffer.concat([startPacket(), packet(2, 1, 0, Buffer.alloc(4))]),
            startPacket().subarray(0, 30),
            Buffer.concat([startPacket(), packet(3, 0, 0), Buffer.from([1])]),
        ]) {
            const failed = vi.fn();
            const parser = new ProcessLoopbackProtocolParser(vi.fn(), failed);
            parser.push(stream);
            parser.finish();
            expect(failed).toHaveBeenCalledOnce();
        }
    });
});
