/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Tests which need a real browser: Ultra HDR XMP is handled with DOMParser, whose namespace support
 * happy-dom does not implement faithfully, and decoding the stripped images checks that a browser still
 * displays them as it did the originals. Everything else is covered by stripFileMetadata.test.ts.
 */

import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

import { stripFileMetadata } from "./stripFileMetadata";
import { dataView } from "./bytes";

// Paths given to readFile are relative to the project root.
const fixturesDir = "test/unit-tests/images";

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function fixture(name: string, type: string): Promise<File> {
    const base64 = await commands.readFile(`${fixturesDir}/${name}`, "base64");
    return new File([decodeBase64(base64)], name, { type });
}

async function textOf(blob: Blob): Promise<string> {
    return new TextDecoder("latin1").decode(await blob.arrayBuffer());
}

/** Decodes an image the way an `<img>` would, returning its displayed size. */
async function displayedSize(blob: Blob): Promise<[number, number]> {
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Finds the entries of a big-endian JPEG multi-picture index.
 *
 * @returns the offset of the TIFF header the entries are relative to, the offset of the entries and their count
 */
function findMpEntries(bytes: Uint8Array): { base: number; values: number; count: number } {
    const mpf = new TextDecoder("latin1").decode(bytes).indexOf("MPF\0");
    expect(mpf).toBeGreaterThan(0);
    const base = mpf + 4;
    const view = dataView(bytes);
    const ifd = base + view.getUint32(base + 4);
    for (let i = 0; i < view.getUint16(ifd); i++) {
        const entry = ifd + 2 + i * 12;
        if (view.getUint16(entry) === 0xb002) {
            return { base, values: base + view.getUint32(entry + 8), count: view.getUint32(entry + 4) / 16 };
        }
    }
    throw new Error("No MP entries");
}

/** Lists the images in a JPEG's multi-picture index as [offset from the start of the file, size]. */
function multiPictureImages(bytes: Uint8Array): [number, number][] {
    const { base, values, count } = findMpEntries(bytes);
    const view = dataView(bytes);
    return Array.from({ length: count }, (_, n) => {
        const size = view.getUint32(values + n * 16 + 4);
        const offset = view.getUint32(values + n * 16 + 8);
        return [n === 0 ? 0 : base + offset, size];
    });
}

describe("stripFileMetadata in a browser", () => {
    it.each([
        ["photo.jpg", "image/jpeg"],
        ["ultrahdr.jpg", "image/jpeg"],
        ["photo.png", "image/png"],
    ])("still displays %s as before", async (name, type) => {
        const file = await fixture(name, type);
        const stripped = await stripFileMetadata(file);

        expect(stripped).not.toBe(file);
        expect(await displayedSize(stripped)).toEqual(await displayedSize(file));
    });

    describe("Ultra HDR JPEG", () => {
        it("keeps the gain map and the properties needed to apply it", async () => {
            const stripped = await stripFileMetadata(await fixture("ultrahdr.jpg", "image/jpeg"));
            const bytes = new Uint8Array(await stripped.arrayBuffer());
            const text = await textOf(stripped);

            expect(text).not.toContain("Leaky");

            // The index lists the primary image and the gain map, which directly follows it.
            const [[, primarySize], [gainMapOffset, gainMapSize]] = multiPictureImages(bytes);
            expect(gainMapOffset).toBe(primarySize);
            expect(gainMapOffset + gainMapSize).toBe(bytes.length);
            const gainMap = new Blob([bytes.subarray(gainMapOffset)], { type: "image/jpeg" });
            expect(await displayedSize(gainMap)).toEqual([12, 6]);

            // The primary image's XMP keeps the gain map version and a directory with the gain map's new length.
            const primary = text.slice(0, primarySize);
            expect(primary).toContain('hdrgm:Version="1.0"');
            expect(primary).toContain(`Item:Semantic="GainMap"`);
            expect(primary).toContain(`Item:Length="${gainMapSize}"`);
            expect(primary).toContain("urn:iso:std:iso:ts:21496:-1");

            // The gain map keeps its tone mapping properties, including those written as elements.
            const gainMapText = text.slice(gainMapOffset);
            expect(gainMapText).toContain('hdrgm:GainMapMax="2.3"');
            expect(gainMapText).toMatch(/<hdrgm:GainMapMin[^>]*>.*<rdf:li>0<\/rdf:li>/s);
            expect(gainMapText).toContain("urn:iso:std:iso:ts:21496:-1");

            await expect(stripFileMetadata(stripped)).resolves.toBe(stripped);
        });

        it("drops the gain map, and its XMP, if the index can't be followed", async () => {
            const original = new Uint8Array(await (await fixture("ultrahdr.jpg", "image/jpeg")).arrayBuffer());
            // Point the gain map's entry past the end of the file.
            const [, [gainMapOffset]] = multiPictureImages(original);
            const corrupted = original.slice();
            const { values } = findMpEntries(corrupted);
            dataView(corrupted).setUint32(values + 16 + 8, 0xffffff);

            const stripped = await stripFileMetadata(new File([corrupted], "a.jpg", { type: "image/jpeg" }));
            const text = await textOf(stripped);

            expect(stripped.size).toBeLessThan(gainMapOffset);
            expect(text).not.toContain("MPF\0");
            expect(text).not.toContain("hdrgm");
            expect(await displayedSize(stripped)).toEqual([24, 12]);
        });
    });
});
