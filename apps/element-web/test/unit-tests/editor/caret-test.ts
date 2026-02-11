/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getLineAndNodePosition } from "../../../src/editor/caret";
import EditorModel from "../../../src/editor/model";
import { createPartCreator } from "./mock";

describe("editor/caret: DOM position for caret", function () {
    describe("basic text handling", function () {
        it("at end of single line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 5 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it("at start of single line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 0 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it("at middle of single line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 2 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(2);
        });
    });
    describe("handling line breaks", function () {
        it("at start of first line which is empty", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.newline(), pc.plain("hello world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 0 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(-1);
            expect(offset).toBe(0);
        });
        it("at end of last line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello"), pc.newline(), pc.plain("world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 2, offset: 5 });
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it("at start of last line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello"), pc.newline(), pc.plain("world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 2, offset: 0 });
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it("before empty line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello"), pc.newline(), pc.newline(), pc.plain("world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 5 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it("in empty line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello"), pc.newline(), pc.newline(), pc.plain("world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 1, offset: 1 });
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(-1);
            expect(offset).toBe(0);
        });
        it("after empty line", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello"), pc.newline(), pc.newline(), pc.plain("world")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 3, offset: 0 });
            expect(lineIndex).toBe(2);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
    });
    describe("handling non-editable parts and caret nodes", function () {
        it("at start of non-editable part (with plain text around)", function () {
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.plain("hello"), pc.userPill("Alice", "@alice:hs.tld"), pc.plain("!")],
                pc,
            );
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 1, offset: 0 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it("in middle of non-editable part (with plain text around)", function () {
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.plain("hello"), pc.userPill("Alice", "@alice:hs.tld"), pc.plain("!")],
                pc,
            );
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 1, offset: 2 });
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it("at start of non-editable part (without plain text around)", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Alice", "@alice:hs.tld")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 0 });
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret)
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it("in middle of non-editable part (without plain text around)", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Alice", "@alice:hs.tld")], pc);
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 1 });
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it("in middle of a first non-editable part, with another one following", function () {
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.userPill("Alice", "@alice:hs.tld"), pc.userPill("Bob", "@bob:hs.tld")],
                pc,
            );
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 0, offset: 1 });
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it("in start of a second non-editable part, with another one before it", function () {
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.userPill("Alice", "@alice:hs.tld"), pc.userPill("Bob", "@bob:hs.tld")],
                pc,
            );
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 1, offset: 0 });
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it("in middle of a second non-editable part, with another one before it", function () {
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.userPill("Alice", "@alice:hs.tld"), pc.userPill("Bob", "@bob:hs.tld")],
                pc,
            );
            const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, { index: 1, offset: 1 });
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(4);
            expect(offset).toBe(0);
        });
    });
});
