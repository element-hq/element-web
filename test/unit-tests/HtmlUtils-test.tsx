/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import parse from "html-react-parser";

import { bodyToHtml, bodyToNode, formatEmojis, topicToHtml } from "../../src/HtmlUtils";
import SettingsStore from "../../src/settings/SettingsStore";

jest.mock("../../src/settings/SettingsStore");

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
    it("should apply highlights to HTML messages", () => {
        const html = bodyToHtml(
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
        const html = bodyToHtml(
            {
                body: "test foo bar",
                msgtype: "m.text",
            },
            ["test"],
        );

        expect(html).toMatchInlineSnapshot(`"<span class="mx_EventTile_searchHighlight">test</span> foo bar"`);
    });

    it("should not respect HTML tags in plaintext message highlighting", () => {
        const html = bodyToHtml(
            {
                body: "test foo <b>bar",
                msgtype: "m.text",
            },
            ["test"],
        );

        expect(html).toMatchInlineSnapshot(`"<span class="mx_EventTile_searchHighlight">test</span> foo &lt;b&gt;bar"`);
    });

    it("does not mistake characters in text presentation mode for emoji", () => {
        const { asFragment } = render(
            <span className="mx_EventTile_body translate" dir="auto">
                {parse(bodyToHtml({ body: "↔ ❗︎", msgtype: "m.text" }, [], {}))}
            </span>,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    describe("feature_latex_maths", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((feature) => feature === "feature_latex_maths");
        });

        it("should render inline katex", () => {
            const html = bodyToHtml(
                {
                    body: "hello \\xi world",
                    msgtype: "m.text",
                    formatted_body: 'hello <span data-mx-maths="\\xi"><code>\\xi</code></span> world',
                    format: "org.matrix.custom.html",
                },
                [],
            );
            expect(html).toMatchSnapshot();
        });

        it("should render block katex", () => {
            const html = bodyToHtml(
                {
                    body: "hello \\xi world",
                    msgtype: "m.text",
                    formatted_body: '<p>hello</p><div data-mx-maths="\\xi"><code>\\xi</code></div><p>world</p>',
                    format: "org.matrix.custom.html",
                },
                [],
            );
            expect(html).toMatchSnapshot();
        });

        it("should not mangle code blocks", () => {
            const html = bodyToHtml(
                {
                    body: "hello \\xi world",
                    msgtype: "m.text",
                    formatted_body: "<p>hello</p><pre><code>$\\xi$</code></pre><p>world</p>",
                    format: "org.matrix.custom.html",
                },
                [],
            );
            expect(html).toMatchSnapshot();
        });

        it("should not mangle divs", () => {
            const html = bodyToHtml(
                {
                    body: "hello world",
                    msgtype: "m.text",
                    formatted_body: "<p>hello</p><div>world</div>",
                    format: "org.matrix.custom.html",
                },
                [],
            );
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

describe("bodyToNode", () => {
    it("generates big emoji for emoji made of multiple characters", () => {
        const { className, emojiBodyElements } = bodyToNode(
            {
                body: "👨‍👩‍👧‍👦 ↔️ 🇮🇸",
                msgtype: "m.text",
            },
            [],
            {
                stripReplyFallback: true,
            },
        );

        const { asFragment } = render(
            <span className={className} dir="auto">
                {emojiBodyElements}
            </span>,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    it("should generate big emoji for an emoji-only reply to a message", () => {
        const { className, formattedBody } = bodyToNode(
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
        );

        const { asFragment } = render(
            <span className={className} dir="auto" dangerouslySetInnerHTML={{ __html: formattedBody! }} />,
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
