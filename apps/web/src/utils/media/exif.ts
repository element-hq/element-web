/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dataView } from "./bytes";

/** TIFF field types used by the tags we keep. */
export const TYPE_ASCII = 2;
export const TYPE_SHORT = 3;
export const TYPE_LONG = 4;
export const TYPE_UNDEFINED = 7;

export const ORIENTATION_TAG = 0x0112;
export const YCBCR_POSITIONING_TAG = 0x0213;
export const EXIF_IFD_TAG = 0x8769;
export const EXIF_VERSION_TAG = 0x9000;
export const COMPONENTS_CONFIGURATION_TAG = 0x9101;
export const FLASHPIX_VERSION_TAG = 0xa000;
export const COLOR_SPACE_TAG = 0xa001;
export const INTEROP_IFD_TAG = 0xa005;
export const INTEROP_INDEX_TAG = 0x0001;
export const INTEROP_VERSION_TAG = 0x0002;

/** A tag to keep, with the type and count its value must have. Every kept value fits in four bytes. */
interface KeptTag {
    tag: number;
    type: number;
    count: number;
}

/**
 * Tags which affect how an image is displayed, or which the Exif standard requires, and which say nothing
 * about the photo's origin. Everything else is dropped.
 */
const KEPT_IFD0_TAGS: KeptTag[] = [
    { tag: ORIENTATION_TAG, type: TYPE_SHORT, count: 1 },
    { tag: YCBCR_POSITIONING_TAG, type: TYPE_SHORT, count: 1 },
];
const KEPT_EXIF_TAGS: KeptTag[] = [
    { tag: EXIF_VERSION_TAG, type: TYPE_UNDEFINED, count: 4 },
    { tag: COMPONENTS_CONFIGURATION_TAG, type: TYPE_UNDEFINED, count: 4 },
    { tag: FLASHPIX_VERSION_TAG, type: TYPE_UNDEFINED, count: 4 },
    // 1 for sRGB, or 0xFFFF for uncalibrated, which with the interop index "R03" means Adobe RGB.
    { tag: COLOR_SPACE_TAG, type: TYPE_SHORT, count: 1 },
];
const KEPT_INTEROP_TAGS: KeptTag[] = [
    // The rule the file follows, such as "R98" (sRGB) or "R03" (Adobe RGB).
    { tag: INTEROP_INDEX_TAG, type: TYPE_ASCII, count: 4 },
    { tag: INTEROP_VERSION_TAG, type: TYPE_UNDEFINED, count: 4 },
];

/** A kept value: a SHORT as a number, or the raw bytes of an ASCII or UNDEFINED value. */
type ExifValue = number | Uint8Array;

/** The kept values of each IFD of an Exif block, keyed by tag. */
export interface ExifDisplayFields {
    ifd0: Map<number, ExifValue>;
    exif: Map<number, ExifValue>;
    interop: Map<number, ExifValue>;
}

/** Fields for an image with no Exif block. */
export function emptyExifFields(): ExifDisplayFields {
    return { ifd0: new Map(), exif: new Map(), interop: new Map() };
}

/**
 * Reads the kept tags of an IFD into `values`.
 *
 * @returns the offsets of the sub-IFDs the IFD points to, keyed by tag
 */
function readIfd(
    tiff: Uint8Array,
    offset: number,
    littleEndian: boolean,
    kept: KeptTag[],
    values: Map<number, ExifValue>,
): Map<number, number> {
    const view = dataView(tiff);
    const pointers = new Map<number, number>();
    const count = view.getUint16(offset, littleEndian);
    for (let i = 0; i < count; i++) {
        const entry = offset + 2 + i * 12;
        const tag = view.getUint16(entry, littleEndian);
        const type = view.getUint16(entry + 2, littleEndian);
        const length = view.getUint32(entry + 4, littleEndian);
        if ((tag === EXIF_IFD_TAG || tag === INTEROP_IFD_TAG) && type === TYPE_LONG && length === 1) {
            pointers.set(tag, view.getUint32(entry + 8, littleEndian));
            continue;
        }
        const spec = kept.find((k) => k.tag === tag);
        if (!spec || spec.type !== type || spec.count !== length) continue;
        values.set(
            tag,
            type === TYPE_SHORT ? view.getUint16(entry + 8, littleEndian) : tiff.slice(entry + 8, entry + 12),
        );
    }
    return pointers;
}

/**
 * Reads the kept fields from a TIFF structure, which is what an Exif block holds after its optional
 * `Exif\0\0` prefix.
 *
 * @param tiff - the TIFF structure
 * @returns whichever fields could be read; a malformed block yields fewer or none
 */
