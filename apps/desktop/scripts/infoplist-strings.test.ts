/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { parseInfoPlistStrings, readBaseUsageDescriptions } from "./infoplist-strings.js";

describe("parseInfoPlistStrings", () => {
    it("reads the key/value pairs of a .strings file", () => {
        expect(parseInfoPlistStrings('"Key" = "Value";\n"Other" = "Second value";\n')).toEqual({
            Key: "Value",
            Other: "Second value",
        });
    });

    it("ignores the translator comments Localazy round-trips", () => {
        const contents = ["/* Why this string exists. */", '"Key" = "Value";', "// Trailing note"].join("\n");
        expect(parseInfoPlistStrings(contents)).toEqual({ Key: "Value" });
    });

    it("ignores an entry that has been commented out", () => {
        const contents = ['/* "Key" = "Superseded"; */', '"Key" = "Current";'].join("\n");
        expect(parseInfoPlistStrings(contents)).toEqual({ Key: "Current" });
    });

    it("keeps punctuation that only looks like a comment inside a value", () => {
        expect(parseInfoPlistStrings('"Key" = "Open https://example.org /* not a comment */";')).toEqual({
            Key: "Open https://example.org /* not a comment */",
        });
    });

    it("unescapes quotes, backslashes and newlines", () => {
        expect(parseInfoPlistStrings('"Key" = "A \\"quoted\\" \\\\ word\\non two lines";')).toEqual({
            Key: 'A "quoted" \\ word\non two lines',
        });
    });

    it("unescapes the \\U code-unit escape Apple's format allows", () => {
        expect(parseInfoPlistStrings('"Key" = "Caf\\U00E9 \\U2014 open";')).toEqual({ Key: "Café — open" });
    });

    it("returns nothing for a file with no entries", () => {
        expect(parseInfoPlistStrings("/* Nothing to translate yet. */\n")).toEqual({});
    });
});

describe("readBaseUsageDescriptions", () => {
    // These are the values macOS falls back to when the user's system language has no translation
    // yet, so an empty or misspelt key here would silently ship an English-only — or, under the
    // hardened runtime, a crashing — consent prompt.
    it("provides both usage descriptions macOS requires for the consent prompt", () => {
        expect(readBaseUsageDescriptions()).toEqual({
            NSCameraUsageDescription: expect.stringMatching(/\S/),
            NSMicrophoneUsageDescription: expect.stringMatching(/\S/),
        });
    });
});
