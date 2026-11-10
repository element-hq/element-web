/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { normalize } from "matrix-js-sdk/src/utils";

/**
 * How well a piece of text matches a {@link SearchQuery}. Higher values are better matches, so results can be
 * compared and combined with `Math.max`.
 */
export enum SearchQueryMatch {
    /** The text does not match the query. */
    None = 0,
    /** The text contains every word of the query, but not the whole query in one piece. */
    Words = 1,
    /** The text contains the whole query in one piece. */
    Phrase = 2,
}

/**
 * A search query typed by the user, prepared for matching against room names, aliases and similar text.
 *
 * Text matches if it contains the whole query, or failing that, every word of the query in any order. For example
 * "IT Internal" matches "IT Support (Internal)".
 */
export class SearchQuery {
    private readonly normalizedPhrase: string;
    private readonly normalizedWords: string[];
    private readonly lowercasePhrase: string;
    private readonly lowercaseWords: string[];

    /**
     * @param query - The query as typed by the user.
     */
    public constructor(query: string) {
        const trimmed = query.trim();
        // Split before normalising, as normalize() strips whitespace.
        const words = trimmed.split(/\s+/);

        this.normalizedPhrase = normalize(trimmed);
        // Drop words that normalise to nothing, such as a lone "-".
        this.normalizedWords = words.map(normalize).filter(Boolean);
        this.lowercasePhrase = trimmed.toLowerCase();
        this.lowercaseWords = words.map((word) => word.toLowerCase()).filter(Boolean);
    }

    /**
     * Matches the query against text that has already been passed through `normalize()` from the js-sdk,
     * such as `Room.normalizedName`.
     *
     * @param normalizedText - The normalised text to search in.
     * @returns How well the text matches.
     */
    public matchNormalized(normalizedText: string | undefined): SearchQueryMatch {
        return SearchQuery.match(normalizedText, this.normalizedPhrase, this.normalizedWords);
    }

    /**
     * Matches the query against text, ignoring case only. Use this for text where punctuation is meaningful,
     * such as room aliases and user IDs.
     *
     * @param text - The text to search in.
     * @returns How well the text matches.
     */
    public matchIgnoringCase(text: string | undefined): SearchQueryMatch {
        return SearchQuery.match(text?.toLowerCase(), this.lowercasePhrase, this.lowercaseWords);
    }

    private static match(text: string | undefined, phrase: string, words: string[]): SearchQueryMatch {
        if (text === undefined) return SearchQueryMatch.None;
        if (text.includes(phrase)) return SearchQueryMatch.Phrase;
        if (words.length > 1 && words.every((word) => text.includes(word))) return SearchQueryMatch.Words;
        return SearchQueryMatch.None;
    }
}
