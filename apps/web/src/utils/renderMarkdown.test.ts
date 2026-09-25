/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { renderMarkdown } from "./renderMarkdown";
import { stubClient } from "test-utils";

describe("renderMarkdown", () => {
    beforeEach(() => {
        stubClient();
    });

    it("renders headings, emphasis and lists", () => {
        const html = renderMarkdown("# Title\n\nSome *emphasis* and **strong** text.\n\n- one\n- two\n");

        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<em>emphasis</em>");
        expect(html).toContain("<strong>strong</strong>");
        expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
    });

    it("renders fenced code blocks with a language class for highlighting", () => {
        const html = renderMarkdown("```ts\nconst x = 1;\n```\n");

        expect(html).toContain('<pre><code class="language-ts">const x = 1;\n</code></pre>');
    });

    it("renders GitHub-flavoured tables", () => {
        const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n");

        expect(html).toContain("<table>");
        expect(html).toContain("<th>a</th>");
        expect(html).toContain("<td>2</td>");
    });

    it("opens links in a new tab without leaking the referrer", () => {
        const html = renderMarkdown("[Element](https://element.io/)");

        expect(html).toContain('href="https://element.io/"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noreferrer noopener"');
    });

    it("drops scripts and inline event handlers written as raw HTML", () => {
        const html = renderMarkdown(
            '<script>alert(1)</script>\n\n<a href="https://example.org" onclick="alert(1)">x</a>',
        );

        expect(html).not.toContain("<script");
        expect(html).not.toContain("alert(1)");
        expect(html).not.toContain("onclick");
        expect(html).toContain('href="https://example.org"');
    });

    it("drops javascript: links", () => {
        const html = renderMarkdown("[click](javascript:alert(1))");

        expect(html).not.toContain("javascript:");
        expect(html).toContain(">click</a>");
    });

    it("drops images hosted outside the homeserver", () => {
        const html = renderMarkdown("![tracker](https://example.org/pixel.png)");

        expect(html).not.toContain("example.org/pixel.png");
    });

    it("keeps images hosted on the homeserver", () => {
        const html = renderMarkdown("![diagram](mxc://example.org/diagram)");

        expect(html).toMatch(/<img [^>]*src="[^"]*diagram[^"]*"/);
        expect(html).toContain('alt="diagram"');
    });
});
