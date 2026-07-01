/*
Copyright 2025 Hiroshi Shinaoka

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export enum TokenizerMode {
    Ngram = "ngram",
    Language = "language",
}

/**
 * Create Seshat configuration based on tokenizer mode.
 *
 * @param tokenizerMode - The tokenizer mode: "ngram" for N-gram tokenization (CJK languages),
 *                        or "language" for standard language-based tokenization.
 * @returns Configuration object for Seshat initialization.
 */
export function createSeshatConfig(tokenizerMode?: string): {
    tokenizerMode: TokenizerMode;
    ngramMinSize?: number;
    ngramMaxSize?: number;
} {
    if (tokenizerMode === TokenizerMode.Ngram) {
        return {
            tokenizerMode: TokenizerMode.Ngram,
            ngramMinSize: 2,
            ngramMaxSize: 4,
        };
    }

    if (tokenizerMode === undefined || tokenizerMode === TokenizerMode.Language) {
        return { tokenizerMode: TokenizerMode.Language };
    }

    throw new Error(`Unknown tokenizer mode: ${tokenizerMode}`);
}
