/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";
import type { FileViewerOptions, MediaHandle } from "@element-hq/element-web-module-api";
import type { UrlPreview } from "shared-types";
import { stubClient } from "test-utils";

import { FileViewerApi, remoteMediaOfPreview, uploadedMediaOfEvent } from "./FileViewerApi";
import { type MediaEventHelper } from "../utils/MediaEventHelper";

const PDF: MediaHandle = { type: "uploaded", name: "spec.pdf", mimetype: "application/pdf", blob: vi.fn() };
const TEXT: MediaHandle = { type: "uploaded", name: "notes.txt", mimetype: "text/plain", blob: vi.fn() };

function mkOptions(id: string): FileViewerOptions {
    return { id, cardHeader: () => id, buttonText: `Open with ${id}`, buttonIcon: <></> };
}

function mkFileEvent(content: object = {}): MatrixEvent {
    return new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        event_id: "$file",
        type: EventType.RoomMessage,
        content: {
            body: "spec.pdf",
            msgtype: MsgType.File,
            url: "mxc://example.org/spec",
            info: { mimetype: "application/pdf", size: 1234 },
            ...content,
        },
    });
}

describe("FileViewerApi", () => {
    it("returns the viewers whose matcher accepts the media, ordered by ID", () => {
        const api = new FileViewerApi();
        const isPdf = (media: MediaHandle): boolean =>
            media.type === "uploaded" && media.mimetype === "application/pdf";
        api.registerFileViewer(isPdf, vi.fn(), mkOptions("zeta"));
        api.registerFileViewer(isPdf, vi.fn(), mkOptions("alpha"));
        api.registerFileViewer(() => false, vi.fn(), mkOptions("never"));

        expect(api.getViewersFor(PDF).map((viewer) => viewer.options.id)).toEqual(["alpha", "zeta"]);
        expect(api.getViewersFor(TEXT)).toEqual([]);
    });

    it("looks up a registered viewer by its ID", () => {
        const api = new FileViewerApi();
        const match = vi.fn();
        const render = vi.fn();
        const options = mkOptions("viewer");
        api.registerFileViewer(match, render, options);

        expect(api.getViewerById("viewer")).toEqual({ match, render, options });
        expect(api.getViewerById("missing")).toBeUndefined();
    });

    it("refuses to register two viewers with the same ID", () => {
        const api = new FileViewerApi();
        api.registerFileViewer(vi.fn(), vi.fn(), mkOptions("viewer"));

        expect(() => api.registerFileViewer(vi.fn(), vi.fn(), mkOptions("viewer"))).toThrow(
            "A file viewer with ID viewer has already been registered",
        );
    });
});

describe("uploadedMediaOfEvent", () => {
    // A helper built from the event resolves its media through the client.
    beforeEach(() => {
        stubClient();
    });

    it("describes the attachment of a media event", async () => {
        const blob = new Blob(["%PDF"]);
        const helper = {
            fileName: "spec.pdf",
            sourceBlob: { value: Promise.resolve(blob) },
        } as unknown as MediaEventHelper;

        const media = uploadedMediaOfEvent(mkFileEvent(), helper);

        expect(media).toEqual({
            type: "uploaded",
            mimetype: "application/pdf",
            byteSize: 1234,
            name: "spec.pdf",
            blob: expect.any(Function),
        });
        await expect(media!.blob()).resolves.toBe(blob);
    });

    it("builds its own helper when none is given", () => {
        expect(uploadedMediaOfEvent(mkFileEvent({ filename: "renamed.pdf" }))).toMatchObject({
            type: "uploaded",
            name: "renamed.pdf",
        });
    });

    it("returns nothing for an event without an attachment", () => {
        const textEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            content: { msgtype: MsgType.Text, body: "hello" },
        });

        expect(uploadedMediaOfEvent(textEvent)).toBeUndefined();
    });
});

describe("remoteMediaOfPreview", () => {
    it("wraps the preview without its image", () => {
        const preview: UrlPreview = {
            link: "https://example.org/spec.pdf",
            title: "Spec",
            siteName: "example.org",
            showTooltipOnLink: false,
            image: { imageThumb: "thumb", imageFull: "full", mxcImageFull: "mxc://example.org/full", playable: false },
        };

        expect(remoteMediaOfPreview(preview)).toEqual({
            type: "remote",
            preview: { ...preview, image: undefined },
        });
    });
});
