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

import './skinned-sdk';
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
            expect(mayBeAnimated("image/png")).toBeFalsy();
        });
        it("image/jpeg", async () => {
            expect(mayBeAnimated("image/jpeg")).toBeFalsy();
        });
    });

    describe("blobIsAnimated", () => {
        const animatedGif = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.gif"))]);
        const animatedWebp = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "animated-logo.webp"))]);
        const staticGif = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.gif"))]);
        const staticWebp = new Blob([fs.readFileSync(path.resolve(__dirname, "images", "static-logo.webp"))]);

        it("Animated GIF", async () => {
            expect(await blobIsAnimated("image/gif", animatedGif)).toBeTruthy();
        });

        it("Static GIF", async () => {
            expect(await blobIsAnimated("image/gif", staticGif)).toBeFalsy();
        });

        it("Animated WEBP", async () => {
            expect(await blobIsAnimated("image/webp", animatedWebp)).toBeTruthy();
        });

        it("Static WEBP", async () => {
            expect(await blobIsAnimated("image/webp", staticWebp)).toBeFalsy();
        });
    });
});
