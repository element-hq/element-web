/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import fs from "fs";
import path from "path";

import { blobIsAnimated, mayBeAnimated } from "../src/utils/Image";

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
