/*
Copyright 2018 New Vector Ltd

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

import zxcvbn, { ZXCVBNFeedbackWarning } from "zxcvbn";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t, _td } from "../languageHandler";

const ZXCVBN_USER_INPUTS = ["riot", "matrix"];

// Translations for zxcvbn's suggestion strings
_td("Use a few words, avoid common phrases");
_td("No need for symbols, digits, or uppercase letters");
_td("Use a longer keyboard pattern with more turns");
_td("Avoid repeated words and characters");
_td("Avoid sequences");
_td("Avoid recent years");
_td("Avoid years that are associated with you");
_td("Avoid dates and years that are associated with you");
_td("Capitalization doesn't help very much");
_td("All-uppercase is almost as easy to guess as all-lowercase");
_td("Reversed words aren't much harder to guess");
_td("Predictable substitutions like '@' instead of 'a' don't help very much");
_td("Add another word or two. Uncommon words are better.");

// and warnings
_td('Repeats like "aaa" are easy to guess');
_td('Repeats like "abcabcabc" are only slightly harder to guess than "abc"');
_td("Sequences like abc or 6543 are easy to guess");
_td("Recent years are easy to guess");
_td("Dates are often easy to guess");
_td("This is a top-10 common password");
_td("This is a top-100 common password");
_td("This is a very common password");
_td("This is similar to a commonly used password");
_td("A word by itself is easy to guess");
_td("Names and surnames by themselves are easy to guess");
_td("Common names and surnames are easy to guess");
_td("Straight rows of keys are easy to guess");
_td("Short keyboard patterns are easy to guess");

/**
 * Wrapper around zxcvbn password strength estimation
 * Include this only from async components: it pulls in zxcvbn
 * (obviously) which is large.
 *
 * @param {string} password Password to score
 * @param matrixClient the client of the logged in user, if any
 * @returns {object} Score result with `score` and `feedback` properties
 */
export function scorePassword(matrixClient: MatrixClient | undefined, password: string): zxcvbn.ZXCVBNResult | null {
    if (password.length === 0) return null;

    const userInputs = ZXCVBN_USER_INPUTS.slice();
    if (matrixClient) {
        userInputs.push(matrixClient.getUserIdLocalpart()!);
    }

    let zxcvbnResult = zxcvbn(password, userInputs);
    // Work around https://github.com/dropbox/zxcvbn/issues/216
    if (password.includes(" ")) {
        const resultNoSpaces = zxcvbn(password.replace(/ /g, ""), userInputs);
        if (resultNoSpaces.score < zxcvbnResult.score) zxcvbnResult = resultNoSpaces;
    }

    for (let i = 0; i < zxcvbnResult.feedback.suggestions.length; ++i) {
        // translate suggestions
        zxcvbnResult.feedback.suggestions[i] = _t(zxcvbnResult.feedback.suggestions[i]);
    }
    // and warning, if any
    if (zxcvbnResult.feedback.warning) {
        zxcvbnResult.feedback.warning = _t(zxcvbnResult.feedback.warning) as ZXCVBNFeedbackWarning;
    }

    return zxcvbnResult;
}
