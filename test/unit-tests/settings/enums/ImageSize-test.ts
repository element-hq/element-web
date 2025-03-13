/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ImageSize, suggestedSize } from "../../../../src/settings/enums/ImageSize";

describe("ImageSize", () => {
    describe("suggestedSize", () => {
        it("constrains width", () => {
            const size = suggestedSize(ImageSize.Normal, { w: 648, h: 162 });
            expect(size).toStrictEqual({ w: 324, h: 81 });
        });
        it("constrains height", () => {
            const size = suggestedSize(ImageSize.Normal, { w: 162, h: 648 });
            expect(size).toStrictEqual({ w: 81, h: 324 });
        });
        it("constrains width in large mode", () => {
            const size = suggestedSize(ImageSize.Large, { w: 2400, h: 1200 });
            expect(size).toStrictEqual({ w: 800, h: 400 });
        });
        it("returns max values if content size is not specified", () => {
            const size = suggestedSize(ImageSize.Normal, {});
            expect(size).toStrictEqual({ w: 324, h: 324 });
        });
        it("returns integer values", () => {
            const size = suggestedSize(ImageSize.Normal, { w: 642, h: 350 }); // does not divide evenly
            expect(size).toStrictEqual({ w: 324, h: 176 });
        });
        it("returns integer values for portrait images", () => {
            const size = suggestedSize(ImageSize.Normal, { w: 720, h: 1280 });
            expect(size).toStrictEqual({ w: 182, h: 324 });
        });
    });
});
