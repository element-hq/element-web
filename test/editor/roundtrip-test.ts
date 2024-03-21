/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { parseEvent } from "../../src/editor/deserialize";
import EditorModel from "../../src/editor/model";
import DocumentOffset from "../../src/editor/offset";
import { htmlSerializeIfNeeded, textSerialize } from "../../src/editor/serialize";
import { createPartCreator } from "./mock";

function htmlMessage(formattedBody: string, msgtype = "m.text") {
    return {
        getContent() {
            return {
                msgtype,
                format: "org.matrix.custom.html",
                formatted_body: formattedBody,
            };
        },
    } as unknown as MatrixEvent;
}

async function md2html(markdown: string): Promise<string> {
    const pc = createPartCreator();
    const oldModel = new EditorModel([], pc, () => {});
    await oldModel.update(markdown, "insertText", new DocumentOffset(markdown.length, false));
    return htmlSerializeIfNeeded(oldModel, { forceHTML: true })!;
}

function html2md(html: string): string {
    const pc = createPartCreator();
    const parts = parseEvent(htmlMessage(html), pc);
    const newModel = new EditorModel(parts, pc);
    return textSerialize(newModel);
}

async function roundTripMarkdown(markdown: string): Promise<string> {
    return html2md(await md2html(markdown));
}

async function roundTripHtml(html: string): Promise<string> {
    return await md2html(html2md(html));
}

