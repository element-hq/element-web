/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canStripFileMetadata, stripFileMetadata } from "./stripFileMetadata";
import { MetadataStripError } from "./MetadataStripError";
import { COLOR_SPACE_TAG, INTEROP_INDEX_TAG, ORIENTATION_TAG, readExifDisplayFields } from "./exif";
import { bytesEqual, concatBytes, crc32, dataView, readAscii } from "./bytes";

/*
 * The fixtures were made with ImageMagick, ffmpeg, heif-enc and avifenc, then tagged with exiftool so that each
 * holds a location, device and author, all of whose text values start with "Leaky". For example:
 *
 *   exiftool -GPSLatitude=51.5007 -GPSLatitudeRef=N -Make=LeakyMake -Orientation#=6 \
 *       -XMP:Creator=LeakyAuthor -IPTC:City=LeakyCity -Comment=LeakyComment "-ThumbnailImage<=thumb.jpg" photo.jpg
 *
 * photo-clean.jpg is photo.jpg before it was tagged.
 */
const fixturesDir = fileURLToPath(import.meta.resolve("../../../test/unit-tests/images"));

function fixture(name: string, type: string): File {
    return new File([fs.readFileSync(path.join(fixturesDir, name))], name, { type, lastModified: 1234 });
}

async function bytesOf(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await blob.arrayBuffer());
}

/** Encodes a string with one byte per character, unlike `File` which would encode it as UTF-8. */
function latin1(text: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(Buffer.from(text, "latin1"));
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
    return Buffer.from(bytes).includes(text, 0, "latin1");
}

/** Lists the segments of a JPEG up to its first scan as [marker, payload] pairs. */
function jpegSegments(bytes: Uint8Array): [number, Uint8Array][] {
    const segments: [number, Uint8Array][] = [];
    let offset = 2;
    while (bytes[offset + 1] !== 0xda) {
        const length = dataView(bytes).getUint16(offset + 2);
        segments.push([bytes[offset + 1], bytes.subarray(offset + 4, offset + 2 + length)]);
        offset += 2 + length;
    }
    return segments;
}

/** Builds a JPEG segment. */
function jpegSegment(marker: number, payload: string | Uint8Array): Uint8Array<ArrayBuffer> {
    const data = typeof payload === "string" ? Buffer.from(payload, "latin1") : payload;
    const header = new Uint8Array(4);
    dataView(header).setUint16(0, 0xff00 | marker);
    dataView(header).setUint16(2, data.length + 2);
    return concatBytes(header, data);
}

/** Inserts segments straight after the SOI marker of a JPEG. */
function withSegments(jpeg: Uint8Array, ...segments: Uint8Array[]): Uint8Array<ArrayBuffer> {
    return concatBytes(jpeg.subarray(0, 2), ...segments, jpeg.subarray(2));
}

/** Inserts segments straight after the JFIF header of photo-clean.jpg, which is where stripping puts them. */
function afterJfif(jpeg: Uint8Array, ...segments: Uint8Array[]): Uint8Array<ArrayBuffer> {
    return concatBytes(jpeg.subarray(0, 20), ...segments, jpeg.subarray(20));
}

/** Builds a big-endian TIFF structure whose IFD0 holds a single ASCII Make tag. */
function tiffWithMake(make: string): Uint8Array<ArrayBuffer> {
    const value = latin1(make.padEnd(4, "\0").slice(0, 4));
    const tiff = new Uint8Array(8 + 2 + 12 + 4);
    const view = dataView(tiff);
    view.setUint16(0, 0x4d4d);
    view.setUint16(2, 42);
    view.setUint32(4, 8);
    view.setUint16(8, 1);
    view.setUint16(10, 0x010f); // Make
    view.setUint16(12, 2); // ASCII
    view.setUint32(14, 4);
    tiff.set(value, 18);
    return tiff;
}

/** Lists the chunk types of a PNG. */
function pngChunks(bytes: Uint8Array): string[] {
    const chunks: string[] = [];
    for (let offset = 8; offset < bytes.length; offset += 12 + dataView(bytes).getUint32(offset)) {
        chunks.push(readAscii(bytes, offset + 4, 4));
    }
    return chunks;
}

