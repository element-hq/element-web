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
import EditorModel from "../../src/editor/model";
import {PartCreator} from "../../src/editor/parts";

class MockAutoComplete {
    constructor(updateCallback, partCreator, completions) {
        this._updateCallback = updateCallback;
        this._partCreator = partCreator;
        this._completions = completions;
        this._part = null;
    }

    close() {
        this._updateCallback({close: true});
    }

    tryComplete(close = true) {
        const matches = this._completions.filter(o => {
            return o.resourceId.startsWith(this._part.text);
        });
        if (matches.length === 1 && this._part.text.length > 1) {
            const match = matches[0];
            let pill;
            if (match.resourceId[0] === "@") {
                pill = this._partCreator.userPill(match.label, match.resourceId);
            } else {
                pill = this._partCreator.roomPill(match.resourceId);
            }
            this._updateCallback({replacePart: pill, close});
        }
    }

    // called by EditorModel when typing into pill-candidate part
    onPartUpdate(part, offset) {
        this._part = part;
    }
}

// MockClient & MockRoom are only used for avatars in room and user pills,
// which is not tested
class MockClient {
    getRooms() { return []; }
    getRoom() { return null; }
}

class MockRoom {
    getMember() { return null; }
}

function createPartCreator(completions = []) {
    const autoCompleteCreator = (partCreator) => {
        return (updateCallback) => new MockAutoComplete(updateCallback, partCreator, completions);
    };
    return new PartCreator(autoCompleteCreator, new MockRoom(), new MockClient());
}

function createRenderer() {
    const render = (c) => {
        render.caret = c;
        render.count += 1;
    };
    render.count = 0;
    render.caret = null;
    return render;
}

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

            model.autoComplete.tryComplete();

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

            model.autoComplete.tryComplete();

            expect(renderer.count).toBe(2);
            expect(renderer.caret.index).toBe(1);
            expect(renderer.caret.offset).toBe(9);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#riot-dev");
        });
        // paste circumvents AC
    });
});
