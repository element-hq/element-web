/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import {toggleInlineFormat} from "../../src/editor/operations";

const SERIALIZED_NEWLINE = {"text": "\n", "type": "newline"};

describe('editor/operations: formatting operations', () => {
    describe('toggleInlineFormat', () => {
        it('works for words', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello world!"),
            ], pc, renderer);

            const range = model.startRange(model.positionForOffset(6, false),
                model.positionForOffset(11, false));  // around "world"

            expect(range.parts[0].text).toBe("world");
            expect(model.serializeParts()).toEqual([{"text": "hello world!", "type": "plain"}]);
            toggleInlineFormat(range, "_");
            expect(model.serializeParts()).toEqual([{"text": "hello _world_!", "type": "plain"}]);
        });

        it('works for parts of words', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello world!"),
            ], pc, renderer);

            const range = model.startRange(model.positionForOffset(7, false),
                model.positionForOffset(10, false));  // around "orl"

            expect(range.parts[0].text).toBe("orl");
            expect(model.serializeParts()).toEqual([{"text": "hello world!", "type": "plain"}]);
            toggleInlineFormat(range, "*");
            expect(model.serializeParts()).toEqual([{"text": "hello w*orl*d!", "type": "plain"}]);
        });

        it('works for around pills', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello there "),
                pc.atRoomPill("@room"),
                pc.plain(", how are you doing?"),
            ], pc, renderer);

            const range = model.startRange(model.positionForOffset(6, false),
                model.positionForOffset(30, false));  // around "there @room, how are you"

            expect(range.parts.map(p => p.text).join("")).toBe("there @room, how are you");
            expect(model.serializeParts()).toEqual([
                {"text": "hello there ", "type": "plain"},
                {"text": "@room", "type": "at-room-pill"},
                {"text": ", how are you doing?", "type": "plain"},
            ]);
            toggleInlineFormat(range, "_");
            expect(model.serializeParts()).toEqual([
                {"text": "hello _there ", "type": "plain"},
                {"text": "@room", "type": "at-room-pill"},
                {"text": ", how are you_ doing?", "type": "plain"},
            ]);
        });

        it('works for a paragraph', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello world,"),
                pc.newline(),
                pc.plain("how are you doing?"),
            ], pc, renderer);

            const range = model.startRange(model.positionForOffset(6, false),
                model.positionForOffset(16, false));  // around "world,\nhow"

            expect(range.parts.map(p => p.text).join("")).toBe("world,\nhow");
            expect(model.serializeParts()).toEqual([
                {"text": "hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?", "type": "plain"},
            ]);
            toggleInlineFormat(range, "**");
            expect(model.serializeParts()).toEqual([
                {"text": "hello **world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how** are you doing?", "type": "plain"},
            ]);
        });

        it('works for a paragraph with spurious breaks around it in selected range', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.newline(),
                pc.newline(),
                pc.plain("hello world,"),
                pc.newline(),
                pc.plain("how are you doing?"),
                pc.newline(),
                pc.newline(),
            ], pc, renderer);

            const range = model.startRange(model.positionForOffset(0, false), model.getPositionAtEnd());  // select-all

            expect(range.parts.map(p => p.text).join("")).toBe("\n\nhello world,\nhow are you doing?\n\n");
            expect(model.serializeParts()).toEqual([
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
                {"text": "hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?", "type": "plain"},
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
            ]);
            toggleInlineFormat(range, "**");
            expect(model.serializeParts()).toEqual([
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
                {"text": "**hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?**", "type": "plain"},
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
            ]);
        });

        it('works for multiple paragraph', () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([
                pc.plain("hello world,"),
                pc.newline(),
                pc.plain("how are you doing?"),
                pc.newline(),
                pc.newline(),
                pc.plain("new paragraph"),
            ], pc, renderer);

            let range = model.startRange(model.positionForOffset(0, true), model.getPositionAtEnd()); // select-all

            expect(model.serializeParts()).toEqual([
                {"text": "hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?", "type": "plain"},
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
                {"text": "new paragraph", "type": "plain"},
            ]);
            toggleInlineFormat(range, "__");
            expect(model.serializeParts()).toEqual([
                {"text": "__hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?__", "type": "plain"},
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
                {"text": "__new paragraph__", "type": "plain"},
            ]);
            range = model.startRange(model.positionForOffset(0, true), model.getPositionAtEnd()); // select-all
            console.log("RANGE", range.parts);
            toggleInlineFormat(range, "__");
            expect(model.serializeParts()).toEqual([
                {"text": "hello world,", "type": "plain"},
                SERIALIZED_NEWLINE,
                {"text": "how are you doing?", "type": "plain"},
                SERIALIZED_NEWLINE,
                SERIALIZED_NEWLINE,
                {"text": "new paragraph", "type": "plain"},
            ]);
        });
    });
});
