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
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.gif"))]);
            expect(await blobIsAnimated("image/gif", img)).toBeTruthy();
        });

        it("Static GIF", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.gif"))]);
            expect(await blobIsAnimated("image/gif", img)).toBeFalsy();
        });

        it("Animated WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.webp"))]);
            expect(await blobIsAnimated("image/webp", img)).toBeTruthy();
        });

        it("Static WEBP", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.webp"))]);
            expect(await blobIsAnimated("image/webp", img)).toBeFalsy();
        });

        it("Animated PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.apng"))]);
            expect(await blobIsAnimated("image/png", img)).toBeTruthy();
            expect(await blobIsAnimated("image/apng", img)).toBeTruthy();
        });

        it("Static PNG", async () => {
            const img = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.png"))]);
            expect(await blobIsAnimated("image/png", img)).toBeFalsy();
            expect(await blobIsAnimated("image/apng", img)).toBeFalsy();
        });
    });
});
