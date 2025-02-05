/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";

import EditorModel from "../../../src/editor/model";
import { htmlSerializeFromMdIfNeeded, htmlSerializeIfNeeded } from "../../../src/editor/serialize";
import { createPartCreator } from "./mock";
import { type IConfigOptions } from "../../../src/IConfigOptions";
import SettingsStore from "../../../src/settings/SettingsStore";
import SdkConfig from "../../../src/SdkConfig";

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
        it("displaynames containing a newline work", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.userPill("Display\nname", "@user:server")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<a href="https://matrix.to/#/@user:server">Display<br>name</a>');
        });
        it("escaped markdown should not retain backslashes", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("*hello* world");
        });
        it("escaped markdown should not retain backslashes around other markdown", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* **world**")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("*hello* <strong>world</strong>");
        });
        it("escaped markdown should convert HTML entities", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("\\*hello\\* world < hey world!")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe("*hello* world &lt; hey world!");
        });

        it("lists with a single empty item are not considered markdown", function () {
            const pc = createPartCreator();

            const model1 = new EditorModel([pc.plain("-")], pc);
            const html1 = htmlSerializeIfNeeded(model1, {});
            expect(html1).toBe(undefined);

            const model2 = new EditorModel([pc.plain("* ")], pc);
            const html2 = htmlSerializeIfNeeded(model2, {});
            expect(html2).toBe(undefined);

            const model3 = new EditorModel([pc.plain("2021.")], pc);
            const html3 = htmlSerializeIfNeeded(model3, {});
            expect(html3).toBe(undefined);
        });

        it("lists with a single non-empty item are still markdown", function () {
            const pc = createPartCreator();
            const model = new EditorModel([pc.plain("2021. foo")], pc);
            const html = htmlSerializeIfNeeded(model, {});
            expect(html).toBe('<ol start="2021">\n<li>foo</li>\n</ol>\n');
        });
        describe("with permalink_prefix set", function () {
            const sdkConfigGet = SdkConfig.get;
            beforeEach(() => {
                jest.spyOn(SdkConfig, "get").mockImplementation((key: keyof IConfigOptions, altCaseName?: string) => {
                    if (key === "permalink_prefix") {
                        return "https://element.fs.tld";
                    } else return sdkConfigGet(key, altCaseName);
                });
            });

            it("user pill uses matrix.to", function () {
                const pc = createPartCreator();
                const model = new EditorModel([pc.userPill("Alice", "@alice:hs.tld")], pc);
                const html = htmlSerializeIfNeeded(model, {});
                expect(html).toBe('<a href="https://matrix.to/#/@alice:hs.tld">Alice</a>');
            });
            it("room pill uses matrix.to", function () {
                const pc = createPartCreator();
                const model = new EditorModel([pc.roomPill("#room:hs.tld")], pc);
                const html = htmlSerializeIfNeeded(model, {});
                expect(html).toBe('<a href="https://matrix.to/#/#room:hs.tld">#room:hs.tld</a>');
            });
            afterEach(() => {
                mocked(SdkConfig.get).mockRestore();
            });
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
        it("should treat tags not in allowlist as plaintext", () => {
            const html = htmlSerializeFromMdIfNeeded("<b>test</b>", {});
            expect(html).toBeUndefined();
        });
        it("should treat tags not in allowlist as plaintext even if escaped", () => {
            const html = htmlSerializeFromMdIfNeeded("\\<b>test</b>", {});
            expect(html).toBe("&lt;b&gt;test&lt;/b&gt;");
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
