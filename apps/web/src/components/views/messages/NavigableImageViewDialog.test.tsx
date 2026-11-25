/*
Copyright 2026 Johannes Camp jcamp@gmx.de

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import NavigableImageViewDialog from "./NavigableImageViewDialog";

const { mockImageView, mockClient } = vi.hoisted(() => ({
    mockImageView: vi.fn(),
    mockClient: {
        getRoom: vi.fn(),
        getEventTimeline: vi.fn(),
        paginateEventTimeline: vi.fn(),
    },
}));

// ---- Mock ImageView ----
vi.mock("../elements/ImageView", async () => {
    const { useViewModel } = await import("@element-hq/web-shared-components");
    return {
        default: function MockImageView(props: any) {
            mockImageView(props);
            const { canGoToNext } = useViewModel(props.navigation) as any;
            return (
                <div>
                    <div data-testid="name">{props.name}</div>
                    <div data-testid="src">{props.src}</div>
                    <div data-testid="hasNext">{String(canGoToNext)}</div>

                    <button onClick={() => props.navigation.goToNext()}>next</button>
                </div>
            );
        },
    };
});

// ---- Mock MediaEventHelper ----
vi.mock("../../../utils/MediaEventHelper", () => ({
    MediaEventHelper: class {
        public sourceUrl = { value: Promise.resolve("blob:mock-src") };
        public thumbnailUrl = { value: Promise.resolve(null) };
        public destroy = vi.fn();
    },
}));

// ---- Mock MatrixClientPeg.safeGet() ----
vi.mock("../../../MatrixClientPeg", () => ({
    MatrixClientPeg: {
        safeGet: () => mockClient,
    },
}));

// Helper to create minimal MatrixEvent-like image events
function mkImageEvent(id: string, roomId: string, body: string) {
    return {
        getId: () => id,
        getRoomId: () => roomId,
        isRedacted: () => false,
        getType: () => "m.room.message",
        getContent: () => ({ msgtype: "m.image", body }),
        getThread: () => undefined,
        isThreadRoot: false,
    } as any;
}

describe("NavigableImageViewDialog", () => {
    const roomId = "!room:server";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function mockTimeline(events: unknown[]): void {
        const timeline = { getEvents: () => events };
        const timelineSet = { getLiveTimeline: () => timeline };
        mockClient.getRoom.mockReturnValue({ getUnfilteredTimelineSet: () => timelineSet });
        mockClient.getEventTimeline.mockResolvedValue(timeline);
    }

    it("shows the current image of the navigation in the lightbox", async () => {
        const ev1 = mkImageEvent("$img1", roomId, "first");
        const ev2 = mkImageEvent("$img2", roomId, "second");
        mockTimeline([ev1, ev2]);

        render(<NavigableImageViewDialog initialEvent={ev1} initialSrc="blob:initial-src" onFinished={() => {}} />);

        expect(screen.getByTestId("name")).toHaveTextContent("first");
        await waitFor(() => {
            expect(screen.getByTestId("src")).toHaveTextContent("blob:mock-src");
        });
        await waitFor(() => {
            expect(screen.getByTestId("hasNext")).toHaveTextContent("true");
        });

        await userEvent.click(screen.getByText("next"));

        expect(await screen.findByTestId("name")).toHaveTextContent("second");
        expect(mockImageView).toHaveBeenLastCalledWith(expect.objectContaining({ mxEvent: ev2 }));
    });
});
