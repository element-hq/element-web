/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import { EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { describe, it, expect, beforeEach } from "vitest";
import { makePollStartEvent, mkEvent, stubClient } from "test-utils";

import { EventPreviewContentCache, getEventPreviewContent } from "./EventPreviewUtils";

describe("getEventPreviewContent", () => {
    const roomId = "!room:example.com";
    const userId = "@alice:example.com";

    const makeMessageEvent = (content: Record<string, unknown>): MatrixEvent =>
        mkEvent({ event: true, type: EventType.RoomMessage, room: roomId, user: userId, content });

    const makeGalleryEvent = (body: string, msgtype = "dm.filament.gallery"): MatrixEvent =>
        makeMessageEvent({
            msgtype,
            body,
            itemtypes: [
                { itemtype: "m.image", body: "one.png", url: "mxc://server/one" },
                { itemtype: "m.video", body: "two.mp4", url: "mxc://server/two" },
            ],
        });

    /** The text of the preview as it is displayed, and whether it starts with a bold prefix. */
    const renderPreview = (mxEvent: MatrixEvent): { text: string | null; prefix: string | null; tooltip?: string } => {
        const preview = getEventPreviewContent(mxEvent, new EventPreviewContentCache());
        if (!preview) return { text: null, prefix: null };

        const { container } = render(<>{preview.previewContent}</>);
        return {
            text: container.textContent,
            prefix: container.querySelector("strong")?.textContent ?? null,
            tooltip: preview.previewTooltip,
        };
    };

    beforeEach(() => {
        stubClient();
    });

    it("previews a text message without a prefix", () => {
        expect(renderPreview(makeMessageEvent({ msgtype: MsgType.Text, body: "Hello" }))).toEqual({
            text: "Hello",
            prefix: null,
            tooltip: "Hello",
        });
    });

    it.each([
        [MsgType.Image, "Image"],
        [MsgType.Video, "Video"],
        [MsgType.Audio, "Audio"],
        [MsgType.File, "File"],
    ])("prefixes the preview of a %s message with its kind", (msgtype, kind) => {
        expect(renderPreview(makeMessageEvent({ msgtype, body: "attachment.bin" }))).toEqual({
            text: `${kind}: attachment.bin`,
            prefix: `${kind}:`,
            tooltip: undefined,
        });
    });

    it("prefixes the preview of a poll", () => {
        const preview = renderPreview(makePollStartEvent("Socks or shoes?", userId));

        expect(preview.prefix).toBe("Poll:");
        expect(preview.text).toContain("Socks or shoes?");
    });

    it.each(["dm.filament.gallery", "m.gallery"])("prefixes the caption of a %s", (msgtype) => {
        expect(renderPreview(makeGalleryEvent("Our holiday", msgtype))).toEqual({
            text: "Gallery: Our holiday",
            prefix: "Gallery:",
            tooltip: undefined,
        });
    });

    it.each(["dm.filament.gallery", "m.gallery"])("describes a %s without a caption only once", (msgtype) => {
        // The description already says that this is a gallery, so it gets no prefix.
        expect(renderPreview(makeGalleryEvent("", msgtype))).toEqual({
            text: "Gallery with 2 items",
            prefix: null,
            tooltip: "Gallery with 2 items",
        });
    });

    it("treats a blank caption as no caption", () => {
        expect(renderPreview(makeGalleryEvent("   "))).toEqual({
            text: "Gallery with 2 items",
            prefix: null,
            tooltip: "Gallery with 2 items",
        });
    });

    it("has no preview for a message without a body", () => {
        expect(
            getEventPreviewContent(
                makeMessageEvent({ msgtype: MsgType.Text, body: "" }),
                new EventPreviewContentCache(),
            ),
        ).toBeNull();
    });
});
