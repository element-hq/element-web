/*
Copyright 2026 Hiroshi Shinaoka

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { createSeshatConfig, TokenizerMode } from "../../src/seshat-config.js";

describe("createSeshatConfig", () => {
    it("returns ngram config when tokenizerMode is ngram", () => {
        const config = createSeshatConfig(TokenizerMode.Ngram);

        expect(config).toEqual({
            tokenizerMode: TokenizerMode.Ngram,
            ngramMinSize: 2,
            ngramMaxSize: 4,
        });
    });

    it("returns language config when tokenizerMode is language", () => {
        const config = createSeshatConfig(TokenizerMode.Language);

        expect(config).toEqual({
            tokenizerMode: TokenizerMode.Language,
        });
    });

    it("defaults to language config when tokenizerMode is undefined", () => {
        const config = createSeshatConfig(undefined);

        expect(config).toEqual({
            tokenizerMode: TokenizerMode.Language,
        });
    });

    it("defaults to language config when tokenizerMode is unknown", () => {
        const config = createSeshatConfig("unknown");

        expect(config).toEqual({
            tokenizerMode: TokenizerMode.Language,
        });
    });
});
