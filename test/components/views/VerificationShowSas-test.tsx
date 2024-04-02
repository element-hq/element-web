/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { EmojiMapping } from "matrix-js-sdk/src/crypto-api";

import { tEmoji } from "../../../src/components/views/verification/VerificationShowSas";

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
