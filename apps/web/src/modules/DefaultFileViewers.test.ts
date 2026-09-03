/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import type { MediaHandle } from "@element-hq/element-web-module-api";

import { isPdfMedia } from "./DefaultFileViewers";

describe("default file viewer routing", () => {
    it("matches uploaded PDF attachments only", () => {
        const uploadedPdf = {
            type: "uploaded",
            uri: "mxc://example.org/spec",
            mimetype: "application/pdf; charset=binary",
            name: "spec.pdf",
            blob: vi.fn(),
        } satisfies MediaHandle;
        const uploadedText = {
            type: "uploaded",
            uri: "mxc://example.org/notes",
            mimetype: "text/plain",
            name: "notes.txt",
            blob: vi.fn(),
        } satisfies MediaHandle;
        const remotePdfLink = {
            type: "remote",
            bundle: {
                matched_url: "https://example.org/spec.pdf",
            },
        } satisfies MediaHandle;

        expect(isPdfMedia(uploadedPdf)).toBe(true);
        expect(isPdfMedia(uploadedText)).toBe(false);
        expect(isPdfMedia(remotePdfLink)).toBe(false);
    });
});
