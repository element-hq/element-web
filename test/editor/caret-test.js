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

import {getLineAndNodePosition} from "../../src/editor/caret";
import EditorModel from "../../src/editor/model";
import {createPartCreator} from "./mock";

describe('editor/caret: DOM position for caret', function() {
    describe('basic text handling', function() {
        it('at end of single line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 5});
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it('at start of single line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 0});
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it('at middle of single line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 2});
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(2);
        });
    });
    describe('handling line breaks', function() {
        it('at end of last line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.newline(),
                pc.plain("world"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 2, offset: 5});
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it('at start of last line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.newline(),
                pc.plain("world"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 2, offset: 0});
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it('in empty line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.newline(),
                pc.newline(),
                pc.plain("world"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 1, offset: 1});
            expect(lineIndex).toBe(1);
            expect(nodeIndex).toBe(-1);
            expect(offset).toBe(0);
        });
        it('after empty line', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.newline(),
                pc.newline(),
                pc.plain("world"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 3, offset: 0});
            expect(lineIndex).toBe(2);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
    });
    describe('handling non-editable parts and caret nodes', function() {
        it('at start of non-editable part (with plain text around)', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.userPill("Alice", "@alice:hs.tld"),
                pc.plain("!"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 1, offset: 0});
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(5);
        });
        it('in middle of non-editable part (with plain text around)', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.userPill("Alice", "@alice:hs.tld"),
                pc.plain("!"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 1, offset: 2});
            expect(lineIndex).toBe(0);
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it('at start of non-editable part (without plain text around)', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.userPill("Alice", "@alice:hs.tld"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 0});
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret)
            expect(nodeIndex).toBe(0);
            expect(offset).toBe(0);
        });
        it('in middle of non-editable part (without plain text around)', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.userPill("Alice", "@alice:hs.tld"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 1});
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it('in middle of a first non-editable part, with another one following', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.userPill("Alice", "@alice:hs.tld"),
                pc.userPill("Bob", "@bob:hs.tld"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 0, offset: 1});
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it('in start of a second non-editable part, with another one before it', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.userPill("Alice", "@alice:hs.tld"),
                pc.userPill("Bob", "@bob:hs.tld"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 1, offset: 0});
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(2);
            expect(offset).toBe(0);
        });
        it('in middle of a second non-editable part, with another one before it', function() {
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.userPill("Alice", "@alice:hs.tld"),
                pc.userPill("Bob", "@bob:hs.tld"),
            ]);
            const {offset, lineIndex, nodeIndex} =
                getLineAndNodePosition(model, {index: 1, offset: 1});
            expect(lineIndex).toBe(0);
            //presumed nodes on line are (caret, pill, caret, pill, caret)
            expect(nodeIndex).toBe(4);
            expect(offset).toBe(0);
        });
    });
});
