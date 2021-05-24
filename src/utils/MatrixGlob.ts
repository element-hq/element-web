/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import globToRegexp from "glob-to-regexp";

// Taken with permission from matrix-bot-sdk:
// https://github.com/turt2live/matrix-js-bot-sdk/blob/eb148c2ecec7bf3ade801d73deb43df042d55aef/src/MatrixGlob.ts

/**
 * Represents a common Matrix glob. This is commonly used
 * for server ACLs and similar functions.
 */
export class MatrixGlob {
    _regex: RegExp;

    /**
     * Creates a new Matrix Glob
     * @param {string} glob The glob to convert. Eg: "*.example.org"
     */
    constructor(glob: string) {
        const globRegex = globToRegexp(glob, {
            extended: false,
            globstar: false,
        });

        // We need to convert `?` manually because globToRegexp's extended mode
        // does more than we want it to.
        const replaced = globRegex.toString().replace(/\\\?/g, ".");
        this._regex = new RegExp(replaced.substring(1, replaced.length - 1));
    }

    /**
     * Tests the glob against a value, returning true if it matches.
     * @param {string} val The value to test.
     * @returns {boolean} True if the value matches the glob, false otherwise.
     */
    test(val: string): boolean {
        return this._regex.test(val);
    }
}
