/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import EditorModel from "./model";
import HistoryManager from "./history";
import { createPartCreator, createRenderer, type MockAutoComplete } from "./__mocks__";
import DocumentOffset from "./offset";
import { type PillPart } from "./parts";
import type DocumentPosition from "./position";

describe("editor/model", function () {
    describe("plain text manipulation", function () {
        it("insert text into empty document", async function () {
            const renderer = createRenderer();
            const model = new EditorModel([], createPartCreator(), renderer);
            await model.update("hello", "insertText", new DocumentOffset(5, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(5);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
        });
        it("append text to existing document", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            await model.update("hello world", "insertText", new DocumentOffset(11, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello world");
        });
        it("prepend text to existing document", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("world")], pc, renderer);
            await model.update("hello world", "insertText", new DocumentOffset(6, false));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(6);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello world");
        });
    });
    describe("handling line breaks", function () {
        it("insert new line into existing document", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            await model.update("hello\n", "insertText", new DocumentOffset(6, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(1);
            expect((renderer.caret as DocumentPosition).offset).toBe(1);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello");
            expect(model.parts[1].type).toBe("newline");
            expect(model.parts[1].text).toBe("\n");
        });
        it("insert multiple new lines into existing document", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello")], pc, renderer);
            await model.update("hello\n\n\nworld!", "insertText", new DocumentOffset(14, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(4);
            expect((renderer.caret as DocumentPosition).offset).toBe(6);
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
        it("type in empty line", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel(
                [pc.plain("hello"), pc.newline(), pc.newline(), pc.plain("world")],
                pc,
                renderer,
            );
            await model.update("hello\nwarm\nworld", "insertText", new DocumentOffset(10, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(2);
            expect((renderer.caret as DocumentPosition).offset).toBe(4);
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
    describe("non-editable part manipulation", function () {
        it("typing at start of non-editable part prepends", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("try "), pc.roomPill("#someroom")], pc, renderer);
            await model.update("try foo#someroom", "insertText", new DocumentOffset(7, false));
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(7);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try foo");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#someroom");
        });
        it("typing in middle of non-editable part appends", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("try "), pc.roomPill("#someroom"), pc.plain("?")], pc, renderer);
            await model.update("try #some perhapsroom?", "insertText", new DocumentOffset(17, false));
            expect((renderer.caret as DocumentPosition).index).toBe(2);
            expect((renderer.caret as DocumentPosition).offset).toBe(8);
            expect(model.parts.length).toBe(3);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#someroom");
            expect(model.parts[2].type).toBe("plain");
            expect(model.parts[2].text).toBe(" perhaps?");
        });
        it("remove non-editable part with backspace", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.roomPill("#someroom")], pc, renderer);
            await model.update("#someroo", "deleteContentBackward", new DocumentOffset(8, true));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(-1);
            expect((renderer.caret as DocumentPosition).offset).toBe(0);
            expect(model.parts.length).toBe(0);
        });
        it("remove non-editable part with delete", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([pc.roomPill("#someroom")], pc, renderer);
            await model.update("someroom", "deleteContentForward", new DocumentOffset(0, false));
            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(-1);
            expect((renderer.caret as DocumentPosition).offset).toBe(0);
            expect(model.parts.length).toBe(0);
        });
    });
    describe("auto-complete", function () {
        it("insert user pill", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "@alice", text: "Alice" } as PillPart]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            await model.update("hello @a", "insertText", new DocumentOffset(8, true));

            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(1);
            expect((renderer.caret as DocumentPosition).offset).toBe(2);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("pill-candidate");
            expect(model.parts[1].text).toBe("@a");

            // this is a hacky mock function
            (model.autoComplete as unknown as MockAutoComplete).tryComplete();

            expect(renderer.count).toBe(2);
            expect((renderer.caret as DocumentPosition).index).toBe(1);
            expect((renderer.caret as DocumentPosition).offset).toBe(5);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("user-pill");
            expect(model.parts[1].text).toBe("Alice");
        });

        it("reverses a confirmed completion with a single undo", async function () {
            const history = new HistoryManager();
            const pc = createPartCreator([{ resourceId: "@alice", text: "Alice" } as PillPart]);
            // Stands in for the composer, which pushes every update it is told about onto the
            // undo stack.
            const model: EditorModel = new EditorModel([pc.plain("hello ")], pc, (caret) =>
                history.tryPush(model, caret),
            );

            await model.update("hello @a", "insertText", new DocumentOffset(8, true));
            history.ensureLastChangesPushed(model);
            const autoComplete = model.autoComplete as unknown as MockAutoComplete;
            autoComplete.tryComplete();
            // Confirming a completion closes the autocomplete a second time, which is what used to
            // put an identical second state on the undo stack.
            autoComplete.close();

            const undone = history.undo(model);
            expect(undone).toBeTruthy();
            expect(undone!.parts.map((p) => p.text)).toEqual(["hello ", "@a"]);
        });

        it("does not report the redundant close which follows a completion", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "@alice", text: "Alice" } as PillPart]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            await model.update("hello @a", "insertText", new DocumentOffset(8, true));
            const autoComplete = model.autoComplete as unknown as MockAutoComplete;
            autoComplete.tryComplete();
            expect(renderer.count).toBe(2);

            autoComplete.close();

            expect(renderer.count).toBe(2);
        });

        it("insert room pill", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#riot-dev" } as PillPart]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            await model.update("hello #r", "insertText", new DocumentOffset(8, true));

            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(1);
            expect((renderer.caret as DocumentPosition).offset).toBe(2);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("pill-candidate");
            expect(model.parts[1].text).toBe("#r");

            // this is a hacky mock function
            (model.autoComplete as unknown as MockAutoComplete).tryComplete();

            expect(renderer.count).toBe(2);
            expect((renderer.caret as DocumentPosition).index).toBe(1);
            expect((renderer.caret as DocumentPosition).offset).toBe(9);
            expect(model.parts.length).toBe(2);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#riot-dev");
        });

        it("type after inserting pill", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#riot-dev" } as PillPart]);
            const model = new EditorModel([pc.plain("hello ")], pc, renderer);

            await model.update("hello #r", "insertText", new DocumentOffset(8, true));
            // this is a hacky mock function
            (model.autoComplete as unknown as MockAutoComplete).tryComplete();
            await model.update("hello #riot-dev!!", "insertText", new DocumentOffset(17, true));

            expect(renderer.count).toBe(3);
            expect((renderer.caret as DocumentPosition).index).toBe(2);
            expect((renderer.caret as DocumentPosition).offset).toBe(2);
            expect(model.parts.length).toBe(3);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("hello ");
            expect(model.parts[1].type).toBe("room-pill");
            expect(model.parts[1].text).toBe("#riot-dev");
            expect(model.parts[2].type).toBe("plain");
            expect(model.parts[2].text).toBe("!!");
        });

        it("pasting text does not trigger auto-complete", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#define-room" } as PillPart]);
            const model = new EditorModel([pc.plain("try ")], pc, renderer);

            await model.update("try #define", "insertFromPaste", new DocumentOffset(11, true));

            expect(model.autoComplete).toBeFalsy();
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try #define");
        });

        it("dropping text does not trigger auto-complete", async function () {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#define-room" } as PillPart]);
            const model = new EditorModel([pc.plain("try ")], pc, renderer);

            await model.update("try #define", "insertFromDrop", new DocumentOffset(11, true));

            expect(model.autoComplete).toBeFalsy();
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(11);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("try #define");
        });

        it("insert room pill without splitting at the colon", async () => {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#room:server" } as PillPart]);
            const model = new EditorModel([], pc, renderer);

            await model.update("#roo", "insertText", new DocumentOffset(4, true));

            expect(renderer.count).toBe(1);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#roo");

            await model.update("#room:s", "insertText", new DocumentOffset(7, true));

            expect(renderer.count).toBe(2);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#room:s");
        });

        it("allow typing e-mail addresses without splitting at the @", async () => {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "@alice", text: "Alice" } as PillPart]);
            const model = new EditorModel([], pc, renderer);

            await model.update("foo@a", "insertText", new DocumentOffset(5, true));

            expect(renderer.count).toBe(1);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("plain");
            expect(model.parts[0].text).toBe("foo@a");
        });

        it("should allow auto-completing multiple times with resets between them", async () => {
            const renderer = createRenderer();
            const pc = createPartCreator([{ resourceId: "#riot-dev" } as PillPart]);
            const model = new EditorModel([pc.plain("")], pc, renderer);

            await model.update("#r", "insertText", new DocumentOffset(8, true));

            expect(renderer.count).toBe(1);
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(2);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#r");

            // this is a hacky mock function
            (model.autoComplete as unknown as MockAutoComplete).tryComplete();

            expect(renderer.count).toBe(2);
            expect((renderer.caret as DocumentPosition).index).toBe(0);
            expect((renderer.caret as DocumentPosition).offset).toBe(9);
            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("room-pill");
            expect(model.parts[0].text).toBe("#riot-dev");

            model.reset([]);
            await model.update("#r", "insertText", new DocumentOffset(8, true));

            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("pill-candidate");
            expect(model.parts[0].text).toBe("#r");

            // this is a hacky mock function
            (model.autoComplete as unknown as MockAutoComplete).tryComplete();

            expect(model.parts.length).toBe(1);
            expect(model.parts[0].type).toBe("room-pill");
            expect(model.parts[0].text).toBe("#riot-dev");
        });
    });
    describe("emojis", function () {
        it("regional emojis should be separated to prevent them to be converted to flag", async () => {
            const renderer = createRenderer();
            const pc = createPartCreator();
            const model = new EditorModel([], pc, renderer);
            const regionalEmojiA = String.fromCodePoint(127462);
            const regionalEmojiZ = String.fromCodePoint(127487);
            const caret = new DocumentOffset(0, true);

            const regionalEmojis: string[] = [];
            regionalEmojis.push(regionalEmojiA);
            regionalEmojis.push(regionalEmojiZ);
            for (let i = 0; i < 2; i++) {
                const position = model.positionForOffset(caret.offset, caret.atNodeEnd);
                await model.transform(() => {
                    const addedLen = model.insert(pc.plainWithEmoji(regionalEmojis[i]), position);
                    caret.offset += addedLen;
                    return model.positionForOffset(caret.offset, true);
                });
            }

            expect(model.parts.length).toBeGreaterThanOrEqual(4);
            expect(model.parts[0].type).toBe("emoji");
            expect(model.parts[1].type).not.toBe("emoji");
            expect(model.parts[2].type).toBe("emoji");
            expect(model.parts[3].type).not.toBe("emoji");
        });
    });
});
