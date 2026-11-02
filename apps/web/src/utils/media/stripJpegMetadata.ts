/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    assembleFile,
    bytesEqual,
    concatBytes,
    dataView,
    type FilePart,
    readAll,
    startsWith,
    writeAscii,
} from "./bytes";
import {
    buildExif,
    emptyExifFields,
    type ExifDisplayFields,
    readExifDisplayFields,
    TYPE_LONG,
    TYPE_UNDEFINED,
} from "./exif";
import { MetadataStripError } from "./MetadataStripError";
import { buildGainMapXmp, hasGainMapXmp } from "./xmp";

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP14 = 0xee;
const COM = 0xfe;

const EXIF_PREFIX = "Exif\0\0";
const XMP_PREFIX = "http://ns.adobe.com/xap/1.0/\0";
const ICC_PREFIX = "ICC_PROFILE\0";
const MPF_PREFIX = "MPF\0";
/** ISO 21496-1 gain map metadata, which says how to combine a gain map with the primary image. */
const ISO_GAIN_MAP_PREFIX = "urn:iso:std:iso:ts:21496:-1\0";

/** The segment length of a JFIF header with no embedded thumbnail. */
const JFIF_LENGTH = 16;

const MP_VERSION_TAG = 0xb000;
const MP_NUMBER_OF_IMAGES_TAG = 0xb001;
const MP_ENTRY_TAG = 0xb002;
const MP_ENTRY_LENGTH = 16;

/** A marker segment, scan or standalone marker, as a byte range. */
interface Segment {
    marker: number;
    start: number;
    end: number;
}

/** What to do with a segment. */
type SegmentRole = "keep" | "drop" | "jfif" | "exif" | "xmp" | "mpf";

/** Markers which are not followed by a length: TEM and RST0-7. */
function isStandaloneMarker(marker: number): boolean {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/**
 * Finds the end of the entropy-coded data which follows a start-of-scan header, i.e. the offset of the next
 * marker. Inside the data a 0xFF byte is always followed by a zero byte or a restart marker.
 */
function findEndOfScan(bytes: Uint8Array, offset: number): number {
    while (true) {
        offset = bytes.indexOf(0xff, offset);
        if (offset === -1 || offset + 1 >= bytes.length) return bytes.length;
        const next = bytes[offset + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            offset += 2;
        } else if (next === 0xff) {
            offset++; // fill byte before a marker
        } else {
            return offset;
        }
    }
}

/**
 * Splits a JPEG image into its segments, from its start-of-image marker to its end-of-image marker.
 *
 * @param bytes - the buffer holding the image
 * @param start - offset of the start-of-image marker
 * @returns the segments after the start-of-image marker, including the end-of-image marker if present
 */
function readSegments(bytes: Uint8Array, start: number): Segment[] {
    const view = dataView(bytes);
    if (start + 4 > bytes.length || view.getUint16(start) !== (0xff00 | SOI)) {
        throw new MetadataStripError(`Expected a JPEG at ${start}`);
    }

    const segments: Segment[] = [];
    let offset = start + 2;
    // A file cut off within its scan data still renders, so treat the end of the file as the end.
    while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) throw new MetadataStripError(`Expected marker at ${offset}`);
        while (bytes[offset + 1] === 0xff) offset++; // skip fill bytes
        if (offset + 1 >= bytes.length) throw new MetadataStripError("Unexpected end of file");
        const marker = bytes[offset + 1];

        if (marker === EOI || isStandaloneMarker(marker)) {
            segments.push({ marker, start: offset, end: offset + 2 });
            offset += 2;
            if (marker === EOI) break;
            continue;
        }

        if (offset + 4 > bytes.length) throw new MetadataStripError("Unexpected end of file");
        const length = view.getUint16(offset + 2);
        let end = offset + 2 + length;
        if (length < 2 || end > bytes.length) throw new MetadataStripError(`Bad segment length at ${offset}`);
        if (marker === SOS) end = findEndOfScan(bytes, end);
        segments.push({ marker, start: offset, end });
        offset = end;
    }
    return segments;
}

/**
 * Decides what to do with a segment. Keeps the segments needed to decode, colour and tone-map the image:
 * JFIF (without its thumbnail), ICC profiles, the Adobe colour transform, ISO gain map metadata, tables,
 * frames and scans. Exif and XMP are rebuilt from the parts that matter for display. The multi-picture index
 * is rebuilt for the primary image. Everything else, such as IPTC, comments and other application data, is
 * dropped.
 */
