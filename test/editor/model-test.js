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

import EditorModel from "../../src/editor/model";
import {createPartCreator, createRenderer} from "./mock";

describe('editor/model', function() {
    describe('plain text manipulation', function() {
        it('insert text into empty document', function() {
            const renderer = createRenderer();
            const model = new EditorModel([], createPartCreator(), renderer);
            model.update("hello", "insertText", {offset: 5, atNodeEnd: true});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(5);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
        });
        it('append text to existing document', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            model.update("hello world", "insertText", {offset: 11, atNodeEnd: true});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello world");
        });
        it('prepend text to existing document', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("world")], pc, renderer);
            model.update("hello world", "insertText", {offset: 6, atNodeEnd: false});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(6);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello world");
        });
    });
    describe('handling line breaks', function() {
        it('insert new line into existing document', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            model.update("hello\n", "insertText", {offset: 6, atNodeEnd: true});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(1);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
            expect(model.parts[1].type).toBe("newline");
            expect(model.parts[1].text).toBe("\n");
        });
        it('insert multiple new lines into existing document', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            model.update("hello\n\n\nworld!", "insertText", {offset: 14, atNodeEnd: true});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(4);
            expect(renderer.caret.offset).toBe(6);
            expect(model.parts.length).toBe(5);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
            expect(model.parts[1].type).toBe("newline");
            expect(model.parts[1].text).toBe("\n");
            expect(model.parts[2].type).toBe("newline");
            expect(model.parts[2].text).toBe("\n");
            expect(model.parts[3].type).toBe("newline");
            expect(model.parts[3].text).toBe("\n");
            expect(model.parts[4].type).toBe("plain");
            expect(model.parts[4].text).toBe("world!");
        });
        it('type in empty line', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello"),
                pc.newline(),
                pc.newline(),
                pc.plain("world"),
            ], pc, renderer);
            model.update("hello\nwarm\nworld", "insertText", {offset: 10, atNodeEnd: true});
            console.log(model.serializeParts());
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(2);
            expect(renderer.caret.offset).toBe(4);
            expect(model.parts.length).toBe(5);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
            expect(model.parts[1].type).toBe("newline");
            expect(model.parts[1].text).toBe("\n");
            expect(model.parts[2].type).toBe("plain");
            expect(model.parts[2].text).toBe("warm");
            expect(model.parts[3].type).toBe("newline");
            expect(model.parts[3].text).toBe("\n");
            expect(model.parts[4].type).toBe("plain");
            expect(model.parts[4].text).toBe("world");
        });
    });
    describe('non-editable part manipulation', function() {
        it('typing at start of non-editable part prepends', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("try "),
                pc.roomPill("#someroom"),
            ], pc, renderer);
            model.update("try foo#someroom", "insertText", {offset: 7, atNodeEnd: false});
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(7);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try foo");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#someroom");
        });
        it('typing in middle of non-editable part appends', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("try "),
                pc.roomPill("#someroom"),
                pc.plain("?"),
            ], pc, renderer);
            model.update("try #some perhapsroom?", "insertText", {offset: 17, atNodeEnd: false});
            expect(renderer.caret.index).toBe(2);
            expect(renderer.caret.offset).toBe(8);
            expect(model.parts.length).toBe(3);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#someroom");
            expect(model.parts[2].type).toBe("plain");
            expect(model.parts[2].text).toBe(" perhaps?");
        });
        it('remove non-editable part with backspace', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.roomPill("#someroom")], pc, renderer);
            model.update("#someroo", "deleteContentBackward", {offset: 8, atNodeEnd: true});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(-1);
            expect(renderer.caret.offset).toBe(0);
            expect(model.parts.length).toBe(0);
        });
        it('remove non-editable part with delete', function() {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.roomPill("#someroom")], pc, renderer);
            model.update("someroom", "deleteContentForward", {offset: 0, atNodeEnd: false});
            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(-1);
            expect(renderer.caret.offset).toBe(0);
            expect(model.parts.length).toBe(0);
        });
    });
    describe('auto-complete', function() {
        it('insert user pill', function() {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "@alice", label: "Alice"}]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            model.update("hello @a", "insertText", {offset: 8, atNodeEnd: true});

            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(2);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("pill-candidate");
            expect(model.parts[1].text).toBe("@a");

            model.autoComplete.tryComplete(); // see MockAutoComplete

            expect(renderer.count).toBe(2);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(5);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("user-pill");
            expect(model.parts[1].text).toBe("Alice");
        });

        it('insert room pill', function() {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "#riot-dev"}]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            model.update("hello #r", "insertText", {offset: 8, atNodeEnd: true});

            expect(renderer.count).toBe(1);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(2);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("pill-candidate");
            expect(model.parts[1].text).toBe("#r");

            model.autoComplete.tryComplete(); // see MockAutoComplete

            expect(renderer.count).toBe(2);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(9);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#riot-dev");
        });

        it('type after inserting pill', function() {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "#riot-dev"}]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            model.update("hello #r", "insertText", {offset: 8, atNodeEnd: true});
            model.autoComplete.tryComplete(); // see MockAutoComplete
            model.update("hello #riot-dev!!", "insertText", {offset: 17, atNodeEnd: true});

            expect(renderer.count).toBe(3);
            expect(renderer.caret.index).toBe(2);
            expect(renderer.caret.offset).toBe(2);
            expect(model.parts.length).toBe(3);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#riot-dev");
            expect(model.parts[2].type).toBe("plain");
            expect(model.parts[2].text).toBe("!!");
        });

        it('pasting text does not trigger auto-complete', function() {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "#define-room"}]);
            const model = new EditorModel([pc.plain("try ")], pc, renderer);

            model.update("try #define", "insertFromPaste", {offset: 11, atNodeEnd: true});

            expect(model.autoComplete).toBeFalsy();
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try #define");
        });

        it('dropping text does not trigger auto-complete', function() {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "#define-room"}]);
            const model = new EditorModel([pc.plain("try ")], pc, renderer);

            model.update("try #define", "insertFromDrop", {offset: 11, atNodeEnd: true});

            expect(model.autoComplete).toBeFalsy();
            expect(renderer.caret.index).toBe(0);
            expect(renderer.caret.offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try #define");
        });

        it('insert room pill without splitting at the colon', () => {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "#room:server"}]);
            const model = new EditorModel([], pc, renderer);

            model.update("#roo", "insertText", {offset: 4, atNodeEnd: true});

            expect(renderer.count).toBe(1);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#roo");

            model.update("#room:s", "insertText", {offset: 7, atNodeEnd: true});

            expect(renderer.count).toBe(2);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#room:s");
        });

        it('allow typing e-mail addresses without splitting at the @', () => {
            const renderer = createRenderer();
            const pc = createPartCreator([{resourceId: "@alice", label: "Alice"}]);
            const model = new EditorModel([], pc, renderer);

            model.update("foo@a", "insertText", {offset: 5, atNodeEnd: true});

            expect(renderer.count).toBe(1);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("foo@a");
        });
    });
});
