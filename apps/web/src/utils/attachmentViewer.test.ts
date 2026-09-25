/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { attachmentViewerForEvent } from "./attachmentViewer";
import { openPdfViewer } from "./pdfViewer";
import { openMarkdownViewer } from "./markdownViewer";

vi.mock("./pdfViewer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./pdfViewer")>()),
    openPdfViewer: vi.fn(),
}));

vi.mock("./markdownViewer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./markdownViewer")>()),
    openMarkdownViewer: vi.fn(),
}));

function mkFileEvent(body: string, mimetype?: string): MatrixEvent {
    return new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        type: EventType.RoomMessage,
        content: { body, msgtype: MsgType.File, url: "mxc://example.org/file", info: { mimetype } },
    });
}

const allLabsOff = { pdfViewerEnabled: false, markdownViewerEnabled: false };
const allLabsOn = { pdfViewerEnabled: true, markdownViewerEnabled: true };

describe("attachmentViewerForEvent", () => {
    it("offers nothing for a file no viewer can open", () => {
        expect(attachmentViewerForEvent(mkFileEvent("notes.txt", "text/plain"), allLabsOn)).toBeUndefined();
    });

    it("offers the PDF viewer for a PDF while its lab is on", () => {
        const mxEvent = mkFileEvent("spec.pdf", "application/pdf");

        const viewer = attachmentViewerForEvent(mxEvent, allLabsOn);

        expect(viewer?.openLabel).toBe("Open PDF");
        viewer?.open();
        expect(openPdfViewer).toHaveBeenCalledWith(mxEvent);
    });

    it("does not offer the PDF viewer while its lab is off", () => {
        expect(attachmentViewerForEvent(mkFileEvent("spec.pdf", "application/pdf"), allLabsOff)).toBeUndefined();
    });

    it("offers the Markdown viewer for a Markdown file while its lab is on", () => {
        const mxEvent = mkFileEvent("README.md", "text/markdown");

        const viewer = attachmentViewerForEvent(mxEvent, allLabsOn);

        expect(viewer?.openLabel).toBe("Open Markdown");
        viewer?.open();
        expect(openMarkdownViewer).toHaveBeenCalledWith(mxEvent);
    });

    it("does not offer the Markdown viewer while its lab is off", () => {
        expect(attachmentViewerForEvent(mkFileEvent("README.md", "text/markdown"), allLabsOff)).toBeUndefined();
    });

    it("keeps the labs independent", () => {
        const pdfOnly = { pdfViewerEnabled: true, markdownViewerEnabled: false };

        expect(attachmentViewerForEvent(mkFileEvent("README.md", "text/markdown"), pdfOnly)).toBeUndefined();
        expect(attachmentViewerForEvent(mkFileEvent("spec.pdf", "application/pdf"), pdfOnly)).toBeDefined();
    });
});
