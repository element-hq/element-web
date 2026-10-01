/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { abbreviateUrl, linkPreviewable, linksIn, parseUrl, unabbreviateUrl } from "./UrlUtils";

describe("abbreviateUrl", () => {
    it("should return empty string if passed falsey", () => {
        expect(abbreviateUrl(undefined)).toEqual("");
    });

    it("should abbreviate to host if empty pathname", () => {
        expect(abbreviateUrl("https://foo/")).toEqual("foo");
    });

    it("should not abbreviate if has path parts", () => {
        expect(abbreviateUrl("https://foo/path/parts")).toEqual("https://foo/path/parts");
    });
});

describe("unabbreviateUrl", () => {
    it("should return empty string if passed falsey", () => {
        expect(unabbreviateUrl(undefined)).toEqual("");
    });

    it("should prepend https to input if it lacks it", () => {
        expect(unabbreviateUrl("element.io")).toEqual("https://element.io");
    });

    it("should not prepend https to input if it has it", () => {
        expect(unabbreviateUrl("https://element.io")).toEqual("https://element.io");
    });
});

describe("parseUrl", () => {
    it("should not throw on no proto", () => {
        expect(() => parseUrl("test")).not.toThrow();
    });
});

describe("linksIn", () => {
    it("should return nothing for text without a link", () => {
        expect(linksIn("no links here")).toEqual(new Set());
    });

    it("should find a link surrounded by text", () => {
        expect(linksIn("look at https://example.org/page please")).toEqual(new Set(["https://example.org/page"]));
    });

    // Composer content is multi-line, so splitting on spaces alone left the newline glued to the
    // URL and it stopped parsing as one.
    it.each([
        ["newlines", "https://one.example.org\nhttps://two.example.org"],
        ["tabs", "https://one.example.org\thttps://two.example.org"],
        ["runs of spaces", "https://one.example.org    https://two.example.org"],
        ["mixed whitespace", "https://one.example.org \n\t https://two.example.org"],
    ])("should split links on %s", (_name, content) => {
        expect(linksIn(content)).toEqual(new Set(["https://one.example.org", "https://two.example.org"]));
    });

    it("should find a link at the very start and end of the text", () => {
        expect(linksIn("https://start.example.org and https://end.example.org")).toEqual(
            new Set(["https://start.example.org", "https://end.example.org"]),
        );
    });

    it("should deduplicate repeated links", () => {
        expect(linksIn("https://example.org and again https://example.org")).toEqual(new Set(["https://example.org"]));
    });

    // The set is iterated to build the preview list, so the order has to follow the text.
    it("should keep the links in the order they appear", () => {
        expect(Array.from(linksIn("https://b.example.org https://a.example.org"))).toEqual([
            "https://b.example.org",
            "https://a.example.org",
        ]);
    });

    it("should ignore words that are not http(s) urls", () => {
        expect(linksIn("mailto:someone@example.org ftp://example.org matrix.to example.org")).toEqual(new Set());
    });
});

describe("linkPreviewable", () => {
    it("should accept an http(s) url", () => {
        expect(linkPreviewable("https://example.org/page")).toBe(true);
        expect(linkPreviewable("http://example.org/page")).toBe(true);
    });

    it("should reject an empty string", () => {
        expect(linkPreviewable("")).toBe(false);
    });

    it("should reject something that is not a url", () => {
        expect(linkPreviewable("example.org")).toBe(false);
    });

    it("should reject a non-http protocol", () => {
        expect(linkPreviewable("mailto:someone@example.org")).toBe(false);
    });

    // Previewing a permalink would ask the server about a room the user is already in.
    it("should reject a matrix permalink", () => {
        expect(linkPreviewable("https://matrix.to/#/@alice:example.org")).toBe(false);
    });
});
