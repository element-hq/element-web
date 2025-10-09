/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fs from "fs";
import path from "path";

import { blobIsAnimated, mayBeAnimated } from "../../src/utils/Image";

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
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.gif"))], {
                type: "image/gif",
            });
            expect(await blobIsAnimated(img)).toBeTruthy();
        });

        it("Static GIF", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.gif"))], {
                type: "image/gif",
            });
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Animated WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.webp"))], {
                type: "image/webp",
            });
            expect(await blobIsAnimated(img)).toBeTruthy();
        });

        it("Static WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.webp"))], {
                type: "image/webp",
            });
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Static WEBP in extended file format", async () => {
            const img = new Blob(
                [fs.readFileSync(path.resolve(__dirname, "images", "static-logo-extended-file-format.webp"))],
                { type: "image/webp" },
            );
            expect(await blobIsAnimated(img)).toBeFalsy();
        });

        it("Animated PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.apng"))]);
            const pngBlob = img.slice(0, img.size, "image/png");
            const apngBlob = img.slice(0, img.size, "image/apng");
            expect(await blobIsAnimated(pngBlob)).toBeTruthy();
            expect(await blobIsAnimated(apngBlob)).toBeTruthy();
        });

        it("Static PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.png"))]);
            const pngBlob = img.slice(0, img.size, "image/png");
            const apngBlob = img.slice(0, img.size, "image/apng");
            expect(await blobIsAnimated(pngBlob)).toBeFalsy();
            expect(await blobIsAnimated(apngBlob)).toBeFalsy();
        });
    });
});
