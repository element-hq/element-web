/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import {
    CHAT_BACKGROUND_PRESETS,
    clampChatBackgroundOpacity,
    DEFAULT_CHAT_BACKGROUND_OPACITY,
    getChatBackgroundPreset,
    MIN_CHAT_BACKGROUND_OPACITY,
    resolveChatBackground,
} from "../../../src/settings/ChatBackgrounds";

describe("ChatBackgrounds", () => {
    const clientWith = (httpUrl: string | null): MatrixClient =>
        ({ mxcUrlToHttp: jest.fn().mockReturnValue(httpUrl) }) as unknown as MatrixClient;

    describe("CHAT_BACKGROUND_PRESETS", () => {
        it("exposes the bundled presets", () => {
            expect(CHAT_BACKGROUND_PRESETS.map((p) => p.id)).toEqual([
                "doodle",
                "doodle-paper",
                "doodle-meadow",
                "dusk-glow",
                "night-sky",
                "fern",
            ]);
        });

        it("gives every preset distinct light and dark artwork", () => {
            for (const preset of CHAT_BACKGROUND_PRESETS) {
                expect(preset.light.image).not.toBe(preset.dark.image);
            }
        });

        it("keeps the repeat and size lists aligned within each variant", () => {
            for (const preset of CHAT_BACKGROUND_PRESETS) {
                for (const variant of [preset.light, preset.dark]) {
                    expect(variant.repeat.split(", ").length).toBe(variant.size.split(", ").length);
                }
            }
        });

        it("carries no unsubstituted ink placeholder", () => {
            for (const preset of CHAT_BACKGROUND_PRESETS) {
                expect(preset.light.image).not.toContain("__INK");
                expect(preset.dark.image).not.toContain("__INK");
            }
        });
    });

    describe("getChatBackgroundPreset", () => {
        it("returns a preset by id", () => {
            expect(getChatBackgroundPreset("fern")?.id).toBe("fern");
        });

        it.each([
            ["dots", "doodle"],
            ["grid", "doodle"],
            ["diagonal", "doodle"],
            ["soft", "dusk-glow"],
        ])("maps the retired preset %p to its successor %p", (legacy, successor) => {
            expect(getChatBackgroundPreset(legacy)?.id).toBe(successor);
        });

        it("returns undefined for an unknown id", () => {
            expect(getChatBackgroundPreset("nope")).toBeUndefined();
        });
    });

    describe("resolveChatBackground", () => {
        it.each([null, undefined, ""])("returns null for the empty value %p", (value) => {
            expect(resolveChatBackground(value)).toBeNull();
        });

        it("returns null for an unknown preset id", () => {
            expect(resolveChatBackground("mystery")).toBeNull();
        });

        it("resolves a preset to per-theme tiled SVG data URIs", () => {
            const resolved = resolveChatBackground("doodle");
            expect(resolved).toEqual({
                light: {
                    image: expect.stringContaining('url("data:image/svg+xml,'),
                    repeat: "repeat",
                    size: "480px 480px",
                },
                dark: {
                    image: expect.stringContaining('url("data:image/svg+xml,'),
                    repeat: "repeat",
                    size: "480px 480px",
                },
            });
            // The SVG payload is URL-encoded.
            expect(resolved!.light.image).toContain("%3Csvg");
        });

        it("resolves a layered preset with per-layer repeat and size lists", () => {
            const resolved = resolveChatBackground("doodle-meadow")!;
            // Pattern sheet on top, four mesh lobes, opaque base underneath.
            expect(resolved.light.repeat).toBe("repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat");
            expect(resolved.light.size).toBe("480px 840px, auto, auto, auto, auto, auto");
            expect(resolved.light.image).toContain("radial-gradient(");
        });

        it("resolves a stored legacy id exactly like its successor", () => {
            expect(resolveChatBackground("soft")).toEqual(resolveChatBackground("dusk-glow"));
        });

        it("resolves an mxc URI to the same http url in both themes", () => {
            const client = clientWith("https://cdn.example/wall.png");
            const uploaded = {
                image: 'url("https://cdn.example/wall.png")',
                repeat: "no-repeat",
                size: "cover",
            };
            expect(resolveChatBackground("mxc://example.org/abc", client)).toEqual({
                light: uploaded,
                dark: uploaded,
            });
            expect(client.mxcUrlToHttp).toHaveBeenCalled();
        });

        it("returns null when the mxc URI cannot be resolved to http", () => {
            expect(resolveChatBackground("mxc://example.org/abc", clientWith(null))).toBeNull();
        });

        it.each([
            ["a number", 42],
            ["an object", {}],
            ["an array", ["doodle"]],
            ["a boolean", true],
        ])("returns null instead of throwing when account data holds %s", (_label, value) => {
            // The setting is unvalidated account data, so the declared string type is a promise the data does
            // not have to keep. A non-string reaching the resolver used to throw straight out of the
            // LoggedInView constructor, which takes the whole logged-in view down on every reload.
            expect(() => resolveChatBackground(value as unknown as string)).not.toThrow();
            expect(resolveChatBackground(value as unknown as string)).toBeNull();
        });
    });

    describe("clampChatBackgroundOpacity", () => {
        it("passes through a value already in range", () => {
            expect(clampChatBackgroundOpacity(0.5)).toBe(0.5);
        });

        it.each([
            ["below the minimum", -5, MIN_CHAT_BACKGROUND_OPACITY],
            ["above the maximum", 12, 1],
        ])("clamps a value %s", (_label, value, expected) => {
            expect(clampChatBackgroundOpacity(value)).toBe(expected);
        });

        it.each([
            ["a string", "foo"],
            ["null", null],
            ["undefined", undefined],
            ["NaN", NaN],
            ["Infinity", Infinity],
        ])("falls back to the default for %s", (_label, value) => {
            // An unusable value would otherwise reach CSS as an invalid declaration and paint the wallpaper at
            // full strength while the slider showed something else entirely.
            expect(clampChatBackgroundOpacity(value)).toBe(DEFAULT_CHAT_BACKGROUND_OPACITY);
        });
    });
});
