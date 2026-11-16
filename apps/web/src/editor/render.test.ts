/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import EditorModel from "./model";
import { renderModel } from "./render";
import { createPartCreator } from "./__mocks__";
import { type Part } from "./parts";

function render(
    makeParts: (pc: ReturnType<typeof createPartCreator>) => Part[],
    editor = document.createElement("div"),
) {
    const pc = createPartCreator();
    renderModel(editor, new EditorModel(makeParts(pc), pc));
    return editor;
}

describe("editor/render", () => {
    it("renders an empty composer as one empty line without a <br>", () => {
        // a <br> here would be highlighted on select-all (#10789)
        expect(render(() => []).innerHTML).toBe("<div></div>");
    });

    it("keeps a <br> in empty lines between text", () => {
        const editor = render((pc) => [pc.plain("one"), pc.newline(), pc.newline(), pc.plain("three")]);
        expect(editor.innerHTML).toBe("<div>one</div><div><br></div><div>three</div>");
    });

    it("keeps a <br> in a trailing empty line", () => {
        const editor = render((pc) => [pc.plain("one"), pc.newline()]);
        expect(editor.innerHTML).toBe("<div>one</div><div><br></div>");
    });

    it("removes the <br> when the composer becomes empty again", () => {
        const editor = render((pc) => [pc.plain("one"), pc.newline()]);
        render(() => [], editor);
        expect(editor.innerHTML).toBe("<div></div>");
    });
});
