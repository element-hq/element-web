/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

import { getCaretOffsetAndText } from "./dom";
import EditorModel from "./model";
import { CARET_NODE_CHAR, renderModel } from "./render";
import { createPartCreator } from "./__mocks__";

vi.mock("../customisations/Media", () => ({
    mediaFromMxc: () => ({ srcHttp: "https://example.org/wave" }),
}));

describe("editor/dom", () => {
    it("preserves a custom emote when text is entered after it", async () => {
        const partCreator = createPartCreator();
        const emote = partCreator.customEmote("wave", "mxc://example.org/wave");
        const model = new EditorModel([emote], partCreator);
        const editor = document.createElement("div");
        renderModel(editor, model);

        const caretNode = editor.querySelector<HTMLElement>(".caretNode:last-child")!;
        caretNode.textContent = `${CARET_NODE_CHAR}x`;
        const { caret, text } = getCaretOffsetAndText(editor, {
            focusNode: caretNode.firstChild,
            focusOffset: 2,
        } as Selection);

        expect(text).toBe(":wave:x");
        expect(caret.offset).toBe(7);

        await model.update(text, "insertText", caret);

        expect(model.parts).toHaveLength(2);
        expect(model.parts[0]).toBe(emote);
        expect(model.parts[1].text).toBe("x");
    });
});
