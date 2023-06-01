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
import { htmlSerializeIfNeeded } from "../../src/editor/serialize";
import { createPartCreator } from "./mock";
import SettingsStore from "../../src/settings/SettingsStore";

describe("editor/serialize", function () {
    describe("with markdown", function () {
        it("user pill turns message into html", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Alice", "@alice:hs.tld")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/@alice:hs.tld">Alice</a>');
        });
        it("room pill turns message into html", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.roomPill("#room:hs.tld")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/#room:hs.tld">#room:hs.tld</a>');
        });
        it("@room pill turns message into html", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.atRoomPill("@room")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBeFalsy();
        });
        it("any markdown turns message into html", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("*hello* world")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("<em>hello</em> world");
        });
        it("displaynames ending in a backslash work", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Displayname\\", "@user:server")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/@user:server">Displayname\\</a>');
        });
        it("displaynames containing an opening square bracket work", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Displayname[[", "@user:server")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/@user:server">Displayname[[</a>');
        });
        it("displaynames containing a closing square bracket work", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Displayname]", "@user:server")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/@user:server">Displayname]</a>');
        });
        it("escaped markdown should not retain backslashes", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("*hello* world");
        });
        it("escaped markdown should convert HTML entities", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world < hey world!")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("*hello* world &lt; hey world!");
        });
    });

    describe("with plaintext", function () {
        it("markdown remains plaintext", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("*hello* world")], pc);
            const html = htmlSerializeIfNeeded(model, { useMarkdown: false });
            expect(html).toBe("*hello* world");
        });
        it("markdown should retain backslashes", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world")], pc);
            const html = htmlSerializeIfNeeded(model, { useMarkdown: false });
            expect(html).toBe("\\*hello\\* world");
        });
        it("markdown should convert HTML entities", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world < hey world!")], pc);
            const html = htmlSerializeIfNeeded(model, { useMarkdown: false });
            expect(html).toBe("\\*hello\\* world &lt; hey world!");
        });

        it("plaintext remains plaintext even when forcing html", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello world")], pc);
            const html = htmlSerializeIfNeeded(model, { forceHTML: true, useMarkdown: false });
            expect(html).toBe("hello world");
        });
    });

    describe("feature_latex_maths", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_latex_maths");
        });

        it("should support inline katex", () => {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello $\\xi$ world")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toMatchInlineSnapshot(`"hello <span data-mx-maths="\\xi"><code>\\xi</code></span> world"`);
        });

        it("should support block katex", () => {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello \n$$\\xi$$\n world")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toMatchInlineSnapshot(`
                "<p>hello</p>
                <div data-mx-maths="\\xi"><code>\\xi</code></div>
                <p>world</p>
                "
            `);
        });

        it("should not mangle code blocks", () => {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("hello\n```\n$\\xi$\n```\nworld")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toMatchInlineSnapshot(`
                "<p>hello</p>
                <pre><code>$\\xi$
                </code></pre>
                <p>world</p>
                "
            `);
        });
    });
});
