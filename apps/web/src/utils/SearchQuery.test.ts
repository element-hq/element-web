/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";
import { normalize } from "matrix-js-sdk/src/utils";

import { SearchQuery, SearchQueryMatch } from "./SearchQuery";

describe("SearchQuery", () => {
    describe("matchNormalized", () => {
        const roomName = normalize("IT Support (Internal)");

        it.each([
            ["IT Support (Internal)", SearchQueryMatch.Phrase],
            ["support int", SearchQueryMatch.Phrase],
            // normalize() strips whitespace, so a query without spaces still matches across words
            ["ITSupport", SearchQueryMatch.Phrase],
            ["IT Internal", SearchQueryMatch.Words],
            ["internal it", SearchQueryMatch.Words],
            ["  IT   -  Internal  ", SearchQueryMatch.Words],
            ["IT External", SearchQueryMatch.None],
            ["helpdesk", SearchQueryMatch.None],
        ])("matches %j as %s", (query, expected) => {
            expect(new SearchQuery(query).matchNormalized(roomName)).toBe(expected);
        });

        it("ignores homoglyphs and diacritics", () => {
            expect(new SearchQuery("Café Ünicorn").matchNormalized(normalize("Unicorn Cafe"))).toBe(
                SearchQueryMatch.Words,
            );
        });

        it("does not match missing text", () => {
            expect(new SearchQuery("anything").matchNormalized(undefined)).toBe(SearchQueryMatch.None);
        });

        it("matches everything for an empty query", () => {
            expect(new SearchQuery("   ").matchNormalized(roomName)).toBe(SearchQueryMatch.Phrase);
        });
    });

    describe("matchIgnoringCase", () => {
        const alias = "#IT-Support:example.org";

        it.each([
            ["#it-support", SearchQueryMatch.Phrase],
            ["it support", SearchQueryMatch.Words],
            ["example.org support", SearchQueryMatch.Words],
            // punctuation is kept, unlike matchNormalized
            ["itsupport", SearchQueryMatch.None],
            ["it helpdesk", SearchQueryMatch.None],
        ])("matches %j as %s", (query, expected) => {
            expect(new SearchQuery(query).matchIgnoringCase(alias)).toBe(expected);
        });

        it("does not match missing text", () => {
            expect(new SearchQuery("anything").matchIgnoringCase(undefined)).toBe(SearchQueryMatch.None);
        });
    });
});