function segmentRole(bytes: Uint8Array, segment: Segment, isPrimary: boolean): SegmentRole {
    const payload = segment.start + 4;
    switch (segment.marker) {
        case APP0:
            return startsWith(bytes, "JFIF\0", payload) ? "jfif" : "drop";
        case APP1:
            if (startsWith(bytes, EXIF_PREFIX, payload)) return "exif";
            if (startsWith(bytes, XMP_PREFIX, payload)) return "xmp";
            return "drop";
        case APP2:
            if (startsWith(bytes, ICC_PREFIX, payload) || startsWith(bytes, ISO_GAIN_MAP_PREFIX, payload)) {
                return "keep";
            }
            if (isPrimary && startsWith(bytes, MPF_PREFIX, payload)) return "mpf";
            return "drop";
        case APP14:
            return "keep";
        case COM:
            return "drop";
        default:
            return segment.marker >= APP0 && segment.marker <= 0xef ? "drop" : "keep";
    }
}

/** Builds a marker segment from its payload. */
function buildSegment(marker: number, ...payload: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const body = concatBytes(...payload);
    if (body.length + 2 > 0xffff) throw new MetadataStripError("Segment too large");
    const header = new Uint8Array(4);
    dataView(header).setUint16(0, 0xff00 | marker);
    dataView(header).setUint16(2, body.length + 2);
    return concatBytes(header, body);
}

function ascii(value: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(value.length);
    writeAscii(bytes, 0, value);
    return bytes;
}

/** An image listed in the multi-picture index. */
interface MpEntry {
    /** Flags saying what kind of image this is. */
    attributes: number;
    size: number;
    /** Offset from the start of the index's TIFF header, or 0 for the primary image. */
    offset: number;
    dependentImages: [number, number];
}

/**
 * Reads the images listed in a multi-picture (MPF) segment.
 *
 * @returns the entries, and the offset of the TIFF header which their offsets are relative to
 */
function readMpEntries(bytes: Uint8Array, segment: Segment): { entries: MpEntry[]; base: number } {
    const view = dataView(bytes);
    const base = segment.start + 4 + MPF_PREFIX.length;
    const littleEndian = view.getUint16(base) === 0x4949;
    const ifd = base + view.getUint32(base + 4, littleEndian);
    const count = view.getUint16(ifd, littleEndian);
    for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (view.getUint16(entry, littleEndian) !== MP_ENTRY_TAG) continue;
        const length = view.getUint32(entry + 4, littleEndian);
        const values = base + view.getUint32(entry + 8, littleEndian);
        if (length % MP_ENTRY_LENGTH !== 0 || values + length > segment.end) {
            throw new MetadataStripError("Bad MP entries");
        }
        const entries: MpEntry[] = [];
        for (let offset = values; offset < values + length; offset += MP_ENTRY_LENGTH) {
            entries.push({
                attributes: view.getUint32(offset, littleEndian),
                size: view.getUint32(offset + 4, littleEndian),
                offset: view.getUint32(offset + 8, littleEndian),
                dependentImages: [view.getUint16(offset + 12, littleEndian), view.getUint16(offset + 14, littleEndian)],
            });
        }
        return { entries, base };
    }
    throw new MetadataStripError("MPF without MP entries");
}

/** Builds an MPF segment listing `count` images, whose entries are filled in by {@link writeMpEntries}. */
function buildMpfSegment(count: number): Uint8Array<ArrayBuffer> {
    const ifdLength = 2 + 3 * 12 + 4;
    const tiff = new Uint8Array(8 + ifdLength + count * MP_ENTRY_LENGTH);
    const view = dataView(tiff);
    view.setUint16(0, 0x4d4d); // big-endian
    view.setUint16(2, 42);
    view.setUint32(4, 8);
    view.setUint16(8, 3);
    const entries: [number, number, number, number][] = [
        [MP_VERSION_TAG, TYPE_UNDEFINED, 4, 0x30313030], // "0100"
        [MP_NUMBER_OF_IMAGES_TAG, TYPE_LONG, 1, count],
        [MP_ENTRY_TAG, TYPE_UNDEFINED, count * MP_ENTRY_LENGTH, 8 + ifdLength],
    ];
    entries.forEach(([tag, type, length, value], i) => {
        const entry = 10 + i * 12;
        view.setUint16(entry, tag);
        view.setUint16(entry + 2, type);
        view.setUint32(entry + 4, length);
        view.setUint32(entry + 8, value);
    });
    return buildSegment(APP2, ascii(MPF_PREFIX), tiff);
}

/** Fills in the entries of an MPF segment built by {@link buildMpfSegment}. */
function writeMpEntries(segment: Uint8Array, entries: MpEntry[]): void {
    const view = dataView(segment);
    const values = 4 + MPF_PREFIX.length + 8 + 2 + 3 * 12 + 4;
    entries.forEach((entry, i) => {
        const offset = values + i * MP_ENTRY_LENGTH;
        view.setUint32(offset, entry.attributes);
        view.setUint32(offset + 4, entry.size);
        view.setUint32(offset + 8, entry.offset);
        view.setUint16(offset + 12, entry.dependentImages[0]);
        view.setUint16(offset + 14, entry.dependentImages[1]);
    });
}

