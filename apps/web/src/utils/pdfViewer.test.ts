/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { isPdfMimetype } from "./pdfViewer";

describe("isPdfMimetype", () => {
    it.each([
        ["a bare PDF mimetype", "application/pdf", true],
        ["a PDF mimetype with parameters", "application/pdf; version=1.7", true],
        ["an oddly cased PDF mimetype", "Application/PDF", true],
        ["a non-PDF mimetype", "text/plain", false],
        ["no mimetype", undefined, false],
    ])("returns %s => %s", (_label, mimetype, expected) => {
        expect(isPdfMimetype(mimetype)).toBe(expected);
    });
});
