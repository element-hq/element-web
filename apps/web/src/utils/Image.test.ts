/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { blobIsAnimated, blobIsHiDpiPng, mayBeAnimated } from "./Image";
import { concatBytes, dataView } from "./media/bytes";
import { PNG_SIGNATURE } from "./media/png";

const imagesDir = fileURLToPath(import.meta.resolve("../../test/unit-tests/images"));

/** Builds a PNG from chunks given as [type, data]. CRCs are left as zero as they are not checked. */
function pngBlob(...chunks: [string, number[] | number][]): Blob {
    const parts = chunks.map(([type, data]) => {
        const body = typeof data === "number" ? new Uint8Array(data) : new Uint8Array(data);
        const header = new Uint8Array(8);
        dataView(header).setUint32(0, body.length);
        for (let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i);
        return concatBytes(header, body, new Uint8Array(4));
    });
    return new Blob([Buffer.from(PNG_SIGNATURE, "latin1"), ...parts], { type: "image/png" });
}

const HIDPI = [0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01];

describe("Image", () => {
    describe("mayBeAnimated", () => {
        it("image/gif", async () => {
            expect(mayBeAnimated("image/gif")).toBeTruthy();
        });
        it("image/webp", async () => {
            expect(mayBeAnimated("image/webp")).toBeTruthy();
        });
        it("image/png", async () => {
            expect(mayBeAnimated("image/png")).toBeTruthy();
        });
        it("image/apng", async () => {
            expect(mayBeAnimated("image/apng")).toBeTruthy();
        });
        it("image/jpeg", async () => {
            expect(mayBeAnimated("image/jpeg")).toBeFalsy();
        });
    });

    describe("blobIsAnimated", () => {
        it("Animated GIF", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "animated-logo.gif")).slice()], {
                type: "image/gif",
            });
            expect(await blobIsAnimated(img)).toBeTruthy();
        });

        it("Static GIF", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "static-logo.gif")).slice()], {
                type: "image/gif",
            });
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Animated WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "animated-logo.webp")).slice()], {
                type: "image/webp",
            });
            expect(await blobIsAnimated(img)).toBeTruthy();
        });

        it("Static WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "static-logo.webp")).slice()], {
                type: "image/webp",
            });
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Static WEBP in extended file format", async () => {
            const img = new Blob(
                [fs.readFileSync(path.resolve(imagesDir, "static-logo-extended-file-format.webp")).slice()],
                { type: "image/webp" },
            );
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Animated PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "animated-logo.apng")).slice()]);
            const pngBlob = img.slice(0, img.size, "image/png");
            const apngBlob = img.slice(0, img.size, "image/apng");
            expect(await blobIsAnimated(pngBlob)).toBeTruthy();
            expect(await blobIsAnimated(apngBlob)).toBeTruthy();
        });

        it("Static PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "static-logo.png")).slice()]);
            const pngBlob = img.slice(0, img.size, "image/png");
            const apngBlob = img.slice(0, img.size, "image/apng");
            expect(await blobIsAnimated(pngBlob)).toBeFalsy();
            expect(await blobIsAnimated(apngBlob)).toBeFalsy();
        });

        it("PNG which cannot be parsed", async () => {
            const bytes = fs.readFileSync(path.resolve(imagesDir, "animated-logo.apng")).subarray(0, 40);
            expect(await blobIsAnimated(new Blob([bytes.slice()], { type: "image/png" }))).toBe(false);
            expect(await blobIsAnimated(new Blob(["not a png"], { type: "image/png" }))).toBe(false);
        });
    });

    describe("blobIsHiDpiPng", () => {
        it("detects the pixel density of a macOS hidpi screenshot", async () => {
            const blob = pngBlob(["IHDR", 13], ["pHYs", HIDPI], ["IDAT", 10], ["IEND", 0]);
            expect(await blobIsHiDpiPng(blob)).toBe(true);
        });

        it("ignores other pixel densities", async () => {
            const blob = pngBlob(["IHDR", 13], ["pHYs", [0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1]], ["IEND", 0]);
            expect(await blobIsHiDpiPng(blob)).toBe(false);
        });

        it("ignores a pHYs chunk after the image data", async () => {
            const blob = pngBlob(["IHDR", 13], ["IDAT", 10], ["pHYs", HIDPI], ["IEND", 0]);
            expect(await blobIsHiDpiPng(blob)).toBe(false);
        });

        it("returns false for a PNG without pHYs", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(imagesDir, "static-logo.png")).slice()]);
            expect(await blobIsHiDpiPng(img)).toBe(false);
        });

        it("returns false for a blob which is not a PNG", async () => {
            expect(await blobIsHiDpiPng(new Blob(["not a png"], { type: "image/png" }))).toBe(false);
        });
    });
});
