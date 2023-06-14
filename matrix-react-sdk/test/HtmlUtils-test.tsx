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

import React, { ReactElement } from "react";
import { mocked } from "jest-mock";
import { render, screen } from "@testing-library/react";
import { IContent } from "matrix-js-sdk/src/models/event";

import { bodyToHtml, formatEmojis, topicToHtml } from "../src/HtmlUtils";
import SettingsStore from "../src/settings/SettingsStore";

jest.mock("../src/settings/SettingsStore");

const enableHtmlTopicFeature = () => {
    mocked(SettingsStore).getValue.mockImplementation((arg): any => {
        return arg === "feature_html_topic";
    });
};

describe("topicToHtml", () => {
    function getContent() {
        return screen.getByRole("contentinfo").children[0].innerHTML;
    }

    it("converts plain text topic to HTML", () => {
        render(<div role="contentinfo">{topicToHtml("pizza", undefined, null, false)}</div>);
        expect(getContent()).toEqual("pizza");
    });

    it("converts plain text topic with emoji to HTML", () => {
        render(<div role="contentinfo">{topicToHtml("pizza 🍕", undefined, null, false)}</div>);
        expect(getContent()).toEqual('pizza <span class="mx_Emoji" title=":pizza:">🍕</span>');
    });

    it("converts literal HTML topic to HTML", async () => {
        enableHtmlTopicFeature();
        render(<div role="contentinfo">{topicToHtml("<b>pizza</b>", undefined, null, false)}</div>);
        expect(getContent()).toEqual("&lt;b&gt;pizza&lt;/b&gt;");
    });

    it("converts true HTML topic to HTML", async () => {
        enableHtmlTopicFeature();
        render(<div role="contentinfo">{topicToHtml("**pizza**", "<b>pizza</b>", null, false)}</div>);
        expect(getContent()).toEqual("<b>pizza</b>");
    });

    it("converts true HTML topic with emoji to HTML", async () => {
        enableHtmlTopicFeature();
        render(<div role="contentinfo">{topicToHtml("**pizza** 🍕", "<b>pizza</b> 🍕", null, false)}</div>);
        expect(getContent()).toEqual('<b>pizza</b> <span class="mx_Emoji" title=":pizza:">🍕</span>');
    });
});

describe("bodyToHtml", () => {
    function getHtml(content: IContent, highlights?: string[]): string {
        return (bodyToHtml(content, highlights, {}) as ReactElement).props.dangerouslySetInnerHTML.__html;
    }

    it("should apply highlights to HTML messages", () => {
        const html = getHtml(
            {
                body: "test **foo** bar",
                msgtype: "m.text",
                formatted_body: "test <b>foo</b> bar",
                format: "org.matrix.custom.html",
            },
            ["test"],
        );

        expect(html).toMatchInlineSnapshot(`"<span class="mx_EventTile_searchHighlight">test</span> <b>foo</b> bar"`);
    });

    it("should apply highlights to plaintext messages", () => {
        const html = getHtml(
            {
                body: "test foo bar",
                msgtype: "m.text",
            },
            ["test"],
        );

        expect(html).toMatchInlineSnapshot(`"<span class="mx_EventTile_searchHighlight">test</span> foo bar"`);
    });

    it("should not respect HTML tags in plaintext message highlighting", () => {
        const html = getHtml(
            {
                body: "test foo <b>bar",
                msgtype: "m.text",
            },
            ["test"],
        );

        expect(html).toMatchInlineSnapshot(`"<span class="mx_EventTile_searchHighlight">test</span> foo &lt;b&gt;bar"`);
    });

    it("should generate big emoji for an emoji-only reply to a message", () => {
        const { asFragment } = render(
            bodyToHtml(
                {
                    "body": "> <@sender1:server> Test\n\n🥰",
                    "format": "org.matrix.custom.html",
                    "formatted_body":
                        '<mx-reply><blockquote><a href="https://matrix.to/#/!roomId:server/$eventId">In reply to</a> <a href="https://matrix.to/#/@sender1:server">@sender1:server</a><br>Test</blockquote></mx-reply>🥰',
                    "m.relates_to": {
                        "m.in_reply_to": {
                            event_id: "$eventId",
                        },
                    },
                    "msgtype": "m.text",
                },
                [],
                {
                    stripReplyFallback: true,
                },
            ) as ReactElement,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    describe("feature_latex_maths", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_latex_maths");
        });

        it("should render inline katex", () => {
            const html = getHtml({
                body: "hello \\xi world",
                msgtype: "m.text",
                formatted_body: 'hello <span data-mx-maths="\\xi"><code>\\xi</code></span> world',
                format: "org.matrix.custom.html",
            });
            expect(html).toMatchSnapshot();
        });

        it("should render block katex", () => {
            const html = getHtml({
                body: "hello \\xi world",
                msgtype: "m.text",
                formatted_body: '<p>hello</p><div data-mx-maths="\\xi"><code>\\xi</code></div><p>world</p>',
                format: "org.matrix.custom.html",
            });
            expect(html).toMatchSnapshot();
        });

        it("should not mangle code blocks", () => {
            const html = getHtml({
                body: "hello \\xi world",
                msgtype: "m.text",
                formatted_body: "<p>hello</p><pre><code>$\\xi$</code></pre><p>world</p>",
                format: "org.matrix.custom.html",
            });
            expect(html).toMatchSnapshot();
        });
    });
});

describe("formatEmojis", () => {
    it.each([
        ["🏴󠁧󠁢󠁥󠁮󠁧󠁿", [["🏴󠁧󠁢󠁥󠁮󠁧󠁿", "flag-england"]]],
        ["🏴󠁧󠁢󠁳󠁣󠁴󠁿", [["🏴󠁧󠁢󠁳󠁣󠁴󠁿", "flag-scotland"]]],
        ["🏴󠁧󠁢󠁷󠁬󠁳󠁿", [["🏴󠁧󠁢󠁷󠁬󠁳󠁿", "flag-wales"]]],
    ])("%s emoji", (emoji, expectations) => {
        const res = formatEmojis(emoji, false);
        expect(res).toHaveLength(expectations.length);
        for (let i = 0; i < res.length; i++) {
            const [emoji, title] = expectations[i];
            expect(res[i].props.children).toEqual(emoji);
            expect(res[i].props.title).toEqual(`:${title}:`);
        }
    });
});
