/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, expect, it } from "vitest";

import { isUrlPermitted, PERMITTED_URL_SCHEMES } from "./index";

describe("isUrlPermitted", () => {
    it.each(PERMITTED_URL_SCHEMES)("accepts permitted scheme: %s", (scheme) => {
        expect(isUrlPermitted(`${scheme}:example`)).toBe(true);
    });

    it.each(["javascript:alert(1)", "data:text/html,alert(1)", "vbscript:alert(1)", "not a url", "/relative/path", ""])(
        "rejects unsafe or invalid URL: %s",
        (url) => {
            expect(isUrlPermitted(url)).toBe(false);
        },
    );

    it("accepts URLs with an upper-case scheme", () => {
        expect(isUrlPermitted("HTTPS://example.org")).toBe(true);
    });

    it("rejects non-string input", () => {
        expect(isUrlPermitted(undefined as unknown as string)).toBe(false);
    });
});
