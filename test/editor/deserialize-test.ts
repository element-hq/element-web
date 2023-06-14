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
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { parseEvent } from "../../src/editor/deserialize";
import { Part } from "../../src/editor/parts";
import { createPartCreator } from "./mock";

const FOUR_SPACES = " ".repeat(4);

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

function textMessage(body: string, msgtype = "m.text") {
    return {
        getContent() {
            return {
                msgtype,
                body,
            };
        },
    } as unknown as MatrixEvent;
}

function textMessageReply(body: string, msgtype = "m.text") {
    return {
        ...textMessage(body, msgtype),
        replyEventId: "!foo:bar",
    } as unknown as MatrixEvent;
}

function mergeAdjacentParts(parts: Part[]) {
    let prevPart: Part | undefined;
    for (let i = 0; i < parts.length; ++i) {
        let part: Part | undefined = parts[i];
        const isEmpty = !part.text.length;
        const isMerged = !isEmpty && prevPart && prevPart.merge?.(part);
        if (isEmpty || isMerged) {
            // remove empty or merged part
            part = prevPart;
            parts.splice(i, 1);
            //repeat this index, as it's removed now
            --i;
        }
        prevPart = part;
    }
}

function normalize(parts: Part[]) {
    // merge adjacent parts as this will happen
    // in the model anyway, and whether 1 or multiple
    // plain parts are returned is an implementation detail
    mergeAdjacentParts(parts);
    // convert to data objects for easier asserting
    return parts.map((p) => p.serialize());
}

