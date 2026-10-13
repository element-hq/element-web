/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";
import { MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";
import type { UrlPreview } from "shared-types";

import { UrlPreviewApi } from "./UrlPreviewApi";

const PREVIEW: UrlPreview = {
    link: "https://example.org/page",
    showTooltipOnLink: false,
    title: "Example page",
    siteName: "example.org",
};

const CONTENT = { msgtype: "m.text", body: "https://example.org/page" };

/**
 * Build a message event. Events without a room ID are given no sender either, which stands
 * in for an event that cannot be represented as a module event.
 */
function mkMessageEvent(roomId?: string): MatrixEvent {
    const mxEvent = new MatrixEvent({
        type: "m.room.message",
        content: CONTENT,
        event_id: "$event-id",
        origin_server_ts: 1234567890,
        sender: "@alice:example.org",
        room_id: roomId,
    });
    if (roomId) {
        mxEvent.sender = { userId: "@alice:example.org" } as RoomMember;
    }
    return mxEvent;
}

describe("UrlPreviewApi", () => {
    it("should return null when no handler is registered", async () => {
        const api = new UrlPreviewApi();
        await expect(api.getPreview("https://example.org/page")).resolves.toBeNull();
    });

    it("should return null when no handler matches the url", async () => {
        const handler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/matrix\.org\//, handler);

        await expect(api.getPreview("https://example.org/page")).resolves.toBeNull();
        expect(handler).not.toHaveBeenCalled();
    });

    it("should call the handler matching the url", async () => {
        const handler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, handler);

        await expect(api.getPreview("https://example.org/page")).resolves.toBe(PREVIEW);
        expect(handler).toHaveBeenCalledWith("https://example.org/page", undefined);
    });

    it("should return null if the matching handler produces no preview", async () => {
        const handler = vi.fn().mockResolvedValue(null);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, handler);

        await expect(api.getPreview("https://example.org/page")).resolves.toBeNull();
        expect(handler).toHaveBeenCalledOnce();
    });

    it("should only call the first handler that matches the url", async () => {
        const firstHandler = vi.fn().mockResolvedValue(null);
        const secondHandler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, firstHandler);
        api.registerPreviewHandler(/page$/, secondHandler);

        // The first handler matched, so we do not fall through to the second even though it returned no preview.
        await expect(api.getPreview("https://example.org/page")).resolves.toBeNull();
        expect(firstHandler).toHaveBeenCalledOnce();
        expect(secondHandler).not.toHaveBeenCalled();
    });

    it("should skip non-matching handlers and use a later matching one", async () => {
        const firstHandler = vi.fn().mockResolvedValue(PREVIEW);
        const secondHandler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/matrix\.org\//, firstHandler);
        api.registerPreviewHandler(/^https:\/\/example\.org\//, secondHandler);

        await expect(api.getPreview("https://example.org/page")).resolves.toBe(PREVIEW);
        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalledOnce();
    });

    it("should replace the handler when the same regex is registered twice", async () => {
        const regex = /^https:\/\/example\.org\//;
        const firstHandler = vi.fn().mockResolvedValue(null);
        const secondHandler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(regex, firstHandler);
        api.registerPreviewHandler(regex, secondHandler);

        await expect(api.getPreview("https://example.org/page")).resolves.toBe(PREVIEW);
        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalledOnce();
    });

    it("should pass the module representation of the event to the handler", async () => {
        const handler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, handler);

        const mxEvent = mkMessageEvent("!room:example.org");

        await expect(api.getPreview("https://example.org/page", mxEvent)).resolves.toBe(PREVIEW);
        expect(handler).toHaveBeenCalledWith("https://example.org/page", {
            content: CONTENT,
            eventId: "$event-id",
            originServerTs: 1234567890,
            roomId: "!room:example.org",
            sender: "@alice:example.org",
            stateKey: undefined,
            type: "m.room.message",
            unsigned: {},
        });
    });

    it("should pass undefined to the handler if the event cannot be converted", async () => {
        const handler = vi.fn().mockResolvedValue(PREVIEW);
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, handler);

        const mxEvent = mkMessageEvent();

        await expect(api.getPreview("https://example.org/page", mxEvent)).resolves.toBe(PREVIEW);
        expect(handler).toHaveBeenCalledWith("https://example.org/page", undefined);
    });

    it("should propagate errors thrown by the handler", async () => {
        const handler = vi.fn().mockRejectedValue(new Error("Preview failed"));
        const api = new UrlPreviewApi();
        api.registerPreviewHandler(/^https:\/\/example\.org\//, handler);

        await expect(api.getPreview("https://example.org/page")).rejects.toThrow("Preview failed");
    });
});
