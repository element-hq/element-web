/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import sanitizeHtml from "sanitize-html";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sanitizeHtmlParams } from "./Linkify";
import { MatrixClientPeg } from "./MatrixClientPeg";

describe("custom emoticon sanitising", () => {
    beforeEach(() => {
        MatrixClientPeg.set({
            mxcUrlToHttp: vi.fn(() => "https://matrix.example.org/_matrix/media/v3/thumbnail/example.org/wave"),
        } as any);
    });

    afterEach(() => MatrixClientPeg.unset());

    it("keeps Matrix inline emoticon metadata while rejecting non-Matrix image sources", () => {
        const safe = sanitizeHtml(
            '<img data-mx-emoticon src="mxc://example.org/wave" alt=":wave:" title=":wave:" width="32" height="32">',
            sanitizeHtmlParams,
        );
        const unsafe = sanitizeHtml(
            '<img data-mx-emoticon src="https://example.org/wave.png" alt=":wave:">',
            sanitizeHtmlParams,
        );

        expect(safe).toContain("data-mx-emoticon");
        expect(safe).toContain('alt=":wave:"');
        expect(unsafe).not.toContain("data-mx-emoticon");
        expect(unsafe).not.toContain("example.org/wave.png");
    });
});
