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

import HistoryManager, {MAX_STEP_LENGTH} from "../../src/editor/history";

describe('editor/history', function() {
    it('push, then undo', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        const caret1 = {};
        const result1 = history.tryPush(model, caret1);
        expect(result1).toEqual(true);
        parts[0] = "hello world";
        history.tryPush(model, {});
        expect(history.canUndo()).toEqual(true);
        const undoState = history.undo(model);
        expect(undoState.caret).toEqual(caret1);
        expect(undoState.parts).toEqual(["hello"]);
        expect(history.canUndo()).toEqual(false);
    });
    it('push, undo, then redo', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        history.tryPush(model, {});
        parts[0] = "hello world";
        const caret2 = {};
        history.tryPush(model, caret2);
        history.undo(model);
        expect(history.canRedo()).toEqual(true);
        const redoState = history.redo();
        expect(redoState.caret).toEqual(caret2);
        expect(redoState.parts).toEqual(["hello world"]);
        expect(history.canRedo()).toEqual(false);
        expect(history.canUndo()).toEqual(true);
    });
    it('push, undo, push, ensure you can`t redo', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        history.tryPush(model, {});
        parts[0] = "hello world";
        history.tryPush(model, {});
        history.undo(model);
        parts[0] = "hello world!!";
        history.tryPush(model, {});
        expect(history.canRedo()).toEqual(false);
    });
    it('not every keystroke stores a history step', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        const firstCaret = {};
        history.tryPush(model, firstCaret);
        const diff = {added: "o"};
        let keystrokeCount = 0;
        do {
            parts[0] = parts[0] + diff.added;
            keystrokeCount += 1;
        } while (!history.tryPush(model, {}, "insertText", diff));
        const undoState = history.undo(model);
        expect(undoState.caret).toEqual(firstCaret);
        expect(undoState.parts).toEqual(["hello"]);
        expect(history.canUndo()).toEqual(false);
        expect(keystrokeCount).toEqual(MAX_STEP_LENGTH + 1); // +1 before we type before checking
    });
    it('history step is added at word boundary', function() {
        const history = new HistoryManager();
        const model = {serializeParts: () => parts.slice()};
        const parts = ["h"];
        let diff = {added: "h"};
        expect(history.tryPush(model, {}, "insertText", diff)).toEqual(false);
        diff = {added: "i"};
        parts[0] = "hi";
        expect(history.tryPush(model, {}, "insertText", diff)).toEqual(false);
        diff = {added: " "};
        parts[0] = "hi ";
        const spaceCaret = {};
        expect(history.tryPush(model, spaceCaret, "insertText", diff)).toEqual(true);
        diff = {added: "y"};
        parts[0] = "hi y";
        expect(history.tryPush(model, {}, "insertText", diff)).toEqual(false);
        diff = {added: "o"};
        parts[0] = "hi yo";
        expect(history.tryPush(model, {}, "insertText", diff)).toEqual(false);
        diff = {added: "u"};
        parts[0] = "hi you";

        expect(history.canUndo()).toEqual(true);
        const undoResult = history.undo(model);
        expect(undoResult.caret).toEqual(spaceCaret);
        expect(undoResult.parts).toEqual(["hi "]);
    });
    it('keystroke that didn\'t add a step can undo', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        const firstCaret = {};
        history.tryPush(model, {});
        parts[0] = "helloo";
        const result = history.tryPush(model, {}, "insertText", {added: "o"});
        expect(result).toEqual(false);
        expect(history.canUndo()).toEqual(true);
        const undoState = history.undo(model);
        expect(undoState.caret).toEqual(firstCaret);
        expect(undoState.parts).toEqual(["hello"]);
    });
    it('undo after keystroke that didn\'t add a step is able to redo', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        history.tryPush(model, {});
        parts[0] = "helloo";
        const caret = {last: true};
        history.tryPush(model, caret, "insertText", {added: "o"});
        history.undo(model);
        expect(history.canRedo()).toEqual(true);
        const redoState = history.redo();
        expect(redoState.caret).toEqual(caret);
        expect(redoState.parts).toEqual(["helloo"]);
    });
    it('overwriting text always stores a step', function() {
        const history = new HistoryManager();
        const parts = ["hello"];
        const model = {serializeParts: () => parts.slice()};
        const firstCaret = {};
        history.tryPush(model, firstCaret);
        const diff = {at: 1, added: "a", removed: "e"};
        const result = history.tryPush(model, {}, "insertText", diff);
        expect(result).toEqual(true);
    });
});
