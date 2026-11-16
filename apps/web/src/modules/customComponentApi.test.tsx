/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";

import { CustomComponentsApi } from "./customComponentApi";

function mkMessageEvent(): MatrixEvent {
    const mxEvent = new MatrixEvent({
        type: "m.room.message",
        content: { msgtype: "m.text", body: "hello" },
        event_id: "$event-id",
        origin_server_ts: 1234567890,
        sender: "@alice:example.org",
        room_id: "!room:example.org",
    });
    mxEvent.sender = { userId: "@alice:example.org" } as RoomMember;
    return mxEvent;
}

const original = (): React.JSX.Element => <span>original</span>;

describe("CustomComponentsApi", () => {
    describe("should be able to to unregister from registerMessageRenderer()", () => {
        it("removes the renderer", () => {
            const api = new CustomComponentsApi();
            const renderer = vi.fn().mockReturnValue(<span>custom</span>);
            const unregister = api.registerMessageRenderer("m.room.message", renderer);

            unregister();

            expect(api.renderMessage({ mxEvent: mkMessageEvent() }, original)).toEqual(original());
            expect(renderer).not.toHaveBeenCalled();
        });

        it("lets a renderer registered again be used instead of the removed one", () => {
            const api = new CustomComponentsApi();
            const oldRenderer = vi.fn().mockReturnValue(<span>old</span>);
            const newRenderer = vi.fn().mockReturnValue(<span>new</span>);
            const unregister = api.registerMessageRenderer("m.room.message", oldRenderer);
            api.registerMessageRenderer("m.room.message", newRenderer);

            unregister();
            api.renderMessage({ mxEvent: mkMessageEvent() }, original);

            expect(oldRenderer).not.toHaveBeenCalled();
            expect(newRenderer).toHaveBeenCalled();
        });

        it("leaves another registration of the same renderer in place", () => {
            const api = new CustomComponentsApi();
            const renderer = vi.fn().mockReturnValue(<span>custom</span>);
            const unregisterFirst = api.registerMessageRenderer("m.room.message", renderer);
            api.registerMessageRenderer("m.room.message", renderer);

            unregisterFirst();
            // Call again just to test that another call noops
            unregisterFirst();
            api.renderMessage({ mxEvent: mkMessageEvent() }, original);

            expect(renderer).toHaveBeenCalled();
        });
    });

    describe("should be able to unregister from registerComposerPreview()", () => {
        const props = { text: "hello!", roomId: "!room:example.org" };
        const matchHello = (text: string): boolean => text === "hello!";

        it("removes the renderer", () => {
            const api = new CustomComponentsApi();
            const renderer = vi.fn().mockReturnValue(<b>custom</b>);
            const unregister = api.registerComposerPreview(matchHello, renderer);

            unregister();

            expect(api.renderComposerPreview(props, original)).toBeNull();
            expect(renderer).not.toHaveBeenCalled();
        });

        it("lets a renderer registered again be used instead of the removed one", () => {
            const api = new CustomComponentsApi();
            const oldRenderer = vi.fn().mockReturnValue(<b>old</b>);
            const newRenderer = vi.fn().mockReturnValue(<b>new</b>);
            const unregister = api.registerComposerPreview(matchHello, oldRenderer);
            api.registerComposerPreview(matchHello, newRenderer);

            unregister();
            api.renderComposerPreview(props, original);

            expect(oldRenderer).not.toHaveBeenCalled();
            expect(newRenderer).toHaveBeenCalled();
        });
    });
});