describe("editor/roundtrip", function () {
    describe("markdown messages should round-trip if they contain", function () {
        test.each([
            ["newlines", "hello\nworld"],
            ["pills", "text message for @room"],
            ["pills with interesting characters in mxid", "text message for @alice\\\\\\_\\]#>&:hs.example.com"],
            ["styling", "**bold** and _emphasised_"],
            ["bold within a word", "abso**fragging**lutely"],
            ["escaped html", "a\\<foo>b"],
            ["escaped markdown", "\\*\\*foo\\*\\* \\_bar\\_ \\[a\\](b)"],
            ["escaped backslashes", "C:\\\\Program Files"],
            ["code in backticks", "foo ->`x`"],
            ["code blocks containing backticks", "```\nfoo ->`x`\nbar\n```"],
            ["code blocks containing markdown", "```\n__init__.py\n```"],
            ["nested formatting", "a<del>b **c _d_ e** f</del>g"],
            ["an ordered list", "A\n\n1. b\n2. c\n3. d\nE"],
            ["an ordered list starting later", "A\n\n9. b\n10. c\n11. d\nE"],
            ["an unordered list", "A\n\n- b\n- c\n- d\nE"],
            ["code block followed by text after a blank line", "```A\nfoo(bar).baz();\n\n3\n```\n\nB"],
            ["just a code block", "```\nfoo(bar).baz();\n\n3\n```"],
            ["code block with language specifier", "```bash\nmake install\n\n```"],
            ["inline code", "there's no place `127.0.0.1` like"],
            ["nested quotations", "saying\n\n> > foo\n\n> NO\n\nis valid"],
            ["quotations", "saying\n\n> NO\n\nis valid"],
            ["links", "click [this](http://example.com/)!"],
        ])("%s", async (_name, markdown) => {
            expect(await roundTripMarkdown(markdown)).toEqual(markdown);
        });

        test.skip.each([
            // Removes trailing spaces
            ["a code block followed by newlines", "```\nfoo(bar).baz();\n\n3\n```\n\n"],
            // Adds a space after the code block
            ["a code block surrounded by text", "```A\nfoo(bar).baz();\n\n3\n```\nB"],
            // Adds a space before the list
            ["an unordered list directly preceded by text", "A\n- b\n- c\n- d\nE"],
            // Re-numbers to 1, 2, 3
            ["an ordered list where everything is 1", "A\n\n1. b\n1. c\n1. d\nE"],
            // Adds a space before the list
            ["an ordered list directly preceded by text", "A\n1. b\n2. c\n3. d\nE"],
            // Adds and removes spaces before the nested list
            ["nested unordered lists", "A\n- b\n- c\n    - c1\n    - c2\n- d\nE"],
            // Adds and removes spaces before the nested list
            ["nested ordered lists", "A\n\n1. b\n2. c\n    1. c1\n    2. c2\n3. d\nE"],
            // Adds and removes spaces before the nested list
            ["nested mixed lists", "A\n\n1. b\n2. c\n    - c1\n    - c2\n3. d\nE"],
            // Backslashes get doubled
            ["backslashes", "C:\\Program Files"],
            // Deletes the whitespace
            ["newlines with trailing and leading whitespace", "hello \n world"],
            // Escapes the underscores
            ["underscores within a word", "abso_fragging_lutely"],
            // Includes the trailing text into the quotation
            // https://github.com/vector-im/element-web/issues/22341
            ["quotations without separating newlines", "saying\n> NO\nis valid"],
            // Removes trailing and leading whitespace
            ["quotations with trailing and leading whitespace", "saying \n\n> NO\n\n is valid"],
        ])("%s", async (_name, markdown) => {
            expect(await roundTripMarkdown(markdown)).toEqual(markdown);
        });

        it("styling, but * becomes _ and __ becomes **", async function () {
            expect(await roundTripMarkdown("__bold__ and *emphasised*")).toEqual("**bold** and _emphasised_");
        });
    });

    describe("HTML messages should round-trip if they contain", function () {
        test.each([
            ["backslashes", "C:\\Program Files"],
            [
                "nested blockquotes",
                "<blockquote>\n<p>foo</p>\n<blockquote>\n<p>bar</p>\n</blockquote>\n</blockquote>\n",
            ],
            ["ordered lists", "<ol>\n<li>asd</li>\n<li>fgd</li>\n</ol>\n"],
            ["ordered lists starting later", '<ol start="3">\n<li>asd</li>\n<li>fgd</li>\n</ol>\n'],
            ["unordered lists", "<ul>\n<li>asd</li>\n<li>fgd</li>\n</ul>\n"],
            ["code blocks with surrounding text", "<p>a</p>\n<pre><code>a\ny;\n</code></pre>\n<p>b</p>\n"],
            ["code blocks", "<pre><code>a\ny;\n</code></pre>\n"],
            ["code blocks containing markdown", "<pre><code>__init__.py\n</code></pre>\n"],
            ["code blocks with language specifier", '<pre><code class="language-bash">__init__.py\n</code></pre>\n'],
            ["paragraphs including formatting", "<p>one</p>\n<p>t <em>w</em> o</p>\n"],
            ["paragraphs", "<p>one</p>\n<p>two</p>\n"],
            ["links", "http://more.example.com/"],
            ["escaped html", "This &gt;em&lt;isn't&gt;em&lt; important"],
            ["markdown-like symbols", "You _would_ **type** [a](http://this.example.com) this."],
            ["formatting within a word", "abso<strong>fragging</strong>lutely"],
            ["formatting", "This <em>is</em> im<strong>port</strong>ant"],
            ["line breaks", "one<br>two"],
        ])("%s", async (_name, html) => {
            expect(await roundTripHtml(html)).toEqual(html);
        });

        test.skip.each([
            // Strips out the pill - maybe needs some user lookup to work?
            ["user pills", '<a href="https://matrix.to/#/@alice:hs.tld">Alice</a>'],
            // Appends a slash to the URL
            // https://github.com/vector-im/element-web/issues/22342
            ["links without trailing slashes", 'Go <a href="http://more.example.com">here</a> to see more'],
            // Inserts newlines after tags
            ["paragraphs without newlines", "<p>one</p><p>two</p>"],
            // Inserts a code block
            ["nested lists", "<ol>\n<li>asd</li>\n<li>\n<ul>\n<li>fgd</li>\n<li>sdf</li>\n</ul>\n</li>\n</ol>\n"],
        ])("%s", async (_name, html) => {
            expect(await roundTripHtml(html)).toEqual(html);
        });
    });
});
