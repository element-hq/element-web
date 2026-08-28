/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { exportPackJson, PackImportError, parsePackJson } from "./import-export.ts";
import type { ImagePackDefinition } from "./types.ts";

const basePack: ImagePackDefinition = {
    displayName: "Test pack",
    images: {
        wave: { shortcode: "wave", url: "mxc://example.org/wave", body: "a wave" },
        yes: { shortcode: "yes", url: "mxc://example.org/yes" },
    },
    avatarUrl: "mxc://example.org/avatar",
    attribution: "by anon",
    usage: ["emoticon"],
};

describe("import-export", () => {
    it("round-trips a pack through the raw MSC2545 shape", () => {
        const payload = exportPackJson(basePack);
        const restored = parsePackJson(payload);
        expect(restored).toEqual(basePack);
    });

    it("still reads the former versioned camelCase envelope", () => {
        expect(
            parsePackJson({
                version: 1,
                pack: {
                    displayName: "Legacy",
                    images: { wave: { url: "mxc://example.org/wave" } },
                },
            }),
        ).toEqual({
            displayName: "Legacy",
            images: { wave: { shortcode: "wave", url: "mxc://example.org/wave" } },
        });
    });

    it("round-trips a pack through bare MSC2545 wire format", () => {
        const payload = {
            images: basePack.images,
            pack: {
                display_name: basePack.displayName,
                avatar_url: basePack.avatarUrl,
                attribution: basePack.attribution,
                usage: basePack.usage,
            },
        };
        const restored = parsePackJson(payload);
        expect(restored).toEqual(basePack);
    });

    it("rejects shortcodes outside the MSC2545 grammar", () => {
        expect(() =>
            parsePackJson({
                version: 1,
                pack: {
                    images: { "no spaces": { url: "mxc://example.org/x" } },
                    pack: { display_name: "x" },
                },
            }),
        ).toThrow(PackImportError);
    });

    it("rejects non-mxc image URLs", () => {
        expect(() =>
            parsePackJson({
                version: 1,
                pack: {
                    images: { foo: { url: "https://example.org/foo" } },
                    pack: { display_name: "x" },
                },
            }),
        ).toThrow(PackImportError);
    });

    it("accepts packs without optional pack metadata", () => {
        expect(
            parsePackJson({
                images: { foo: { url: "mxc://example.org/foo" } },
            }),
        ).toEqual({
            displayName: "",
            images: { foo: { shortcode: "foo", url: "mxc://example.org/foo" } },
        });
    });

    it("uses discovery metadata when a wire pack omits display_name", () => {
        expect(parsePackJson({ images: { foo: { url: "mxc://example.org/foo" } } }, "From index").displayName).toBe(
            "From index",
        );
    });

    it("does not turn an all-usage pack into an emoticon-only pack on export", () => {
        const exported = exportPackJson({
            displayName: "All uses",
            usage: [],
            images: { wave: { shortcode: "wave", url: "mxc://example.org/wave" } },
        });
        expect(exported.pack?.usage).toEqual([]);
    });

    it("refuses input that is neither an envelope nor a pack", () => {
        expect(() => parsePackJson(null)).toThrow(PackImportError);
        expect(() => parsePackJson({})).toThrow(PackImportError);
        expect(() => parsePackJson({ version: 1 })).toThrow(PackImportError);
    });
});
