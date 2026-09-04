/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { isPdfEvent, openPdfViewer, pdfMediaForEvent } from "./pdfViewer";
import { type MediaEventHelper } from "./MediaEventHelper";
import RightPanelStore from "../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../stores/right-panel/RightPanelStorePhases";

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

describe("pdfMediaForEvent", () => {
    it("returns nothing for an event that is not a PDF", () => {
        expect(pdfMediaForEvent(mkFileEvent({ mimetype: "text/plain" }))).toBeUndefined();
    });

    it("keys on the MXC URI and defers to the helper for the bytes", async () => {
        const blob = new Blob(["%PDF-1.7\n"], { type: "application/pdf" });
        const helper = {
            media: { srcMxc: "mxc://example.org/spec" },
            fileName: "spec.pdf",
            sourceBlob: { value: Promise.resolve(blob) },
        } as unknown as MediaEventHelper;

        const media = pdfMediaForEvent(mkFileEvent({ mimetype: "application/pdf" }), helper);

        expect(media).toMatchObject({ uri: "mxc://example.org/spec", name: "spec.pdf" });
        // The helper decrypts behind `sourceBlob`, so the viewer gets plaintext either way.
        await expect(media!.blob()).resolves.toBe(blob);
    });
});

describe("openPdfViewer", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens the viewer card in the room the event belongs to", () => {
        const setCard = vi.spyOn(RightPanelStore.instance, "setCard").mockImplementation(() => {});
        const mxEvent = mkFileEvent({ mimetype: "application/pdf" });

        openPdfViewer(mxEvent);

        expect(setCard).toHaveBeenCalledWith(
            { phase: RightPanelPhases.PdfViewer, state: { pdfViewerEvent: mxEvent } },
            true,
            "!room:example.org",
        );
    });
});
