/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { blobIsAnimated, mayBeAnimated } from "./Image";

const imagesDir = path.resolve(__dirname, "../../test/unit-tests/images");

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
    });
});
