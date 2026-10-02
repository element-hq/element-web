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

    it("keeps a wrapped paragraph as one paragraph", () => {
        const html = renderMarkdown("# Title\n\nThis sentence is wrapped\nat a fixed column.\n");

        expect(html).toContain("<p>This sentence is wrapped\nat a fixed column.</p>");
        expect(html).not.toContain("<br");
    });

    it("opens links in a new tab without leaking the referrer", () => {
        const html = renderMarkdown("[Element](https://element.io/)");

        expect(html).toContain('href="https://element.io/"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noreferrer noopener"');
    });

    it("shows raw HTML as text rather than markup", () => {
        const html = renderMarkdown(
            '<script>alert(1)</script>\n\n<a href="https://example.org" onclick="alert(1)">x</a>',
        );

        // The message parser escapes anything outside its small allow-list of inline tags, so the
        // source is visible but inert.
        expect(html).not.toContain("<script");
        expect(html).not.toMatch(/<a /);
        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("allows the few inline tags messages allow", () => {
        const html = renderMarkdown("H<sub>2</sub>O and <del>this</del>");

        expect(html).toContain("<sub>2</sub>");
        expect(html).toContain("<del>this</del>");
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
