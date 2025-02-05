/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EmojiMapping } from "matrix-js-sdk/src/crypto-api";

import { tEmoji } from "../../../../src/components/views/verification/VerificationShowSas";

describe("tEmoji", () => {
    it.each([
        ["en-GB", "Dog"],
        ["en", "Dog"],
        ["de-DE", "Hund"],
        ["pt", "Cachorro"],
    ])("should handle locale %s", (locale, expectation) => {
        const emoji: EmojiMapping = ["🐶", "Dog"];
        expect(tEmoji(emoji, locale)).toEqual(expectation);
    });
});
