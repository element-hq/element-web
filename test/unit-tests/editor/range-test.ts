/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EditorModel from "../../../src/editor/model";
import { createPartCreator, createRenderer } from "./mock";

const pillChannel = "#riot-dev:matrix.org";

describe("editor/range", function () {
    it("range on empty model", function () {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const model = new EditorModel([], pc, renderer);
        const range = model.startRange(model.positionForOffset(0, true)); // after "world"
        let called = false;
        range.expandBackwardsWhile((chr) => {
            called = true;
            return true;
        });
        expect(called).toBe(false);
        expect(range.text).toBe("");
    });
    it("range replace within a part", function () {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello world!!!!")], pc, renderer);
        const range = model.startRange(model.positionForOffset(11)); // after "world"
        range.expandBackwardsWhile((index, offset) => model.parts[index].text[offset] !== " ");
        expect(range.text).toBe("world");
        range.replace([pc.roomPill(pillChannel)]);
        expect(model.parts[0].type).toBe("plain");
        expect(model.parts[0].text).toBe("hello ");
        expect(model.parts[1].type).toBe("room-pill");
        expect(model.parts[1].text).toBe(pillChannel);
        expect(model.parts[2].type).toBe("plain");
        expect(model.parts[2].text).toBe("!!!!");
        expect(model.parts.length).toBe(3);
    });
    it("range replace across parts", function () {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const model = new EditorModel(
            [pc.plain("try to re"), pc.plain("pla"), pc.plain("ce "), pc.plain("me")],
            pc,
            renderer,
        );
        const range = model.startRange(model.positionForOffset(14)); // after "replace"
        range.expandBackwardsWhile((index, offset) => model.parts[index].text[offset] !== " ");
        expect(range.text).toBe("replace");
        range.replace([pc.roomPill(pillChannel)]);
        expect(model.parts[0].type).toBe("plain");
        expect(model.parts[0].text).toBe("try to ");
        expect(model.parts[1].type).toBe("room-pill");
        expect(model.parts[1].text).toBe(pillChannel);
        expect(model.parts[2].type).toBe("plain");
        expect(model.parts[2].text).toBe(" me");
        expect(model.parts.length).toBe(3);
    });
    // bug found while implementing tab completion
    it("replace a part with an identical part with start position at end of previous part", function () {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("hello "), pc.pillCandidate("man")], pc, renderer);
        const range = model.startRange(model.positionForOffset(9, true)); // before "man"
        range.expandBackwardsWhile((index, offset) => model.parts[index].text[offset] !== " ");
        expect(range.text).toBe("man");
        range.replace([pc.pillCandidate(range.text)]);
        expect(model.parts[0].type).toBe("plain");
        expect(model.parts[0].text).toBe("hello ");
        expect(model.parts[1].type).toBe("pill-candidate");
        expect(model.parts[1].text).toBe("man");
        expect(model.parts.length).toBe(2);
    });
    it("range trim spaces off both ends", () => {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const model = new EditorModel([pc.plain("abc abc abc")], pc, renderer);
        const range = model.startRange(
            model.positionForOffset(3, false), // at end of first `abc`
            model.positionForOffset(8, false), // at start of last `abc`
        );

        expect(range.parts[0].text).toBe(" abc ");
        range.trim();
        expect(range.parts[0].text).toBe("abc");
    });
    // test for edge case when the selection just consists of whitespace
    it("range trim just whitespace", () => {
        const renderer = createRenderer();
        const pc = createPartCreator();
        const whitespace = "  \n    \n\n";
        const model = new EditorModel([pc.plain(whitespace)], pc, renderer);
        const range = model.startRange(model.positionForOffset(0, false), model.getPositionAtEnd());

        expect(range.text).toBe(whitespace);
        range.trim();
        expect(range.text).toBe("");
    });
});
