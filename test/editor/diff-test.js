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

import expect from 'expect';
import {diffDeletion} from "../../src/editor/diff";

describe('editor/diff', function() {
    describe('diffDeletion', function() {
        it('at start of string', function() {
            const diff = diffDeletion("hello", "ello");
            expect(diff.at).toBe(0);
            expect(diff.removed).toBe("h");
        });
        it('removing whole string', function() {
            const diff = diffDeletion("hello", "");
            expect(diff.at).toBe(0);
            expect(diff.removed).toBe("hello");
        });
        it('in middle of string', function() {
            const diff = diffDeletion("hello", "hllo");
            expect(diff.at).toBe(1);
            expect(diff.removed).toBe("e");
        });
        it('in middle of string with duplicate character', function() {
            const diff = diffDeletion("hello", "helo");
            expect(diff.at).toBe(3);
            expect(diff.removed).toBe("l");
        });
        it('at end of string', function() {
            const diff = diffDeletion("hello", "hell");
            expect(diff.at).toBe(4);
            expect(diff.removed).toBe("o");
        });
    });
});
