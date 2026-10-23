/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { isMarkdownFile } from "./markdownViewer";

describe("isMarkdownFile", () => {
    it("accepts a Markdown mimetype whatever the name", () => {
        expect(isMarkdownFile("text/markdown; charset=utf-8", "notes.txt")).toBe(true);
    });

    it("falls back to the name when the mimetype is missing or generic", () => {
        expect(isMarkdownFile(undefined, "README.md")).toBe(true);
        expect(isMarkdownFile("text/plain", "README.md")).toBe(true);
        expect(isMarkdownFile("text/plain", "notes.txt")).toBe(false);
        expect(isMarkdownFile(undefined, undefined)).toBe(false);
    });

    it("does not trust the name when the mimetype says something else", () => {
        expect(isMarkdownFile("application/pdf", "README.md")).toBe(false);
    });
});