/** The metadata of an image which is rebuilt rather than copied. */
interface ImageMetadata {
    /** Offset of the start-of-image marker. */
    start: number;
    segments: Segment[];
    roles: SegmentRole[];
    exif: ExifDisplayFields;
    /** The XMP packet, if it holds HDR gain map properties. */
    gainMapXmp?: string;
    mpf?: Segment;
}

function readImageMetadata(bytes: Uint8Array, start: number, isPrimary: boolean): ImageMetadata {
    const segments = readSegments(bytes, start);
    const roles = segments.map((segment) => segmentRole(bytes, segment, isPrimary));
    const metadata: ImageMetadata = { start, segments, roles, exif: emptyExifFields() };
    let seenExif = false;
    let seenXmp = false;
    segments.forEach((segment, i) => {
        if (roles[i] === "exif" && !seenExif) {
            seenExif = true;
            metadata.exif = readExifDisplayFields(bytes.subarray(segment.start + 4 + EXIF_PREFIX.length, segment.end));
        } else if (roles[i] === "xmp" && !seenXmp) {
            seenXmp = true;
            const xmp = new TextDecoder().decode(bytes.subarray(segment.start + 4 + XMP_PREFIX.length, segment.end));
            if (hasGainMapXmp(xmp)) metadata.gainMapXmp = xmp;
        } else if (roles[i] === "mpf" && !metadata.mpf) {
            metadata.mpf = segment;
        }
    });
    return metadata;
}

/** The total length of some byte arrays. */
function totalLength(parts: Uint8Array[]): number {
    return parts.reduce((total, part) => total + part.length, 0);
}

/**
 * Assembles an image from its kept segments and the rebuilt metadata segments, which go straight after the
 * JFIF header (or the start-of-image marker if there is none). Kept segments are views of `bytes` rather than
 * copies, so that {@link toFileParts} can swap them for slices of the original file.
 */
function assembleImage(
    bytes: Uint8Array<ArrayBuffer>,
    metadata: ImageMetadata,
    rebuilt: Uint8Array<ArrayBuffer>[],
): { parts: Uint8Array<ArrayBuffer>[]; rebuiltIndex: number } {
    const parts: Uint8Array<ArrayBuffer>[] = [bytes.subarray(metadata.start, metadata.start + 2)];
    const rest: Uint8Array<ArrayBuffer>[] = [];
    metadata.segments.forEach((segment, i) => {
        const role = metadata.roles[i];
        if (role === "keep") {
            rest.push(bytes.subarray(segment.start, segment.end));
        } else if (role === "jfif" && parts.length === 1) {
            if (segment.end - segment.start > 2 + JFIF_LENGTH) {
                // Keep the header but drop the embedded thumbnail by setting its dimensions to zero.
                const header = bytes.slice(segment.start, segment.start + 2 + JFIF_LENGTH);
                dataView(header).setUint16(2, JFIF_LENGTH);
                header[JFIF_LENGTH] = 0;
                header[JFIF_LENGTH + 1] = 0;
                parts.push(header);
            } else {
                parts.push(bytes.subarray(segment.start, segment.end));
            }
        }
    });
    return { parts: [...parts, ...rebuilt, ...rest], rebuiltIndex: parts.length };
}

/** Builds the Exif segment for an image, if it has display fields to keep. */
function buildExifSegment(fields: ExifDisplayFields): Uint8Array<ArrayBuffer> | undefined {
    const tiff = buildExif(fields);
    return tiff && buildSegment(APP1, ascii(EXIF_PREFIX), tiff);
}

/** Builds the XMP segment holding only an image's gain map properties, if it has any. */
function buildXmpSegment(xmp: string | undefined, itemLengths?: number[]): Uint8Array<ArrayBuffer> | undefined {
    const packet = xmp && buildGainMapXmp(xmp, itemLengths);
    return packet ? buildSegment(APP1, ascii(XMP_PREFIX), new TextEncoder().encode(packet)) : undefined;
}

/**
 * Strips an image appended to the primary image, such as an HDR gain map.
 *
 * @returns the parts of the stripped image, as from {@link assembleImage}
 */
