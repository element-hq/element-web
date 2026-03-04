/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { tEmoji, type SasEmoji } from "./SasEmojiTranslate.ts";

describe("tEmoji", () => {
    it.each([
        ["🐶", "en-GB", "Dog"],
        ["🐶", "en", "Dog"],
        ["🐶", "de-DE", "Hund"],
        ["🐶", "pt", "Cachorro"],
        ["🔧", "de-DE", "Schraubenschlüssel"],
        ["🎅", "sq", "Babagjyshi i Vitit të Ri"],
    ] as [emoji: SasEmoji, locale: string, expectation: string][])(
        "should handle locale %s",
        (emoji, locale, expectation) => {
            expect(tEmoji(emoji, locale)).toEqual(expectation);
        },
    );
});
