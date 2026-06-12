/*
Copyright 2026 Hiroshi Shinaoka

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { createSeshatConfig, TokenizerMode } from "./seshat-config.js";

describe("createSeshatConfig", () => {
    it.each([
        [
            TokenizerMode.Ngram,
            {
                tokenizerMode: TokenizerMode.Ngram,
                ngramMinSize: 2,
                ngramMaxSize: 4,
            },
        ],
        [TokenizerMode.Language, { tokenizerMode: TokenizerMode.Language }],
        [undefined, { tokenizerMode: TokenizerMode.Language }],
        ["unknown", { tokenizerMode: TokenizerMode.Language }],
    ])("returns the expected config for tokenizerMode %s", (tokenizerMode, expectedConfig) => {
        expect(createSeshatConfig(tokenizerMode)).toEqual(expectedConfig);
    });
});