describe("editor/deserialize", function () {
    describe("text messages", function () {
        it("test with newlines", function () {
            const parts = normalize(parseEvent(textMessage("hello\nworld"), createPartCreator()));
            expect(parts[0]).toStrictEqual({ type: "plain", text: "hello" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "world" });
            expect(parts.length).toBe(3);
        });
        it("@room pill", function () {
            const parts = normalize(parseEvent(textMessage("text message for @room"), createPartCreator()));
            expect(parts.length).toBe(2);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "text message for " });
            expect(parts[1]).toStrictEqual({ type: "at-room-pill", text: "@room" });
        });
        it("emote", function () {
            const text = "says DON'T SHOUT!";
            const parts = normalize(parseEvent(textMessage(text, "m.emote"), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "/me says DON'T SHOUT!" });
        });
    });
    describe("html messages", function () {
        it("inline styling", function () {
            const html = "<strong>bold</strong> and <em>emphasized</em> text";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "**bold** and _emphasized_ text" });
        });
        it("hyperlink", function () {
            const html = 'click <a href="http://example.com/">this</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "click [this](http://example.com/)!" });
        });
        it("multiple lines with paragraphs", function () {
            const html = "<p>hello</p><p>world</p>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(4);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "hello" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[3]).toStrictEqual({ type: "plain", text: "world" });
        });
        it("multiple lines with line breaks", function () {
            const html = "hello<br>world";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "hello" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "world" });
        });
        it("multiple lines mixing paragraphs and line breaks", function () {
            const html = "<p>hello<br>warm</p><p>world</p>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(6);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "hello" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "warm" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[5]).toStrictEqual({ type: "plain", text: "world" });
        });
        it("quote", function () {
            const html = "<blockquote><p><em>wise</em><br><strong>words</strong></p></blockquote><p>indeed</p>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(6);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "> _wise_" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "> **words**" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[5]).toStrictEqual({ type: "plain", text: "indeed" });
        });
        it("user pill", function () {
            const html = 'Hi <a href="https://matrix.to/#/@alice:hs.tld">Alice</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "Hi " });
            expect(parts[1]).toStrictEqual({ type: "user-pill", text: "Alice", resourceId: "@alice:hs.tld" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "!" });
        });
        it("user pill with displayname containing backslash", function () {
            const html = 'Hi <a href="https://matrix.to/#/@alice:hs.tld">Alice\\</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "Hi " });
            expect(parts[1]).toStrictEqual({ type: "user-pill", text: "Alice\\", resourceId: "@alice:hs.tld" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "!" });
        });
        it("user pill with displayname containing opening square bracket", function () {
            const html = 'Hi <a href="https://matrix.to/#/@alice:hs.tld">Alice[[</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "Hi " });
            expect(parts[1]).toStrictEqual({ type: "user-pill", text: "Alice[[", resourceId: "@alice:hs.tld" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "!" });
        });
        it("user pill with displayname containing closing square bracket", function () {
            const html = 'Hi <a href="https://matrix.to/#/@alice:hs.tld">Alice]</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "Hi " });
            expect(parts[1]).toStrictEqual({ type: "user-pill", text: "Alice]", resourceId: "@alice:hs.tld" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "!" });
        });
        it("room pill", function () {
            const html = 'Try <a href="https://matrix.to/#/#room:hs.tld">#room:hs.tld</a>?';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(3);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "Try " });
            expect(parts[1]).toStrictEqual({ type: "room-pill", text: "#room:hs.tld", resourceId: "#room:hs.tld" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "?" });
        });
        it("@room pill", function () {
            const html = "<em>formatted</em> message for @room";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(2);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "_formatted_ message for " });
            expect(parts[1]).toStrictEqual({ type: "at-room-pill", text: "@room" });
        });
        it("inline code", function () {
            const html = "there is no place like <code>127.0.0.1</code>!";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "there is no place like `127.0.0.1`!" });
        });
        it("code block with no trailing text", function () {
            const html = "<pre><code>0xDEADBEEF\n</code></pre>\n";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "```" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "0xDEADBEEF" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: "```" });
        });
        // failing likely because of https://github.com/vector-im/element-web/issues/10316
        it.skip("code block with no trailing text and no newlines", function () {
            const html = "<pre><code>0xDEADBEEF</code></pre>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "```" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "0xDEADBEEF" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: "```" });
        });
        it("unordered lists", function () {
            const html = "<ul><li>Oak</li><li>Spruce</li><li>Birch</li></ul>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "- Oak" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "- Spruce" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: "- Birch" });
        });
        it("ordered lists", function () {
            const html = "<ol><li>Start</li><li>Continue</li><li>Finish</li></ol>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "1. Start" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: "2. Continue" });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: "3. Finish" });
        });
        it("nested unordered lists", () => {
            const html = "<ul><li>Oak<ul><li>Spruce<ul><li>Birch</li></ul></li></ul></li></ul>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "- Oak" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES}- Spruce` });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES.repeat(2)}- Birch` });
        });
        it("nested ordered lists", () => {
            const html = "<ol><li>Oak<ol><li>Spruce<ol><li>Birch</li></ol></li></ol></li></ol>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "1. Oak" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES}1. Spruce` });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES.repeat(2)}1. Birch` });
        });
        it("nested lists", () => {
            const html = "<ol><li>Oak\n<ol><li>Spruce\n<ol><li>Birch</li></ol></li></ol></li></ol>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(5);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "1. Oak\n" });
            expect(parts[1]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[2]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES}1. Spruce\n` });
            expect(parts[3]).toStrictEqual({ type: "newline", text: "\n" });
            expect(parts[4]).toStrictEqual({ type: "plain", text: `${FOUR_SPACES.repeat(2)}1. Birch` });
        });
        it("mx-reply is stripped", function () {
            const html = "<mx-reply>foo</mx-reply>bar";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "bar" });
        });
        it("emote", function () {
            const html = "says <em>DON'T SHOUT</em>!";
            const parts = normalize(parseEvent(htmlMessage(html, "m.emote"), createPartCreator()));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({ type: "plain", text: "/me says _DON'T SHOUT_!" });
        });
        it("preserves nested quotes", () => {
            const html = "<blockquote>foo<blockquote>bar</blockquote></blockquote>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("surrounds lists with newlines", () => {
            const html = "foo<ul><li>bar</li></ul>baz";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("preserves nested formatting", () => {
            const html = "a<sub>b<em>c<strong>d<u>e</u></strong></em></sub>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes backticks in code blocks", () => {
            const html =
                "<p><code>this → ` is a backtick</code></p>" + "<pre><code>and here are 3 of them:\n```</code></pre>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes backticks outside of code blocks", () => {
            const html = "some `backticks`";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes backslashes", () => {
            const html = "C:\\My Documents";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes asterisks", () => {
            const html = "*hello*";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes underscores", () => {
            const html = "__emphasis__";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes square brackets", () => {
            const html = "[not an actual link](https://example.org)";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
        it("escapes angle brackets", () => {
            const html = "> \\<del>no formatting here\\</del>";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator()));
            expect(parts).toMatchSnapshot();
        });
    });
    describe("plaintext messages", function () {
        it("turns html tags back into markdown", function () {
            const html = '<strong>bold</strong> and <em>emphasized</em> text <a href="http://example.com/">this</a>!';
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "**bold** and _emphasized_ text [this](http://example.com/)!",
            });
        });
        it("keeps backticks unescaped", () => {
            const html = "this → ` is a backtick and here are 3 of them:\n```";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "this → ` is a backtick and here are 3 of them:\n```",
            });
        });
        it("keeps backticks outside of code blocks", () => {
            const html = "some `backticks`";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "some `backticks`",
            });
        });
        it("keeps backslashes", () => {
            const html = "C:\\My Documents";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "C:\\My Documents",
            });
        });
        it("keeps asterisks", () => {
            const html = "*hello*";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "*hello*",
            });
        });
        it("keeps underscores", () => {
            const html = "__emphasis__";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "__emphasis__",
            });
        });
        it("keeps square brackets", () => {
            const html = "[not an actual link](https://example.org)";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "[not an actual link](https://example.org)",
            });
        });
        it("escapes angle brackets", () => {
            const html = "> &lt;del&gt;no formatting here&lt;/del&gt;";
            const parts = normalize(parseEvent(htmlMessage(html), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "> <del>no formatting here</del>",
            });
        });
        it("strips plaintext replies", () => {
            const body = "> Sender: foo\n\nMessage";
            const parts = normalize(parseEvent(textMessageReply(body), createPartCreator(), { shouldEscape: false }));
            expect(parts.length).toBe(1);
            expect(parts[0]).toStrictEqual({
                type: "plain",
                text: "Message",
            });
        });
    });
});
