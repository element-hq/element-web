/*
Copyright 2026

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { type ImageContent } from "matrix-js-sdk/src/types";

import { shouldImageFallbackToFileBody } from "./imageEvents";

describe("shouldImageFallbackToFileBody", () => {
    it("never falls back for unencrypted images", () => {
        expect(
            shouldImageFallbackToFileBody({ body: "a", info: { mimetype: "text/html" } } as ImageContent, false),
        ).toBe(false);
    });

    it("falls back for encrypted images with a disallowed mimetype and no thumbnail", () => {
        expect(
            shouldImageFallbackToFileBody({ body: "a", info: { mimetype: "text/html" } } as ImageContent, true),
        ).toBe(true);
        expect(shouldImageFallbackToFileBody({ body: "a" } as ImageContent, true)).toBe(true);
    });

    it("does not fall back for encrypted images with an allowed mimetype or a thumbnail", () => {
        expect(
            shouldImageFallbackToFileBody({ body: "a", info: { mimetype: "image/png" } } as ImageContent, true),
        ).toBe(false);
        expect(
            shouldImageFallbackToFileBody(
                {
                    body: "a",
                    info: { mimetype: "text/html", thumbnail_info: { mimetype: "image/png" } },
                } as ImageContent,
                true,
            ),
        ).toBe(false);
    });
});
