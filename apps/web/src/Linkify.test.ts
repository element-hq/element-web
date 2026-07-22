/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import sanitizeHtml from "sanitize-html";
import { beforeAll, describe, expect, it } from "vitest";
import { stubClient } from "test-utils";

import { sanitizeHtmlParams } from "./Linkify";

describe("message HTML image sanitization", () => {
    beforeAll(() => stubClient());

    it("preserves the custom-emote marker for MXC images", () => {
        const html = sanitizeHtml(
            '<img data-mx-emoticon src="mxc://example.org/wave" alt="A wave" title="wave" height="32">',
            sanitizeHtmlParams,
        );
        expect(html).toContain("data-mx-emoticon");
        expect(html).toContain('alt="A wave"');
        expect(html).toContain('title="wave"');
        expect(html).toContain("http://this.is.a.url/example.org/wave");
        expect(html).toContain("max-height:32px");
    });

    it("does not make an unsafe image source renderable", () => {
        const html = sanitizeHtml(
            '<img data-mx-emoticon src="https://example.org/wave.png" alt="A wave">',
            sanitizeHtmlParams,
        );
        expect(html).not.toContain("https://example.org/wave.png");
        expect(html).not.toContain("data-mx-emoticon");
    });

    it("does not mark ordinary inline images as emotes", () => {
        const html = sanitizeHtml('<img src="mxc://example.org/image" alt="An image">', sanitizeHtmlParams);
        expect(html).not.toContain("data-mx-emoticon");
        expect(html).toContain('alt="An image"');
    });
});
