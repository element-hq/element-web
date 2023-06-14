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

import { diffDeletion, diffAtCaret } from "../../src/editor/diff";

describe("editor/diff", function () {
    describe("diffDeletion", function () {
        describe("with a single character removed", function () {
            it("at start of string", function () {
                const diff = diffDeletion("hello", "ello");
                expect(diff.at).toBe(0);
                expect(diff.removed).toBe("h");
            });
            it("in middle of string", function () {
                const diff = diffDeletion("hello", "hllo");
                expect(diff.at).toBe(1);
                expect(diff.removed).toBe("e");
            });
            it("in middle of string with duplicate character", function () {
                const diff = diffDeletion("hello", "helo");
                expect(diff.at).toBe(3);
                expect(diff.removed).toBe("l");
            });
            it("at end of string", function () {
                const diff = diffDeletion("hello", "hell");
                expect(diff.at).toBe(4);
                expect(diff.removed).toBe("o");
            });
        });
        describe("with a multiple removed", function () {
            it("at start of string", function () {
                const diff = diffDeletion("hello", "llo");
                expect(diff.at).toBe(0);
                expect(diff.removed).toBe("he");
            });
            it("removing whole string", function () {
                const diff = diffDeletion("hello", "");
                expect(diff.at).toBe(0);
                expect(diff.removed).toBe("hello");
            });
            it("in middle of string", function () {
                const diff = diffDeletion("hello", "hlo");
                expect(diff.at).toBe(1);
                expect(diff.removed).toBe("el");
            });
            it("in middle of string with duplicate character", function () {
                const diff = diffDeletion("hello", "heo");
                expect(diff.at).toBe(2);
                expect(diff.removed).toBe("ll");
            });
            it("at end of string", function () {
                const diff = diffDeletion("hello", "hel");
                expect(diff.at).toBe(3);
                expect(diff.removed).toBe("lo");
            });
        });
    });
    describe("diffAtCaret", function () {
        it("insert at start", function () {
            const diff = diffAtCaret("world", "hello world", 6);
            expect(diff.at).toBe(0);
            expect(diff.added).toBe("hello ");
            expect(diff.removed).toBeFalsy();
        });
        it("insert at end", function () {
            const diff = diffAtCaret("hello", "hello world", 11);
            expect(diff.at).toBe(5);
            expect(diff.added).toBe(" world");
            expect(diff.removed).toBeFalsy();
        });
        it("insert in middle", function () {
            const diff = diffAtCaret("hello world", "hello cruel world", 12);
            expect(diff.at).toBe(6);
            expect(diff.added).toBe("cruel ");
            expect(diff.removed).toBeFalsy();
        });
        it("replace at start", function () {
            const diff = diffAtCaret("morning, world!", "afternoon, world!", 9);
            expect(diff.at).toBe(0);
            expect(diff.removed).toBe("morning");
            expect(diff.added).toBe("afternoon");
        });
        it("replace at end", function () {
            const diff = diffAtCaret("morning, world!", "morning, mars?", 14);
            expect(diff.at).toBe(9);
            expect(diff.removed).toBe("world!");
            expect(diff.added).toBe("mars?");
        });
        it("replace in middle", function () {
            const diff = diffAtCaret("morning, blue planet", "morning, red planet", 12);
            expect(diff.at).toBe(9);
            expect(diff.removed).toBe("blue");
            expect(diff.added).toBe("red");
        });
        it("remove at start of string", function () {
            const diff = diffAtCaret("hello", "ello", 0);
            expect(diff.at).toBe(0);
            expect(diff.removed).toBe("h");
            expect(diff.added).toBeFalsy();
        });
        it("removing whole string", function () {
            const diff = diffAtCaret("hello", "", 0);
            expect(diff.at).toBe(0);
            expect(diff.removed).toBe("hello");
            expect(diff.added).toBeFalsy();
        });
        it("remove in middle of string", function () {
            const diff = diffAtCaret("hello", "hllo", 1);
            expect(diff.at).toBe(1);
            expect(diff.removed).toBe("e");
            expect(diff.added).toBeFalsy();
        });
        it("forwards remove in middle of string", function () {
            const diff = diffAtCaret("hello", "hell", 4);
            expect(diff.at).toBe(4);
            expect(diff.removed).toBe("o");
            expect(diff.added).toBeFalsy();
        });
        it("forwards remove in middle of string with duplicate character", function () {
            const diff = diffAtCaret("hello", "helo", 3);
            expect(diff.at).toBe(3);
            expect(diff.removed).toBe("l");
            expect(diff.added).toBeFalsy();
        });
        it("remove at end of string", function () {
            const diff = diffAtCaret("hello", "hell", 4);
            expect(diff.at).toBe(4);
            expect(diff.removed).toBe("o");
            expect(diff.added).toBeFalsy();
        });
    });
});