export function readExifDisplayFields(tiff: Uint8Array): ExifDisplayFields {
    const fields = emptyExifFields();
    try {
        const view = dataView(tiff);
        const byteOrder = view.getUint16(0);
        if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return fields;
        const littleEndian = byteOrder === 0x4949;
        if (view.getUint16(2, littleEndian) !== 42) return fields;

        const ifd0 = view.getUint32(4, littleEndian);
        const exif = readIfd(tiff, ifd0, littleEndian, KEPT_IFD0_TAGS, fields.ifd0).get(EXIF_IFD_TAG);
        if (exif === undefined) return fields;
        const interop = readIfd(tiff, exif, littleEndian, KEPT_EXIF_TAGS, fields.exif).get(INTEROP_IFD_TAG);
        if (interop === undefined) return fields;
        readIfd(tiff, interop, littleEndian, KEPT_INTEROP_TAGS, fields.interop);
    } catch {
        // A malformed Exif block is dropped anyway, so losing some of its fields is the only consequence.
    }
    return fields;
}

/** An entry to write: a value, or a pointer to another IFD. */
type Entry = [tag: number, type: number, value: ExifValue];

/** Lists the kept values of an IFD as entries, in the order of `kept`, which is sorted by tag. */
function entriesOf(values: Map<number, ExifValue>, kept: KeptTag[]): Entry[] {
    return kept.filter(({ tag }) => values.has(tag)).map(({ tag, type }) => [tag, type, values.get(tag)!]);
}

/** Writes an IFD at `offset`. Entries must be sorted by tag. */
function writeIfd(view: DataView, offset: number, entries: Entry[]): void {
    view.setUint16(offset, entries.length);
    entries.forEach(([tag, type, value], i) => {
        const entry = offset + 2 + i * 12;
        view.setUint16(entry, tag);
        view.setUint16(entry + 2, type);
        view.setUint32(entry + 4, value instanceof Uint8Array ? value.length : 1);
        if (value instanceof Uint8Array) {
            new Uint8Array(view.buffer, view.byteOffset + entry + 8, 4).set(value);
        } else if (type === TYPE_SHORT) {
            view.setUint16(entry + 8, value);
        } else {
            view.setUint32(entry + 8, value);
        }
    });
    // The next-IFD offset is left as zero: there is no IFD1, which is where an Exif thumbnail would live.
}

/** The size of an IFD with the given number of entries. */
function ifdSize(count: number): number {
    return 2 + count * 12 + 4;
}

/**
 * Builds the smallest big-endian TIFF structure that carries the given fields, used to replace a full Exif
 * block.
 *
 * @param fields - the fields to keep
 * @returns the TIFF structure, or undefined if there are no fields to keep
 */
export function buildExif(fields: ExifDisplayFields): Uint8Array<ArrayBuffer> | undefined {
    const interopEntries = entriesOf(fields.interop, KEPT_INTEROP_TAGS);
    const exifEntries = entriesOf(fields.exif, KEPT_EXIF_TAGS);
    const ifd0Entries = entriesOf(fields.ifd0, KEPT_IFD0_TAGS);
    const hasInterop = interopEntries.length > 0;
    const hasExif = exifEntries.length > 0 || hasInterop;
    if (ifd0Entries.length === 0 && !hasExif) return undefined;

    // Lay out the header, then IFD0, then the Exif IFD, then the interoperability IFD. The pointer entries
    // have the highest tags in their IFDs, so they go last.
    const exifOffset = 8 + ifdSize(ifd0Entries.length + (hasExif ? 1 : 0));
    const interopOffset = exifOffset + (hasExif ? ifdSize(exifEntries.length + (hasInterop ? 1 : 0)) : 0);
    if (hasExif) ifd0Entries.push([EXIF_IFD_TAG, TYPE_LONG, exifOffset]);
    if (hasInterop) exifEntries.push([INTEROP_IFD_TAG, TYPE_LONG, interopOffset]);

    const bytes = new Uint8Array(interopOffset + (hasInterop ? ifdSize(interopEntries.length) : 0));
    const view = dataView(bytes);
    view.setUint16(0, 0x4d4d); // big-endian
    view.setUint16(2, 42);
    view.setUint32(4, 8); // IFD0 directly follows the header
    writeIfd(view, 8, ifd0Entries);
    if (hasExif) writeIfd(view, exifOffset, exifEntries);
    if (hasInterop) writeIfd(view, interopOffset, interopEntries);
    return bytes;
}