function stripSecondaryImage(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>[] {
    const metadata = readImageMetadata(bytes, 0, false);
    const rebuilt = [buildExifSegment(metadata.exif), buildXmpSegment(metadata.gainMapXmp)].filter(
        (segment) => segment !== undefined,
    );
    return assembleImage(bytes, metadata, rebuilt).parts;
}

/** The images listed in a multi-picture index, after stripping. */
interface StrippedImages {
    primaryEntry: MpEntry;
    secondaries: { entry: MpEntry; parts: Uint8Array<ArrayBuffer>[]; length: number }[];
}

/**
 * Strips the images listed in the primary image's multi-picture index, such as an HDR gain map.
 *
 * @returns the stripped images with their index entries, or undefined if the index can't be followed, in
 *     which case the images are dropped and the photo loses its HDR rendition
 */
function stripSecondaryImages(bytes: Uint8Array<ArrayBuffer>, mpf: Segment): StrippedImages | undefined {
    try {
        const { entries, base } = readMpEntries(bytes, mpf);
        if (entries.length < 2) return undefined;
        const secondaries = entries.slice(1).map((entry) => {
            const start = base + entry.offset;
            if (entry.offset === 0 || start + entry.size > bytes.length) {
                throw new MetadataStripError("MP entry outside the file");
            }
            const parts = stripSecondaryImage(bytes.subarray(start, start + entry.size));
            return { entry, parts, length: totalLength(parts) };
        });
        return { primaryEntry: entries[0], secondaries };
    } catch {
        return undefined;
    }
}

/** The offset in `bytes` which `part` is a view of, or undefined if `part` holds new data. */
function viewOffset(bytes: Uint8Array, part: Uint8Array): number | undefined {
    return part.buffer === bytes.buffer ? part.byteOffset - bytes.byteOffset : undefined;
}

/**
 * Whether the output parts add up to exactly the original bytes. Views of the original only need their
 * position checking, so only new data is compared byte by byte.
 */
function isUnchanged(bytes: Uint8Array, parts: Uint8Array[]): boolean {
    let offset = 0;
    for (const part of parts) {
        const source = viewOffset(bytes, part);
        const matches =
            source === undefined ? bytesEqual(part, bytes.subarray(offset, offset + part.length)) : source === offset;
        if (!matches) return false;
        offset += part.length;
    }
    return offset === bytes.length;
}

/**
 * Converts the output parts into parts of a new file. Runs of views of the original bytes become slices of the
 * original file, so the image data is not copied.
 */
function toFileParts(file: File, bytes: Uint8Array, parts: Uint8Array<ArrayBuffer>[]): FilePart[] {
    const fileParts: FilePart[] = [];
    let run: { start: number; end: number } | undefined;
    for (const part of parts) {
        const start = viewOffset(bytes, part);
        if (start !== undefined && run?.end === start) {
            run.end += part.length;
            continue;
        }
        if (run) fileParts.push(file.slice(run.start, run.end));
        if (start === undefined) {
            run = undefined;
            fileParts.push(part);
        } else {
            run = { start, end: start + part.length };
        }
    }
    if (run) fileParts.push(file.slice(run.start, run.end));
    return fileParts;
}

/**
 * Removes metadata from a JPEG without re-encoding it.
 *
 * Exif is replaced by a new block holding only the fields which affect display (orientation and colour
 * space). XMP is dropped unless it holds HDR gain map properties, in which case only those are kept. Images
 * appended to the primary image and listed in its multi-picture index, such as HDR gain maps, are kept and
 * stripped in the same way, and the index is rebuilt to match. Anything else after the end of the image is
 * dropped.
 *
 * @param file - the JPEG
 * @returns the stripped file, or `file` itself if it held no metadata
 */
export async function stripJpegMetadata(file: File): Promise<File> {
    const bytes = await readAll(file);
    const metadata = readImageMetadata(bytes, 0, true);
    const images = metadata.mpf ? stripSecondaryImages(bytes, metadata.mpf) : undefined;
    const secondaries = images?.secondaries ?? [];

    // The container directory in the XMP lists the appended images, so only keep it if they are kept.
    const rebuilt = [
        buildExifSegment(metadata.exif),
        secondaries.length > 0
            ? buildXmpSegment(
                  metadata.gainMapXmp,
                  secondaries.map(({ length }) => length),
              )
            : undefined,
    ].filter((segment) => segment !== undefined);
    const mpf = images ? buildMpfSegment(secondaries.length + 1) : undefined;
    if (mpf) rebuilt.push(mpf);

    const { parts, rebuiltIndex } = assembleImage(bytes, metadata, rebuilt);
    const primaryLength = totalLength(parts);

    if (mpf && images) {
        // Offsets in the index are relative to its TIFF header.
        const mpfStart = totalLength(parts.slice(0, rebuiltIndex + rebuilt.indexOf(mpf)));
        const base = mpfStart + 4 + MPF_PREFIX.length;
        let offset = primaryLength;
        writeMpEntries(mpf, [
            { ...images.primaryEntry, size: primaryLength, offset: 0 },
            ...secondaries.map(({ entry, length }) => {
                const updated = { ...entry, size: length, offset: offset - base };
                offset += length;
                return updated;
            }),
        ]);
    }

    const output = [...parts, ...secondaries.flatMap((image) => image.parts)];
    return isUnchanged(bytes, output) ? file : assembleFile(file, toFileParts(file, bytes, output));
}