describe("stripFileMetadata", () => {
    describe("JPEG", () => {
        it("removes Exif, XMP, IPTC and comments but keeps the orientation and colour space", async () => {
            const file = fixture("photo.jpg", "image/jpeg");
            const stripped = await stripFileMetadata(file);
            const bytes = await bytesOf(stripped);

            expect(containsAscii(bytes, "Leaky")).toBe(false);
            expect(containsAscii(bytes, "SN123456")).toBe(false);

            // The only metadata left is an Exif block holding the display fields, after the JFIF header.
            const segments = jpegSegments(bytes);
            expect(segments.map(([marker]) => marker)).toEqual([0xe0, 0xe1, 0xdb, 0xdb, 0xc0, 0xc4, 0xc4, 0xc4, 0xc4]);
            const fields = readExifDisplayFields(segments[1][1].subarray(6));
            expect(fields.ifd0.get(ORIENTATION_TAG)).toBe(6);
            expect(fields.exif.get(COLOR_SPACE_TAG)).toBe(0xffff);

            // Everything else is exactly as it was before the photo was tagged.
            const exifLength = 2 + dataView(bytes).getUint16(22);
            const withoutExif = concatBytes(bytes.subarray(0, 20), bytes.subarray(20 + exifLength));
            expect(withoutExif).toEqual(await bytesOf(fixture("photo-clean.jpg", "image/jpeg")));
        });

        it("keeps the name, type and modification time", async () => {
            const stripped = await stripFileMetadata(fixture("photo.jpg", "image/jpeg"));
            expect(stripped.name).toBe("photo.jpg");
            expect(stripped.type).toBe("image/jpeg");
            expect(stripped.lastModified).toBe(1234);
        });

        it("returns the same file when there is no metadata", async () => {
            const file = fixture("photo-clean.jpg", "image/jpeg");
            await expect(stripFileMetadata(file)).resolves.toBe(file);
        });

        it("returns the same file when stripping a second time", async () => {
            const once = await stripFileMetadata(fixture("photo.jpg", "image/jpeg"));
            await expect(stripFileMetadata(once)).resolves.toBe(once);
        });

        it("drops an Exif block which holds nothing that affects display", async () => {
            const clean = await bytesOf(fixture("photo-clean.jpg", "image/jpeg"));
            const exif = jpegSegment(0xe1, concatBytes(latin1("Exif\0\0"), tiffWithMake("Lky")));
            const file = new File([afterJfif(clean, exif)], "a.jpg", { type: "image/jpeg" });

            expect(await bytesOf(await stripFileMetadata(file))).toEqual(clean);
        });

        it("keeps the interoperability index which marks Adobe RGB", async () => {
            const stripped = await stripFileMetadata(fixture("photo.jpg", "image/jpeg"));
            const exif = jpegSegments(await bytesOf(stripped)).find(([marker]) => marker === 0xe1)!;
            const fields = readExifDisplayFields(exif[1].subarray(6));

            expect(fields.exif.get(COLOR_SPACE_TAG)).toBe(0xffff);
            expect(fields.interop.get(INTEROP_INDEX_TAG)).toEqual(latin1("R03\0"));
        });

        it("keeps colour profiles and the Adobe colour transform", async () => {
            const clean = await bytesOf(fixture("photo-clean.jpg", "image/jpeg"));
            const icc = jpegSegment(0xe2, "ICC_PROFILE\0\x01\x01fake-profile");
            const adobe = jpegSegment(0xee, "Adobe\0\x64\0\0\0\0\x01");
            const file = new File([afterJfif(clean, icc, adobe)], "a.jpg", { type: "image/jpeg" });

            await expect(stripFileMetadata(file)).resolves.toBe(file);
        });

        it("moves the JFIF header back to the start", async () => {
            const clean = await bytesOf(fixture("photo-clean.jpg", "image/jpeg"));
            const icc = jpegSegment(0xe2, "ICC_PROFILE\0\x01\x01fake-profile");
            const file = new File([withSegments(clean, icc)], "a.jpg", { type: "image/jpeg" });

            expect(await bytesOf(await stripFileMetadata(file))).toEqual(afterJfif(clean, icc));
        });

        it("removes the JFIF thumbnail and JFXX extension", async () => {
            const clean = await bytesOf(fixture("photo-clean.jpg", "image/jpeg"));
            const jfif = clean.subarray(2, 20);
            const thumbnail = new Uint8Array([1, 1, 0xaa, 0xbb, 0xcc]);
            const jfifWithThumbnail = jpegSegment(0xe0, concatBytes(jfif.subarray(4, 16), thumbnail));
            const jfxx = jpegSegment(0xe0, "JFXX\0\x10LeakyThumbnail");
            const file = new File(
                [concatBytes(clean.subarray(0, 2), jfifWithThumbnail, jfxx, clean.subarray(20))],
                "a.jpg",
                {
                    type: "image/jpeg",
                },
            );

            expect(await bytesOf(await stripFileMetadata(file))).toEqual(clean);
        });

        it("removes data after the end of the image which is not in a multi-picture index", async () => {
            const clean = await bytesOf(fixture("photo-clean.jpg", "image/jpeg"));
            const file = new File([clean, latin1("\xff\xd8LeakyGainMap\xff\xd9")], "a.jpg", { type: "image/jpeg" });

            expect(await bytesOf(await stripFileMetadata(file))).toEqual(clean);
        });

        it("rejects a file which is not a JPEG", async () => {
            const file = new File(["not a jpeg"], "a.jpg", { type: "image/jpeg" });
            await expect(stripFileMetadata(file)).rejects.toBeInstanceOf(MetadataStripError);
        });

        it("rejects a segment which runs past the end of the file", async () => {
            const bytes = await bytesOf(fixture("photo.jpg", "image/jpeg"));
            const file = new File([bytes.subarray(0, 100)], "a.jpg", { type: "image/jpeg" });
            await expect(stripFileMetadata(file)).rejects.toBeInstanceOf(MetadataStripError);
        });
    });

    describe("PNG", () => {
        it("removes text, time and Exif chunks but keeps the display fields", async () => {
            const stripped = await stripFileMetadata(fixture("photo.png", "image/png"));
            const bytes = await bytesOf(stripped);

            expect(containsAscii(bytes, "Leaky")).toBe(false);
            const chunks = pngChunks(bytes);
            expect(chunks).not.toEqual(expect.arrayContaining(["tEXt"]));
            expect(chunks).not.toEqual(expect.arrayContaining(["iTXt"]));
            expect(chunks).not.toEqual(expect.arrayContaining(["zTXt"]));
            expect(chunks).not.toEqual(expect.arrayContaining(["tIME"]));
            expect(chunks.slice(0, 2)).toEqual(["IHDR", "eXIf"]);
            expect(chunks.at(-1)).toBe("IEND");

            const exifLength = dataView(bytes).getUint32(33);
            const exifChunk = bytes.subarray(37, 37 + 4 + exifLength);
            expect(dataView(bytes).getUint32(37 + 4 + exifLength)).toBe(crc32(exifChunk));
            expect(readExifDisplayFields(exifChunk.subarray(4)).ifd0.get(ORIENTATION_TAG)).toBe(6);

            await expect(stripFileMetadata(stripped)).resolves.toBe(stripped);
        });

        it("keeps ancillary chunks that affect rendering", async () => {
            const bytes = await bytesOf(await stripFileMetadata(fixture("photo.png", "image/png")));
            const original = pngChunks(await bytesOf(fixture("photo.png", "image/png")));
            const kept = ["gAMA", "cHRM", "bKGD", "pHYs", "PLTE", "tRNS", "sRGB", "iCCP"].filter((chunk) =>
                original.includes(chunk),
            );
            expect(pngChunks(bytes)).toEqual(expect.arrayContaining(kept));
        });

        it("handles chunks which straddle or are larger than a read", async () => {
            const original = await bytesOf(fixture("photo.png", "image/png"));
            const chunk = (type: string, length: number): Uint8Array<ArrayBuffer> => {
                const bytes = new Uint8Array(12 + length).fill(0xaa);
                dataView(bytes).setUint32(0, length);
                bytes.set(latin1(type), 4);
                return bytes;
            };
            const ihdr = original.subarray(0, 33);
            const idat1 = chunk("IDAT", 65536 - 33 - 4 - 12);
            const idat2 = chunk("IDAT", 200_000);
            const file = new File(
                [ihdr, idat1, chunk("tEXt", 10), idat2, chunk("tIME", 7), chunk("IEND", 0)],
                "a.png",
                { type: "image/png" },
            );

            const bytes = await bytesOf(await stripFileMetadata(file));
            expect(pngChunks(bytes)).toEqual(["IHDR", "IDAT", "IDAT", "IEND"]);
            // Compared with bytesEqual as toEqual is slow on arrays this size.
            expect(bytesEqual(bytes, concatBytes(ihdr, idat1, idat2, chunk("IEND", 0)))).toBe(true);
        });

        it("rejects a chunk which runs past the end of the file", async () => {
            const bytes = await bytesOf(fixture("photo.png", "image/png"));
            const file = new File([bytes.subarray(0, 100)], "a.png", { type: "image/png" });
            await expect(stripFileMetadata(file)).rejects.toBeInstanceOf(MetadataStripError);
        });

        it("rejects a file which is not a PNG", async () => {
            const file = new File(["not a png"], "a.png", { type: "image/png" });
            await expect(stripFileMetadata(file)).rejects.toBeInstanceOf(MetadataStripError);
        });
    });

    it("returns files of other types unchanged", async () => {
        const file = new File(["LeakyText"], "notes.txt", { type: "text/plain" });
        await expect(stripFileMetadata(file)).resolves.toBe(file);
    });

    it("picks the format from the MIME type regardless of case", async () => {
        const stripped = await stripFileMetadata(
            new File([fs.readFileSync(path.join(fixturesDir, "photo.jpg"))], "a.JPG", { type: "IMAGE/JPEG" }),
        );
        expect(containsAscii(await bytesOf(stripped), "Leaky")).toBe(false);
    });

    it("wraps unexpected errors in a MetadataStripError", async () => {
        const file = fixture("photo.jpg", "image/jpeg");
        vi.spyOn(file, "arrayBuffer").mockRejectedValue(new TypeError("The file could not be read"));

        await expect(stripFileMetadata(file)).rejects.toBeInstanceOf(MetadataStripError);
    });
});

describe("canStripFileMetadata", () => {
    it.each(["image/jpeg", "image/png", "image/apng", "IMAGE/JPEG"])("supports %s", (type) => {
        expect(canStripFileMetadata(type)).toBe(true);
    });

    it.each([
        "text/plain",
        "application/pdf",
        "video/mp4",
        "audio/mpeg",
        "image/svg+xml",
        "image/tiff",
        "image/heic",
        "image/avif",
        "image/bmp",
        "image/webp",
        "image/gif",
        "image/jxl",
        "image/x-icon",
        "",
        "constructor",
    ])("does not support %s", (type) => {
        expect(canStripFileMetadata(type)).toBe(false);
    });
});
