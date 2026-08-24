/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import {
    canPreviewFile,
    FilePreviewKind,
    getFilePreviewKind,
    getPreviewKind,
    PreviewKind,
} from "../../../../../../src/components/views/elements/MediaPreview/previewTypes";

const mkContent = (content: Partial<MediaEventContent>): MediaEventContent =>
    ({
        body: "file",
        msgtype: MsgType.File,
        url: "mxc://server/file",
        ...content,
    }) as MediaEventContent;

const mkEvent = (content: Partial<MediaEventContent>): MatrixEvent =>
    new MatrixEvent({
        room_id: "!room:server",
        sender: "@user:server",
        type: EventType.RoomMessage,
        content: mkContent(content),
    });

describe("getFilePreviewKind", () => {
    it("recognises a PDF by mimetype", () => {
        expect(getFilePreviewKind(mkContent({ info: { mimetype: "application/pdf" } }))).toBe(FilePreviewKind.Pdf);
    });

    it("ignores parameters on the mimetype", () => {
        expect(getFilePreviewKind(mkContent({ info: { mimetype: "application/pdf; charset=binary" } }))).toBe(
            FilePreviewKind.Pdf,
        );
    });

    it("recognises a docx by mimetype", () => {
        const mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        expect(getFilePreviewKind(mkContent({ info: { mimetype } }))).toBe(FilePreviewKind.Docx);
    });

    it("falls back to the filename when the mimetype is generic", () => {
        expect(
            getFilePreviewKind(mkContent({ filename: "Report.PDF", info: { mimetype: "application/octet-stream" } })),
        ).toBe(FilePreviewKind.Pdf);
    });

    it("falls back to the body when there is no filename", () => {
        expect(getFilePreviewKind(mkContent({ body: "notes.docx" }))).toBe(FilePreviewKind.Docx);
    });

    it("does not claim to preview legacy .doc files", () => {
        // mammoth only reads OOXML, so the old binary format must keep downloading.
        expect(getFilePreviewKind(mkContent({ body: "legacy.doc", info: { mimetype: "application/msword" } }))).toBe(
            null,
        );
    });

    it("returns null for a format we cannot render", () => {
        expect(getFilePreviewKind(mkContent({ body: "archive.zip", info: { mimetype: "application/zip" } }))).toBe(
            null,
        );
    });

    it("returns null when there is nothing to go on", () => {
        expect(getFilePreviewKind(mkContent({ body: "", filename: undefined }))).toBe(null);
    });
});

describe("canPreviewFile", () => {
    it("accepts a previewable file event", () => {
        expect(canPreviewFile(mkEvent({ body: "spec.pdf" }))).toBe(true);
    });

    it("rejects non-file message types", () => {
        expect(canPreviewFile(mkEvent({ body: "spec.pdf", msgtype: MsgType.Image }))).toBe(false);
    });

    it("rejects redacted events", () => {
        const event = mkEvent({ body: "spec.pdf" });
        jest.spyOn(event, "isRedacted").mockReturnValue(true);
        expect(canPreviewFile(event)).toBe(false);
    });
});

describe("getPreviewKind", () => {
    it("defaults to the image viewer when there is no event", () => {
        // Avatars and URL previews open the dialog with a bare src and nothing else.
        expect(getPreviewKind(undefined)).toBe(PreviewKind.Image);
    });

    it("keeps image messages on the image viewer", () => {
        expect(getPreviewKind(mkEvent({ msgtype: MsgType.Image, body: "cat.png" }))).toBe(PreviewKind.Image);
    });

    it("routes a PDF file to the pdf previewer", () => {
        expect(getPreviewKind(mkEvent({ body: "spec.pdf" }))).toBe(PreviewKind.Pdf);
    });

    it("routes a docx file to the Word previewer", () => {
        expect(getPreviewKind(mkEvent({ body: "notes.docx" }))).toBe(PreviewKind.Docx);
    });

    it("marks a file we cannot render as unsupported", () => {
        expect(getPreviewKind(mkEvent({ body: "archive.zip" }))).toBe(PreviewKind.Unsupported);
    });
});
