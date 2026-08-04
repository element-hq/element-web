/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { imageFormatLabel, sniffVideoCodec, videoContainerLabel } from "../../../src/utils/MediaFormat";

function box(type: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(8 + payload.length);
    new DataView(out.buffer).setUint32(0, out.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(payload, 8);
    return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function ascii(text: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array([...text].map((c) => c.charCodeAt(0)));
}

function trak(fourCc: string): Uint8Array<ArrayBuffer> {
    const sampleEntry = box(fourCc, new Uint8Array(8));
    const stsd = box("stsd", concat(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), sampleEntry));
    return box("trak", box("mdia", box("minf", box("stbl", stsd))));
}

/** Minimal ISO base media file whose tracks name the given codecs, in order. */
function mp4WithTracks(fourCcs: string[], leading: Uint8Array = new Uint8Array(0)): File {
    const moov = box("moov", concat(...fourCcs.map(trak)));
    const ftyp = box("ftyp", ascii("isom"));
    return new File([concat(ftyp, leading, moov)], "clip.mp4", { type: "video/mp4" });
}

function mp4WithCodec(fourCc: string, leading: Uint8Array = new Uint8Array(0)): File {
    return mp4WithTracks([fourCc], leading);
}

/** Minimal EBML stream carrying a CodecID element. */
function matroskaWithCodec(codecId: string): File {
    const header = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04]);
    const codec = concat(new Uint8Array([0x86, 0x80 | codecId.length]), ascii(codecId));
    return new File([concat(header, codec)], "clip.mkv", { type: "video/x-matroska" });
}

describe("MediaFormat", () => {
    describe("imageFormatLabel", () => {
        it.each([
            ["image/jpeg", "JPEG"],
            ["image/png", "PNG"],
            ["image/gif", "GIF"],
            ["image/webp", "WebP"],
            ["image/avif", "AVIF"],
            ["image/svg+xml", "SVG"],
        ])("labels %s as %s", (mimeType, expected) => {
            expect(imageFormatLabel(mimeType)).toEqual(expected);
        });

        it("falls back to the mime subtype for unknown types", () => {
            expect(imageFormatLabel("image/x-nonsense")).toEqual("NONSENSE");
        });
    });

    describe("videoContainerLabel", () => {
        it.each([
            ["video/mp4", "mp4"],
            ["video/quicktime", "mov"],
            ["video/webm", "webm"],
            ["video/x-matroska", "mkv"],
        ])("labels %s as %s", (mimeType, expected) => {
            expect(videoContainerLabel(mimeType, "clip")).toEqual(expected);
        });

        it("falls back to the file extension when the mime type is unhelpful", () => {
            expect(videoContainerLabel("application/octet-stream", "holiday.mkv")).toEqual("mkv");
        });
    });

    describe("sniffVideoCodec", () => {
        it.each([
            ["avc1", "h264"],
            ["hvc1", "h265"],
            ["av01", "av1"],
            ["vp09", "vp9"],
        ])("reads %s out of an mp4 as %s", async (fourCc, expected) => {
            expect(await sniffVideoCodec(mp4WithCodec(fourCc))).toEqual(expected);
        });

        it.each([
            ["V_VP9", "vp9"],
            ["V_AV1", "av1"],
            ["V_MPEG4/ISO/AVC", "h264"],
            ["V_MPEGH/ISO/HEVC", "h265"],
        ])("reads %s out of a matroska file as %s", async (codecId, expected) => {
            expect(await sniffVideoCodec(matroskaWithCodec(codecId))).toEqual(expected);
        });

        it("skips the audio track when it comes first", async () => {
            // QuickTime and many muxers write the audio trak first.
            expect(await sniffVideoCodec(mp4WithTracks(["mp4a", "avc1"]))).toEqual("h264");
        });

        it("returns undefined when no track holds a video codec", async () => {
            expect(await sniffVideoCodec(mp4WithTracks(["mp4a"]))).toBeUndefined();
        });

        it("finds moov even when it trails a large mdat", async () => {
            // Files not written for streaming keep moov at the end, past the sniff window.
            const mdat = box("mdat", new Uint8Array(600 * 1024));
            expect(await sniffVideoCodec(mp4WithCodec("avc1", mdat))).toEqual("h264");
        });

        it("returns undefined for a container it cannot parse", async () => {
            const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "clip.avi", { type: "video/x-msvideo" });
            expect(await sniffVideoCodec(file)).toBeUndefined();
        });

        it("returns undefined rather than throwing on a truncated mp4", async () => {
            const file = new File([concat(box("ftyp", ascii("isom")), ascii("moov"))], "clip.mp4", {
                type: "video/mp4",
            });
            expect(await sniffVideoCodec(file)).toBeUndefined();
        });
    });
});
