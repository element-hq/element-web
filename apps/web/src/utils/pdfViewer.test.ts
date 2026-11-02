/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { isPdfEvent } from "./pdfViewer";

function mkFileEvent(info?: Record<string, unknown>): MatrixEvent {
    return new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        type: EventType.RoomMessage,
        content: {
            body: "spec.pdf",
            msgtype: MsgType.File,
            url: "mxc://example.org/spec",
            info,
        },
    });
}

describe("isPdfEvent", () => {
    it.each([
        ["a bare PDF mimetype", "application/pdf", true],
        ["a PDF mimetype with parameters", "application/pdf; version=1.7", true],
        ["an oddly cased PDF mimetype", "Application/PDF", true],
        ["a non-PDF mimetype", "text/plain", false],
    ])("returns %s => %s", (_label, mimetype, expected) => {
        expect(isPdfEvent(mkFileEvent({ mimetype }))).toBe(expected);
    });

    it("returns false when the event carries no mimetype", () => {
        expect(isPdfEvent(mkFileEvent())).toBe(false);
    });

    it("returns false for an event that is not media at all", () => {
        const mxEvent = new MatrixEvent({
            room_id: "!room:example.org",
            sender: "@user:example.org",
            type: EventType.RoomMessage,
            content: { body: "hi", msgtype: MsgType.Text, info: { mimetype: "application/pdf" } },
        });

        expect(isPdfEvent(mxEvent)).toBe(false);
    });
});
