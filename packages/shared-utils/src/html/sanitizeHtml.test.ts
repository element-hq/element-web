/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, expect, it } from "vitest";

import { sanitizeHtml, sanitizeHtmlText } from "./index";
import { MATRIX_FORMATTING_TAGS } from "./sanitizeHtmlParams";

describe("sanitizeHtml", () => {
    it("allows Element Web formatting tags", () => {
        const selfClosingTags = new Set(["br", "hr", "img"]);
        const html = MATRIX_FORMATTING_TAGS.map((tag) =>
            selfClosingTags.has(tag) ? `<${tag}>` : `<${tag}>text</${tag}>`,
        ).join("");

        const safe = sanitizeHtml(html);

        for (const tag of MATRIX_FORMATTING_TAGS) {
            expect(safe).toContain(`<${tag}`);
        }
    });

    it("removes dangerous elements while preserving sanitize-html text semantics", () => {
        const safe = sanitizeHtml(
            "<script>alert(1)</script><style>body{display:none}</style><template>bad</template>" +
                "<iframe>bad</iframe><object>bad</object><embed>bad</embed><svg><script>bad</script></svg><p>safe</p>",
        );

        expect(safe).not.toMatch(/<\/?(?:script|style|template|iframe|object|embed|svg)/);
        expect(safe).toContain("<p>safe</p>");
    });

    it("removes unsafe attributes and URLs while securing valid links", () => {
        const safe = sanitizeHtml(
            '<p onclick="alert(1)" style="color:red">text</p>' +
                '<a href="javascript:alert(1)" onclick="alert(2)">unsafe</a>' +
                '<a href="https://example.org/docs">safe</a>',
        );

        expect(safe).toContain("<p>text</p>");
        expect(safe).not.toContain("onclick");
        expect(safe).not.toContain("style=");
        expect(safe).not.toContain("javascript:");
        expect(safe).toContain('href="https://example.org/docs" target="_blank" rel="noreferrer noopener"');
    });

    it("preserves safe relative links while rejecting protocol-relative links", () => {
        const safe = sanitizeHtml(
            '<a href="#/register">local</a><a href="/path">path</a><a href="//example.org">external</a>',
        );

        expect(safe).toContain('href="#/register" target="_blank" rel="noreferrer noopener"');
        expect(safe).toContain('href="/path" target="_blank" rel="noreferrer noopener"');
        expect(safe).not.toContain('href="//example.org"');
    });

    it("allows a trusted consumer transform to replace shared link rendering", () => {
        const safe = sanitizeHtml('<a href="#/register">local</a>', {
            transformTags: {
                a: (tagName, attribs) => ({ tagName, attribs }),
            },
        });

        expect(safe).toBe('<a href="#/register">local</a>');
    });

    it("retains URL safety with a custom anchor renderer", () => {
        const safe = sanitizeHtml('<a href="javascript:alert(1)">unsafe</a>', {
            transformTags: {
                a: (tagName, attribs) => ({ tagName, attribs }),
            },
        });

        expect(safe).toBe("<a>unsafe</a>");
    });

    it("preserves Matrix formatting and escapes text", () => {
        const safe = sanitizeHtml("<p><strong>bold</strong><br><em>italic</em> &lt;literal&gt;</p>");

        expect(safe).toBe("<p><strong>bold</strong><br /><em>italic</em> &lt;literal&gt;</p>");
    });

    it("converts only strict Matrix colour attributes", () => {
        const safe = sanitizeHtml('<span data-mx-color="#12abEF">ok</span><span data-mx-color="red">bad</span>');

        expect(safe).toContain('<span style="color:#12abEF">ok</span>');
        expect(safe).toContain('<span data-mx-color="red">bad</span>');
    });

    it("filters code classes to language classes", () => {
        const safe = sanitizeHtml('<code class="language-js language-_secret unrelated">code</code>');

        expect(safe).toBe('<code class="language-js">code</code>');
    });

    it("restricts tags, attributes, and self-closing tags when requested", () => {
        const safe = sanitizeHtml(
            '<p>paragraph</p><strong>strong</strong><span data-mx-spoiler="true">span</span><br><hr>',
            {
                allowedTags: ["p", "br", "hr", "span"],
                allowedAttributes: { span: ["data-mx-spoiler"] },
                selfClosing: ["br"],
            },
        );

        expect(safe).toContain("<p>paragraph</p>");
        expect(safe).toContain('<span data-mx-spoiler="true">span</span>');
        expect(safe).toContain("<br />");
        expect(safe).toContain("<hr></hr>");
        expect(safe).not.toContain("<strong>");
    });

    it("allows only data-* additions to the attribute policy", () => {
        const safe = sanitizeHtml('<a href="https://example.org" data-linkified="true" onclick="alert(1)">link</a>', {
            additionalAllowedAttributes: { a: ["data-linkified", "onclick"] },
        });

        expect(safe).toContain('data-linkified="true"');
        expect(safe).not.toContain("onclick");
    });

    it("only permits Element Web media images", () => {
        const safe = sanitizeHtml('<img src="mxc://example.org/media"><img src="https://example.org/image.png">');

        expect(safe).toContain("<img");
        expect(safe).not.toContain('src="https://example.org/image.png"');
    });

    it("removes tags while preserving safe text", () => {
        expect(sanitizeHtmlText("before<br>after <strong>bold</strong>")).toBe("beforeafter bold");
    });

    it("preserves entity encoding and removes dangerous tag contents", () => {
        expect(sanitizeHtmlText("<p>A &amp; B</p><strong>bold</strong><script>alert(1)</script>")).toBe(
            "A &amp; Bbold",
        );
    });

    it("uses an empty string fallback for unavailable HTML", () => {
        expect(sanitizeHtml(undefined)).toBe("");
        expect(sanitizeHtml(null)).toBe("");
        expect(sanitizeHtml("")).toBe("");
    });
});
