/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { isMarkdownEvent } from "./markdownViewer";

function mkFileEvent(info?: Record<string, unknown>, body = "README.md", filename?: string): MatrixEvent {
    return new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        type: EventType.RoomMessage,
        content: {
            body,
            filename,
            msgtype: MsgType.File,
            url: "mxc://example.org/readme",
            info,
        },
    });
}

describe("isMarkdownEvent", () => {
    it.each([
        ["a bare Markdown mimetype", "text/markdown", true],
        ["the x- Markdown mimetype", "text/x-markdown", true],
        ["a Markdown mimetype with parameters", "text/markdown; charset=utf-8", true],
        ["an oddly cased Markdown mimetype", "Text/Markdown", true],
        ["a PDF mimetype", "application/pdf", false],
    ])("returns %s => %s", (_label, mimetype, expected) => {
        expect(isMarkdownEvent(mkFileEvent({ mimetype }, "notes.txt"))).toBe(expected);
    });

    it.each([
        ["no mimetype", undefined],
        ["a plain text mimetype", "text/plain"],
        ["an octet-stream mimetype", "application/octet-stream"],
    ])("falls back to a .md file name when the sender gave %s", (_label, mimetype) => {
        expect(isMarkdownEvent(mkFileEvent({ mimetype }, "README.md"))).toBe(true);
        expect(isMarkdownEvent(mkFileEvent({ mimetype }, "notes.MARKDOWN"))).toBe(true);
        expect(isMarkdownEvent(mkFileEvent({ mimetype }, "notes.txt"))).toBe(false);
    });

    it("prefers the filename field over the body for the extension", () => {
        expect(isMarkdownEvent(mkFileEvent(undefined, "a caption", "README.md"))).toBe(true);
        expect(isMarkdownEvent(mkFileEvent(undefined, "README.md", "notes.txt"))).toBe(false);
    });

    it("does not trust the file name when the mimetype says something else", () => {
        expect(isMarkdownEvent(mkFileEvent({ mimetype: "application/pdf" }, "README.md"))).toBe(false);
    });

    it("returns false for an event that is not media at all", () => {
        const mxEvent = new MatrixEvent({
            room_id: "!room:example.org",
            sender: "@user:example.org",
            type: EventType.RoomMessage,
            content: { body: "README.md", msgtype: MsgType.Text, info: { mimetype: "text/markdown" } },
        });

        expect(isMarkdownEvent(mxEvent)).toBe(false);
    });
});
